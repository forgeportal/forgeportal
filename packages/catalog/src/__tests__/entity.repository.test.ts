import { describe, it, expect, vi } from 'vitest';
import { EntityRepository } from '../entity.repository.js';
import { ConflictError, NotFoundError } from '@forgeportal/core';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides['id'] ?? '00000000-0000-0000-0000-000000000001',
    kind: overrides['kind'] ?? 'service',
    namespace: overrides['namespace'] ?? 'default',
    name: overrides['name'] ?? 'test-svc',
    owner_ref: overrides['owner_ref'] ?? null,
    lifecycle: overrides['lifecycle'] ?? null,
    tags: overrides['tags'] ?? [],
    links: overrides['links'] ?? [],
    annotations: overrides['annotations'] ?? {},
    scm: overrides['scm'] ?? {},
    spec: overrides['spec'] ?? {},
    created_at: overrides['created_at'] ?? new Date(),
    updated_at: overrides['updated_at'] ?? new Date(),
    ...(overrides['total'] !== undefined ? { total: overrides['total'] } : {}),
  };
}

function mockPool(queryFn?: (...args: unknown[]) => unknown) {
  return {
    query: queryFn ?? vi.fn().mockResolvedValue({ rows: [makeRow()], rowCount: 1 }),
  } as never;
}

describe('EntityRepository', () => {
  it('create returns entity row with UUID', async () => {
    const pool = mockPool();
    const repo = new EntityRepository(pool);
    const entity = await repo.create({
      kind: 'service',
      name: 'orders',
      namespace: 'default',
      tags: [],
      links: [],
      annotations: {},
      scm: {},
      spec: {},
      relations: [],
    });
    expect(entity.kind).toBe('service');
    expect(entity.id).toBeDefined();
  });

  it('upsert persists and returns annotations', async () => {
    const annotations = { 'forgeportal.dev/k8s-label-selector': 'app=payment-api' };
    const pool = mockPool(
      vi.fn().mockResolvedValue({
        rows: [{ ...makeRow({ annotations }), inserted: true }],
        rowCount: 1,
      }),
    );
    const repo = new EntityRepository(pool);
    const { entity, created } = await repo.upsert({
      kind: 'service',
      name: 'payment-api',
      namespace: 'default',
      tags: [],
      links: [],
      annotations,
      scm: {},
      spec: {},
      relations: [],
    });
    expect(created).toBe(true);
    expect(entity.annotations).toEqual(annotations);
  });

  it('create duplicate throws ConflictError', async () => {
    const pool = mockPool(vi.fn().mockRejectedValue({ code: '23505' }));
    const repo = new EntityRepository(pool);
    await expect(
      repo.create({
        kind: 'service',
        name: 'dup',
        namespace: 'default',
        tags: [],
        links: [],
        annotations: {},
        scm: {},
        spec: {},
        relations: [],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('findById returns entity', async () => {
    const pool = mockPool();
    const repo = new EntityRepository(pool);
    const entity = await repo.findById('00000000-0000-0000-0000-000000000001');
    expect(entity).not.toBeNull();
    expect(entity!.kind).toBe('service');
  });

  it('findById returns null for unknown id', async () => {
    const pool = mockPool(vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }));
    const repo = new EntityRepository(pool);
    const entity = await repo.findById('nonexistent');
    expect(entity).toBeNull();
  });

  it('list with no filters returns paginated results', async () => {
    const row = makeRow({ total: 1 });
    const pool = mockPool(vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 }));
    const repo = new EntityRepository(pool);
    const result = await repo.list({ offset: 0, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('list with kind filter builds correct query', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const pool = mockPool(queryFn);
    const repo = new EntityRepository(pool);
    await repo.list({ kind: 'service', offset: 0, limit: 20 });
    const sql = queryFn.mock.calls[0][0] as string;
    expect(sql).toContain('kind = $1');
  });

  it('list with FTS query includes ts_rank', async () => {
    const queryFn = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const pool = mockPool(queryFn);
    const repo = new EntityRepository(pool);
    await repo.list({ q: 'orders', offset: 0, limit: 20 });
    const sql = queryFn.mock.calls[0][0] as string;
    expect(sql).toContain('ts_rank');
    expect(sql).toContain('plainto_tsquery');
  });

  it('update returns updated row', async () => {
    const updatedRow = makeRow({ updated_at: new Date() });
    const pool = mockPool(vi.fn().mockResolvedValue({ rows: [updatedRow], rowCount: 1 }));
    const repo = new EntityRepository(pool);
    const entity = await repo.update('00000000-0000-0000-0000-000000000001', {
      lifecycle: 'production',
    });
    expect(entity.id).toBeDefined();
  });

  it('update unknown entity throws NotFoundError', async () => {
    const pool = mockPool(vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }));
    const repo = new EntityRepository(pool);
    await expect(
      repo.update('nonexistent', { lifecycle: 'deprecated' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('delete returns true when row existed', async () => {
    const pool = mockPool(vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }));
    const repo = new EntityRepository(pool);
    const result = await repo.delete('00000000-0000-0000-0000-000000000001');
    expect(result).toBe(true);
  });

  it('delete returns false when row did not exist', async () => {
    const pool = mockPool(vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }));
    const repo = new EntityRepository(pool);
    const result = await repo.delete('nonexistent');
    expect(result).toBe(false);
  });
});
