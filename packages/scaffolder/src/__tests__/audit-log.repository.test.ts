import { describe, it, expect, vi } from 'vitest';
import type { Pool, QueryResult } from 'pg';
import { AuditLogRepository } from '../audit-log.repository.js';

function makePool(rows: Record<string, unknown>[] = []): Pool {
  const query = vi.fn().mockResolvedValue({
    rows,
    rowCount: rows.length,
  } as unknown as QueryResult);
  return { query } as unknown as Pool;
}

describe('AuditLogRepository', () => {
  describe('append', () => {
    it('inserts a row with the correct fields', async () => {
      const pool = makePool([]);
      const repo = new AuditLogRepository(pool);

      await repo.append({
        actor: 'user:test@example.com',
        action: 'scm.createRepo@v1',
        target_type: 'action_run',
        target_id: 'run-uuid-123',
        metadata: { run_id: 'run-uuid-123', status: 'success' },
      });

      const mockQuery = pool.query as ReturnType<typeof vi.fn>;
      expect(mockQuery).toHaveBeenCalledOnce();
      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO audit_logs');
      expect(params[0]).toBe('user:test@example.com');
      expect(params[1]).toBe('scm.createRepo@v1');
      expect(params[2]).toBe('action_run');
      expect(params[3]).toBe('run-uuid-123');
      expect(JSON.parse(params[4] as string)).toEqual({
        run_id: 'run-uuid-123',
        status: 'success',
      });
    });
  });

  describe('list', () => {
    it('returns matching entries when targetId filter is provided', async () => {
      const fakeEntry = {
        id: 'uuid-1',
        actor: 'user:a@b.com',
        action: 'foo@v1',
        target_type: 'action_run',
        target_id: 'run-1',
        metadata: {},
        ts: new Date().toISOString(),
      };
      const pool = makePool([fakeEntry]);
      // list calls query twice (entries + count)
      const mockQuery = pool.query as ReturnType<typeof vi.fn>;
      mockQuery
        .mockResolvedValueOnce({ rows: [fakeEntry] } as unknown as QueryResult)
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
        } as unknown as QueryResult);

      const repo = new AuditLogRepository(pool);
      const result = await repo.list({ targetId: 'run-1' });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.target_id).toBe('run-1');
      expect(result.total).toBe(1);
    });

    it('respects limit and offset for pagination', async () => {
      const pool = makePool([]);
      const mockQuery = pool.query as ReturnType<typeof vi.fn>;
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as unknown as QueryResult)
        .mockResolvedValueOnce({
          rows: [{ count: '42' }],
        } as unknown as QueryResult);

      const repo = new AuditLogRepository(pool);
      const result = await repo.list({ limit: 10, offset: 20 });

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(42);

      // Verify limit and offset are passed as parameters
      const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
      expect(params[2]).toBe(10);
      expect(params[3]).toBe(20);
    });
  });
});
