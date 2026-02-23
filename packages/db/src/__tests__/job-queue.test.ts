import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueJob, claimJob, completeJob, getLatestJob } from '../job-queue.js';

function makeMockPool() {
  const rows: Record<string, Record<string, unknown>> = {};
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO jobs')) {
        const job = {
          id: 'job-1',
          type: params?.[0] as string,
          payload: JSON.parse(params?.[1] as string),
          status: 'queued',
          locked_by: null,
          locked_at: null,
          created_at: new Date(),
          finished_at: null,
        };
        rows[job.id] = job;
        return { rows: [job], rowCount: 1 };
      }
      if (sql.includes('FOR UPDATE SKIP LOCKED')) {
        const types = params?.[0] as string[];
        const workerId = params?.[1] as string;
        const queued = Object.values(rows).find(
          (j) => j['status'] === 'queued' && types.includes(j['type'] as string),
        );
        if (!queued) return { rows: [], rowCount: 0 };
        queued['status'] = 'running';
        queued['locked_by'] = workerId;
        queued['locked_at'] = new Date();
        return { rows: [queued], rowCount: 1 };
      }
      if (sql.includes('UPDATE jobs SET status = $2')) {
        const id = params?.[0] as string;
        const status = params?.[1] as string;
        if (rows[id]) {
          rows[id]['status'] = status;
          rows[id]['finished_at'] = new Date();
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('ORDER BY created_at DESC LIMIT 1')) {
        const type = params?.[0] as string;
        const matching = Object.values(rows)
          .filter((j) => j['type'] === type)
          .sort(
            (a, b) =>
              (b['created_at'] as Date).getTime() -
              (a['created_at'] as Date).getTime(),
          );
        if (matching.length === 0) return { rows: [], rowCount: 0 };
        return { rows: [matching[0]], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
    _rows: rows,
  };
}

describe('job-queue', () => {
  let pool: ReturnType<typeof makeMockPool>;

  beforeEach(() => {
    pool = makeMockPool();
  });

  it('enqueueJob returns job with status queued', async () => {
    const job = await enqueueJob(pool as never, 'repo-scan', { org: 'test' });
    expect(job.status).toBe('queued');
    expect(job.type).toBe('repo-scan');
    expect(job.payload).toEqual({ org: 'test' });
  });

  it('claimJob returns queued job and marks as running', async () => {
    await enqueueJob(pool as never, 'repo-scan', {});
    const job = await claimJob(pool as never, ['repo-scan'], 'worker-1');
    expect(job).not.toBeNull();
    expect(job!.status).toBe('running');
    expect(job!.locked_by).toBe('worker-1');
  });

  it('claimJob with no queued jobs returns null', async () => {
    const job = await claimJob(pool as never, ['repo-scan'], 'worker-1');
    expect(job).toBeNull();
  });

  it('claimJob skips already running jobs', async () => {
    await enqueueJob(pool as never, 'repo-scan', {});
    await claimJob(pool as never, ['repo-scan'], 'worker-1');
    const second = await claimJob(pool as never, ['repo-scan'], 'worker-2');
    expect(second).toBeNull();
  });

  it('completeJob sets status and finished_at', async () => {
    await enqueueJob(pool as never, 'repo-scan', {});
    const job = await claimJob(pool as never, ['repo-scan'], 'worker-1');
    await completeJob(pool as never, job!.id, 'success');
    expect(pool._rows['job-1']['status']).toBe('success');
    expect(pool._rows['job-1']['finished_at']).toBeInstanceOf(Date);
  });

  it('getLatestJob returns most recent job', async () => {
    await enqueueJob(pool as never, 'repo-scan', {});
    const latest = await getLatestJob(pool as never, 'repo-scan');
    expect(latest).not.toBeNull();
    expect(latest!.type).toBe('repo-scan');
  });
});
