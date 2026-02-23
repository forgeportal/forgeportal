import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { ActionRunRepository } from '../action-run.repository.js';

// ── Mock pool factory ────────────────────────────────────────────────────────

function makePool(rows: Record<string, unknown>[] = [], rowCount = 0): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount }),
  } as unknown as Pool;
}

const BASE_RUN = {
  id: 'run-1',
  action_id: 'act-1',
  template_id: null,
  entity_id: null,
  requested_by: 'user@test.com',
  status: 'queued',
  input: '{}',
  output: '{}',
  locked_by: null,
  locked_at: null,
  retry_count: 0,
  max_retries: 3,
  idempotency_key: null,
  next_attempt_at: null,
  started_at: null,
  finished_at: null,
  created_at: new Date().toISOString(),
};

beforeEach(() => vi.clearAllMocks());

describe('ActionRunRepository', () => {
  it('create() inserts row with status=queued', async () => {
    const row = { ...BASE_RUN };
    const pool = makePool([row]);
    const repo = new ActionRunRepository(pool);

    const result = await repo.create({
      action_id: 'act-1',
      requested_by: 'user@test.com',
      input: {},
    });

    expect(result.status).toBe('queued');
    expect(result.requested_by).toBe('user@test.com');
    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain("'queued'");
  });

  it('claimNext() returns null when queue is empty', async () => {
    const pool = makePool([]);
    const repo = new ActionRunRepository(pool);
    const result = await repo.claimNext('worker-1');
    expect(result).toBeNull();
  });

  it('claimNext() claims a queued run and sets status=running', async () => {
    const row = { ...BASE_RUN, status: 'running', locked_by: 'worker-1' };
    const pool = makePool([row]);
    const repo = new ActionRunRepository(pool);

    const result = await repo.claimNext('worker-1');
    expect(result?.status).toBe('running');
    expect(result?.locked_by).toBe('worker-1');

    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
  });

  it('claimNext() query includes next_attempt_at filter', async () => {
    const pool = makePool([]);
    const repo = new ActionRunRepository(pool);
    await repo.claimNext('worker-1');

    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain('next_attempt_at IS NULL OR next_attempt_at <= now()');
  });

  it('claimNext() re-claims stuck runs (locked_at > 5 minutes)', async () => {
    const pool = makePool([]);
    const repo = new ActionRunRepository(pool);
    await repo.claimNext('worker-1');

    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain("locked_at < now() - interval '5 minutes'");
  });

  it('markSuccess() sets status=success, finished_at, clears locked_by', async () => {
    const pool = makePool([], 1);
    const repo = new ActionRunRepository(pool);

    await repo.markSuccess('run-1', { result: 'ok' });

    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain("status = 'success'");
    expect(sql).toContain('finished_at = now()');
    expect(sql).toContain('locked_by = NULL');
  });

  it('markFailedOrRetry() with retry_count=0 < max_retries → queued, retry_count+1, next_attempt_at ~now+30s', async () => {
    const pool = makePool([], 1);
    const repo = new ActionRunRepository(pool);
    const run = { ...BASE_RUN, status: 'running' as const, retry_count: 0, max_retries: 3 };

    await repo.markFailedOrRetry('run-1', 'oops', run as never);

    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    const [sql, params] = calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'queued'");
    expect(sql).toContain('retry_count = retry_count + 1');
    expect(sql).toContain('next_attempt_at');
    // backoff for retry_count=0: 2^0 * 30 = 30s
    expect(params[0]).toBe(30);
  });

  it('markFailedOrRetry() with retry_count=3 >= max_retries=3 → failed, finished_at', async () => {
    const pool = makePool([], 1);
    const repo = new ActionRunRepository(pool);
    const run = { ...BASE_RUN, status: 'running' as const, retry_count: 3, max_retries: 3 };

    await repo.markFailedOrRetry('run-1', 'permanent failure', run as never);

    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain('finished_at = now()');
  });

  it('findByIdempotencyKey() returns existing success run', async () => {
    const row = { ...BASE_RUN, status: 'success', idempotency_key: 'idem-1' };
    const pool = makePool([row]);
    const repo = new ActionRunRepository(pool);

    const result = await repo.findByIdempotencyKey('idem-1');

    expect(result?.idempotency_key).toBe('idem-1');
    expect(result?.status).toBe('success');
    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(sql).toContain("status = 'success'");
  });

  it('findByIdempotencyKey() returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new ActionRunRepository(pool);
    const result = await repo.findByIdempotencyKey('not-found');
    expect(result).toBeNull();
  });
});
