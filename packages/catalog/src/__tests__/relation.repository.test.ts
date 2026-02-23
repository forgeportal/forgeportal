import { describe, it, expect, vi } from 'vitest';
import { RelationRepository } from '../relation.repository.js';

function mockClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
}

function mockPool(rows: Record<string, unknown>[] = []) {
  const client = mockClient();
  return {
    pool: {
      connect: vi.fn().mockResolvedValue(client),
      query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
    } as never,
    client,
  };
}

describe('RelationRepository', () => {
  it('setRelations deletes then inserts in transaction', async () => {
    const { pool, client } = mockPool();
    const repo = new RelationRepository(pool);
    await repo.setRelations('e1', [
      { type: 'dependsOn', target_entity_id: 'e2' },
    ]);
    const calls = client.query.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls).toContain('BEGIN');
    expect(calls.some((s) => s.includes('DELETE'))).toBe(true);
    expect(calls.some((s) => s.includes('INSERT'))).toBe(true);
    expect(calls).toContain('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('setRelations replaces existing (delete + insert)', async () => {
    const { pool, client } = mockPool();
    const repo = new RelationRepository(pool);
    await repo.setRelations('e1', [
      { type: 'ownedBy', target_entity_id: 'e3' },
      { type: 'partOf', target_entity_id: 'e4' },
    ]);
    const insertCalls = client.query.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT'),
    );
    expect(insertCalls).toHaveLength(2);
  });

  it('getRelationsForEntity returns relations with direction', async () => {
    const rows = [
      {
        id: 'r1',
        from_entity_id: 'e1',
        type: 'dependsOn',
        to_entity_id: 'e2',
        created_at: new Date(),
      },
      {
        id: 'r2',
        from_entity_id: 'e3',
        type: 'ownedBy',
        to_entity_id: 'e1',
        created_at: new Date(),
      },
    ];
    const { pool } = mockPool(rows);
    const repo = new RelationRepository(pool);
    const result = await repo.getRelationsForEntity('e1');
    expect(result).toHaveLength(2);
    expect(result[0].direction).toBe('from');
    expect(result[1].direction).toBe('to');
  });

  it('getRelationsForEntity returns empty array when no relations', async () => {
    const { pool } = mockPool([]);
    const repo = new RelationRepository(pool);
    const result = await repo.getRelationsForEntity('e-none');
    expect(result).toEqual([]);
  });
});
