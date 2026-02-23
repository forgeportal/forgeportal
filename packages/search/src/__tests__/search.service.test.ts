import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchResultItem } from '../types.js';
import type { SearchQuery } from '../search.schema.js';

const mockSearchEntities = vi.hoisted(() => vi.fn<() => Promise<SearchResultItem[]>>());
const mockSearchDocs = vi.hoisted(() => vi.fn<() => Promise<SearchResultItem[]>>());

vi.mock('../entity.search.js', () => ({ searchEntities: mockSearchEntities }));
vi.mock('../docs.search.js', () => ({ searchDocs: mockSearchDocs }));

const { search } = await import('../search.service.js');

function makeEntityItem(id: string, score: number): SearchResultItem {
  return {
    type: 'entity',
    id,
    title: `Entity ${id}`,
    excerpt: 'excerpt',
    url: `/catalog/${id}`,
    score,
    meta: { kind: 'Service', namespace: 'default', name: `entity-${id}`, owner_ref: null, lifecycle: null },
  };
}

function makeDocItem(id: string, score: number): SearchResultItem {
  return {
    type: 'doc',
    id,
    title: `Doc ${id}`,
    excerpt: 'excerpt',
    url: `/catalog/e1/docs?path=${id}`,
    score,
    meta: { entity_id: 'e1', path: id },
  };
}

function baseQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return { q: 'test', scope: 'all', offset: 0, limit: 20, ...overrides };
}

const fakePool = {} as never;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('search service', () => {
  it('scope=all → merges entity + doc results', async () => {
    mockSearchEntities.mockResolvedValue([makeEntityItem('e1', 0.8)]);
    mockSearchDocs.mockResolvedValue([makeDocItem('d1', 0.6)]);

    const result = await search(fakePool, baseQuery({ scope: 'all' }));
    expect(result.data).toHaveLength(2);
    expect(result.data.map((r) => r.type)).toEqual(['entity', 'doc']);
  });

  it('scope=entities → only entity results (docs not called)', async () => {
    mockSearchEntities.mockResolvedValue([makeEntityItem('e1', 0.8)]);
    mockSearchDocs.mockResolvedValue([]);

    const result = await search(fakePool, baseQuery({ scope: 'entities' }));
    expect(result.data.every((r) => r.type === 'entity')).toBe(true);
    expect(mockSearchDocs).not.toHaveBeenCalledWith(fakePool, expect.anything());
  });

  it('scope=docs → only doc results (entities not called)', async () => {
    mockSearchEntities.mockResolvedValue([]);
    mockSearchDocs.mockResolvedValue([makeDocItem('d1', 0.5)]);

    const result = await search(fakePool, baseQuery({ scope: 'docs' }));
    expect(result.data.every((r) => r.type === 'doc')).toBe(true);
    expect(mockSearchEntities).not.toHaveBeenCalledWith(fakePool, expect.anything());
  });

  it('cross-source ranking by score descending', async () => {
    mockSearchEntities.mockResolvedValue([makeEntityItem('e1', 0.5), makeEntityItem('e2', 0.9)]);
    mockSearchDocs.mockResolvedValue([makeDocItem('d1', 0.7)]);

    const result = await search(fakePool, baseQuery());
    const scores = result.data.map((r) => r.score);
    expect(scores).toEqual([0.9, 0.7, 0.5]);
  });

  it('pagination with offset + limit applies correctly', async () => {
    mockSearchEntities.mockResolvedValue([
      makeEntityItem('e1', 0.9),
      makeEntityItem('e2', 0.8),
      makeEntityItem('e3', 0.7),
    ]);
    mockSearchDocs.mockResolvedValue([]);

    const result = await search(fakePool, baseQuery({ offset: 1, limit: 2 }));
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe('e2');
  });

  it('total reflects count before pagination', async () => {
    mockSearchEntities.mockResolvedValue([
      makeEntityItem('e1', 0.9),
      makeEntityItem('e2', 0.8),
      makeEntityItem('e3', 0.7),
    ]);
    mockSearchDocs.mockResolvedValue([makeDocItem('d1', 0.6)]);

    const result = await search(fakePool, baseQuery({ offset: 0, limit: 2 }));
    expect(result.pagination.total).toBe(4);
    expect(result.data).toHaveLength(2);
  });
});
