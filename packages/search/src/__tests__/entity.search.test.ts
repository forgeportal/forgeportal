import { describe, it, expect, vi } from 'vitest';
import { searchEntities } from '../entity.search.js';
import type { SearchQuery } from '../search.schema.js';


function baseQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return { q: 'orders', scope: 'all', offset: 0, limit: 20, ...overrides };
}

function makeMockPool(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn(async () => ({ rows, rowCount: rows.length })),
  };
}

const matchingRow = {
  id: 'entity-1',
  title: 'orders-service',
  kind: 'Service',
  namespace: 'default',
  owner_ref: 'team:platform',
  lifecycle: 'production',
  score: '0.7599',
  excerpt: 'The <b>orders</b> service handles...',
};

describe('searchEntities', () => {
  it('entity with matching name → returned in results', async () => {
    const pool = makeMockPool([matchingRow]);
    const results = await searchEntities(pool as never, baseQuery());
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('entity-1');
  });

  it('entity with no match → not returned (empty rows)', async () => {
    const pool = makeMockPool([]);
    const results = await searchEntities(pool as never, baseQuery());
    expect(results).toHaveLength(0);
  });

  it('result has correct fields (type, id, title, url, score, meta)', async () => {
    const pool = makeMockPool([matchingRow]);
    const results = await searchEntities(pool as never, baseQuery());
    const item = results[0]!;
    expect(item.type).toBe('entity');
    expect(item.id).toBe('entity-1');
    expect(item.title).toBe('orders-service');
    expect(item.url).toBe('/catalog/entity-1');
    expect(item.score).toBeCloseTo(0.7599);
    expect(item.excerpt).toBe('The <b>orders</b> service handles...');
    expect(item.meta).toMatchObject({
      kind: 'Service',
      namespace: 'default',
      name: 'orders-service',
      owner_ref: 'team:platform',
      lifecycle: 'production',
    });
  });

  it('results ordered by score descending (SQL ORDER BY score DESC)', async () => {
    const rows = [
      { ...matchingRow, id: 'e1', title: 'e1', score: '0.9' },
      { ...matchingRow, id: 'e2', title: 'e2', score: '0.5' },
    ];
    const pool = makeMockPool(rows);
    const results = await searchEntities(pool as never, baseQuery());
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it('url format is /catalog/<id>', async () => {
    const pool = makeMockPool([matchingRow]);
    const results = await searchEntities(pool as never, baseQuery());
    expect(results[0]?.url).toBe(`/catalog/${matchingRow.id}`);
  });
});
