import { describe, it, expect, vi } from 'vitest';
import { searchDocs } from '../docs.search.js';
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
  id: 'doc-1',
  title: 'Orders API Reference',
  entity_id: 'entity-abc',
  path: 'docs/api/orders.md',
  score: '0.6432',
  excerpt: 'The <b>orders</b> API supports...',
};

describe('searchDocs', () => {
  it('docs page with matching content → returned', async () => {
    const pool = makeMockPool([matchingRow]);
    const results = await searchDocs(pool as never, baseQuery());
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('doc-1');
  });

  it('docs page with no match → not returned (empty rows)', async () => {
    const pool = makeMockPool([]);
    const results = await searchDocs(pool as never, baseQuery());
    expect(results).toHaveLength(0);
  });

  it('result has correct fields (type, entity_id, path, url)', async () => {
    const pool = makeMockPool([matchingRow]);
    const results = await searchDocs(pool as never, baseQuery());
    const item = results[0]!;
    expect(item.type).toBe('doc');
    expect(item.id).toBe('doc-1');
    expect(item.title).toBe('Orders API Reference');
    expect(item.score).toBeCloseTo(0.6432);
    expect(item.meta).toMatchObject({
      entity_id: 'entity-abc',
      path: 'docs/api/orders.md',
    });
  });

  it('url format is /catalog/<entityId>/docs?path=<encoded>', async () => {
    const pool = makeMockPool([matchingRow]);
    const results = await searchDocs(pool as never, baseQuery());
    const expectedUrl = `/catalog/entity-abc/docs?path=${encodeURIComponent('docs/api/orders.md')}`;
    expect(results[0]?.url).toBe(expectedUrl);
  });

  it('empty docs_pages table → empty results (not an error)', async () => {
    const pool = makeMockPool([]);
    await expect(searchDocs(pool as never, baseQuery())).resolves.toEqual([]);
  });
});
