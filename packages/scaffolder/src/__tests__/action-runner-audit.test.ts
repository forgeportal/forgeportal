import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Logger } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { ActionRegistry } from '../action-registry.js';
import { ActionRunner, } from '../action-runner.js';
import { ActionError } from '../types.js';
import type { ActionRun } from '../action-run.repository.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockClaimNext = vi.fn();
const mockMarkSuccess = vi.fn();
const mockMarkFailedOrRetry = vi.fn();
const mockAuditAppend = vi.fn();

vi.mock('../action-run.repository.js', () => ({
  ActionRunRepository: vi.fn().mockImplementation(() => ({
    claimNext: mockClaimNext,
    markSuccess: mockMarkSuccess,
    markFailedOrRetry: mockMarkFailedOrRetry,
  })),
}));

vi.mock('../action-run-log.repository.js', () => ({
  ActionRunLogRepository: vi.fn().mockImplementation(() => ({
    appendLog: vi.fn(),
  })),
}));

vi.mock('../audit-log.repository.js', () => ({
  AuditLogRepository: vi.fn().mockImplementation(() => ({
    append: mockAuditAppend,
  })),
}));

vi.mock('../action-context.js', () => ({
  createActionContext: vi.fn().mockReturnValue({
    runId: 'run-audit-1',
    entityId: null,
    requestedBy: 'user@test.com',
    input: {},
    acquireRepoLock: vi.fn(),
    releaseAllLocks: vi.fn(),
    log: vi.fn(),
  }),
}));

const DUMMY_RUN: ActionRun = {
  id: 'run-audit-1',
  action_id: 'act-uuid-1',
  template_id: null,
  template_run_id: null,
  step_id: null,
  entity_id: 'entity-1',
  requested_by: 'user@test.com',
  status: 'running',
  input: {},
  output: {},
  locked_by: 'worker-1',
  locked_at: new Date(),
  retry_count: 0,
  max_retries: 3,
  idempotency_key: null,
  next_attempt_at: null,
  started_at: new Date(),
  finished_at: null,
  created_at: new Date(),
};

function makePool(actionName = 'scm.createRepo', version = 'v1'): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ name: actionName, version }] }),
    connect: vi.fn(),
  } as unknown as Pool;
}

const noopLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

const noopScm = {} as SCMProviders;

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimNext.mockReset().mockResolvedValue(null);
  mockMarkSuccess.mockReset();
  mockMarkFailedOrRetry.mockReset();
  mockAuditAppend.mockReset().mockResolvedValue(undefined);
});

function makeRunner(registry: ActionRegistry, pool: Pool): ActionRunner {
  return new ActionRunner(pool, registry, noopScm, noopLogger, {
    concurrency: 5,
    pollIntervalMs: 10,
  });
}

async function runOnce(runner: ActionRunner): Promise<void> {
  const startPromise = runner.start();
  await new Promise((r) => setTimeout(r, 60));
  runner.stop();
  await startPromise;
}

describe('ActionRunner — audit log', () => {
  it('successful action → auditRepo.append called once with status=success (AC: 1)', async () => {
    const pool = makePool();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockResolvedValue({
        status: 'success',
        outputs: { repoUrl: 'https://github.com/x/y' },
        links: [{ title: 'Repo', url: 'https://github.com/x/y' }],
      }),
    });

    const runner = makeRunner(registry, pool);
    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkSuccess.mockResolvedValue(undefined);

    await runOnce(runner);

    expect(mockAuditAppend).toHaveBeenCalledOnce();
    const [auditInput] = mockAuditAppend.mock.calls[0] as [
      { metadata: { status: string; outputs: unknown } },
    ];
    expect(auditInput.metadata['status']).toBe('success');
    expect(auditInput.metadata['outputs']).toEqual({
      repoUrl: 'https://github.com/x/y',
    });
  });

  it('action fails, retry_count < max_retries → auditRepo.append NOT called (AC: 1)', async () => {
    const pool = makePool();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockRejectedValue(new Error('transient failure')),
    });

    const runner = makeRunner(registry, pool);
    // retry_count=0 < max_retries=3 → not terminal
    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkFailedOrRetry.mockResolvedValue(undefined);

    await runOnce(runner);

    expect(mockAuditAppend).not.toHaveBeenCalled();
  });

  it('action fails, retry_count = max_retries → auditRepo.append called once with status=failed (AC: 1)', async () => {
    const pool = makePool();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      // ActionError preserves the message through the runner (plain Error is replaced)
      execute: vi.fn().mockRejectedValue(new ActionError('REMOTE_ERROR', 'permanent failure')),
    });

    const runner = makeRunner(registry, pool);
    // Simulate terminal failure: retry_count equals max_retries
    const terminalRun: ActionRun = { ...DUMMY_RUN, retry_count: 3, max_retries: 3 };
    mockClaimNext.mockResolvedValueOnce(terminalRun).mockResolvedValue(null);
    mockMarkFailedOrRetry.mockResolvedValue(undefined);

    await runOnce(runner);

    expect(mockAuditAppend).toHaveBeenCalledOnce();
    const [auditInput] = mockAuditAppend.mock.calls[0] as [
      { metadata: { status: string; error: string } },
    ];
    expect(auditInput.metadata['status']).toBe('failed');
    expect(auditInput.metadata['error']).toBe('permanent failure');
  });

  it('auditRepo.append throws → error is logged, runner does NOT crash (AC: 1 — fire-and-forget)', async () => {
    const pool = makePool();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockResolvedValue({ status: 'success', outputs: {} }),
    });

    const runner = makeRunner(registry, pool);
    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkSuccess.mockResolvedValue(undefined);
    // Simulate audit failure
    mockAuditAppend.mockRejectedValue(new Error('DB connection lost'));

    await expect(runOnce(runner)).resolves.toBeUndefined();

    // Runner completed without throwing despite audit failure
    const mockError = (noopLogger.error as ReturnType<typeof vi.fn>);
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-audit-1' }),
      expect.stringContaining('audit log'),
    );
  });
});
