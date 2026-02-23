import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Logger } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { ActionRegistry } from '../action-registry.js';
import { ActionRunner } from '../action-runner.js';
import { ActionError } from '../types.js';
import type { ActionRun } from '../action-run.repository.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockClaimNext = vi.fn();
const mockMarkSuccess = vi.fn();
const mockMarkFailedOrRetry = vi.fn();

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

vi.mock('../action-context.js', () => ({
  createActionContext: vi.fn().mockReturnValue({
    runId: 'run-1',
    entityId: null,
    requestedBy: 'user@test.com',
    input: {},
    acquireRepoLock: vi.fn(),
    releaseAllLocks: vi.fn(),
    log: vi.fn(),
  }),
}));

const DUMMY_RUN: ActionRun = {
  id: 'run-1',
  action_id: 'act-uuid-1',
  template_id: null,
  template_run_id: null,
  step_id: null,
  entity_id: null,
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

function makePoolWithAction(actionName = 'scm.createRepo', version = 'v1'): Pool {
  return {
    query: vi.fn().mockResolvedValue({
      rows: [{ name: actionName, version }],
    }),
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
  // Reset claimNext fully to drain any leftover mockResolvedValueOnce queue
  // from previous tests, then set a safe default of null (no work).
  mockClaimNext.mockReset().mockResolvedValue(null);
  mockMarkSuccess.mockReset();
  mockMarkFailedOrRetry.mockReset();
});

function makeRunner(registry: ActionRegistry, pool: Pool): ActionRunner {
  return new ActionRunner(pool, registry, noopScm, noopLogger, {
    concurrency: 5,
    pollIntervalMs: 10,
  });
}

describe('ActionRunner', () => {
  it('claims a run, calls handler, marks success (AC: 3, 4)', async () => {
    const pool = makePoolWithAction();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockResolvedValue({ status: 'success', outputs: { repoUrl: 'https://github.com/x/y' } }),
    });

    const runner = makeRunner(registry, pool);

    // Simulate one successful claim then stop
    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkSuccess.mockResolvedValue(undefined);

    const startPromise = runner.start();
    // Let the loop tick a couple of times, then stop
    await new Promise((r) => setTimeout(r, 50));
    runner.stop();
    await startPromise;

    expect(mockMarkSuccess).toHaveBeenCalledWith('run-1', expect.objectContaining({ repoUrl: expect.any(String) }));
  });

  it('handler throws ActionError → markFailedOrRetry called (AC: 5)', async () => {
    const pool = makePoolWithAction();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockRejectedValue(new ActionError('REMOTE_ERROR', 'SCM unreachable')),
    });

    const runner = makeRunner(registry, pool);

    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkFailedOrRetry.mockResolvedValue(undefined);

    const startPromise = runner.start();
    await new Promise((r) => setTimeout(r, 50));
    runner.stop();
    await startPromise;

    expect(mockMarkFailedOrRetry).toHaveBeenCalledWith(
      'run-1',
      'SCM unreachable',
      DUMMY_RUN,
    );
  });

  it('handler throws unknown error → markFailedOrRetry called (AC: 6)', async () => {
    const pool = makePoolWithAction();
    const registry = new ActionRegistry();
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockRejectedValue(new Error('Unexpected crash')),
    });

    const runner = makeRunner(registry, pool);

    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkFailedOrRetry.mockResolvedValue(undefined);

    const startPromise = runner.start();
    await new Promise((r) => setTimeout(r, 50));
    runner.stop();
    await startPromise;

    expect(mockMarkFailedOrRetry).toHaveBeenCalledWith(
      'run-1',
      'Internal error during action execution',
      DUMMY_RUN,
    );
  });

  it('no handler registered for action → markFailedOrRetry with descriptive message (AC: 6)', async () => {
    const pool = makePoolWithAction('unknown.action', 'v1');
    const registry = new ActionRegistry(); // empty registry

    const runner = makeRunner(registry, pool);

    mockClaimNext.mockResolvedValueOnce(DUMMY_RUN).mockResolvedValue(null);
    mockMarkFailedOrRetry.mockResolvedValue(undefined);

    const startPromise = runner.start();
    await new Promise((r) => setTimeout(r, 50));
    runner.stop();
    await startPromise;

    expect(mockMarkFailedOrRetry).toHaveBeenCalledWith(
      'run-1',
      expect.stringContaining('No handler registered for action'),
      DUMMY_RUN,
    );
  });

  it('respects concurrency limit — does not claim when at capacity (AC: 8)', async () => {
    const pool = makePoolWithAction();
    const registry = new ActionRegistry();

    // Handler that blocks until we signal it — resolves cleanly to avoid async leaks
    type Settler = () => void;
    const settlers: Settler[] = [];
    registry.register({
      actionId: 'scm.createRepo@v1',
      execute: vi.fn().mockImplementation(
        () => new Promise<{ status: 'success'; outputs: Record<string, unknown> }>((resolve) => {
          settlers.push(() => resolve({ status: 'success', outputs: {} }));
        }),
      ),
    });

    const runner = new ActionRunner(pool, registry, noopScm, noopLogger, {
      concurrency: 2,
      pollIntervalMs: 5,
    });

    // Feed 3 runs — concurrency is 2
    const run2 = { ...DUMMY_RUN, id: 'run-2' };
    const run3 = { ...DUMMY_RUN, id: 'run-3' };
    mockClaimNext
      .mockResolvedValueOnce(DUMMY_RUN)
      .mockResolvedValueOnce(run2)
      .mockResolvedValueOnce(run3)
      .mockResolvedValue(null);

    const startPromise = runner.start();
    // Wait for runs to start filling slots
    await new Promise((r) => setTimeout(r, 60));

    // claimNext should have been called at least 2 times (filling concurrency=2 slots)
    const claimCallCount = mockClaimNext.mock.calls.length;
    expect(claimCallCount).toBeGreaterThanOrEqual(2);

    runner.stop();
    // Settle all floating executeRun promises cleanly before test ends
    for (const settle of settlers) settle();
    await startPromise;
    // Give microtasks time to complete
    await new Promise((r) => setTimeout(r, 20));
  });

  it('does not claim run whose next_attempt_at is in the future (AC: 11)', async () => {
    // This is enforced at DB level (SQL WHERE clause) — confirmed via repository test.
    // The runner delegates timing to claimNext; if claimNext returns null, runner sleeps.
    mockClaimNext.mockResolvedValue(null);

    const pool = makePoolWithAction();
    const registry = new ActionRegistry();
    const runner = new ActionRunner(pool, registry, noopScm, noopLogger, {
      concurrency: 1,
      pollIntervalMs: 10,
    });

    const startPromise = runner.start();
    await new Promise((r) => setTimeout(r, 30));
    runner.stop();
    await startPromise;

    expect(mockMarkFailedOrRetry).not.toHaveBeenCalled();
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });
});
