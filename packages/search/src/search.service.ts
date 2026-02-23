import type { Pool } from 'pg';
import type { SearchResponse } from './types.js';
import type { SearchQuery } from './search.schema.js';
import { searchEntities } from './entity.search.js';
import { searchDocs } from './docs.search.js';

export async function search(
  pool: Pool,
  query: SearchQuery,
): Promise<SearchResponse> {
  const [entities, docs] = await Promise.all([
    query.scope !== 'docs' ? searchEntities(pool, query) : [],
    query.scope !== 'entities' ? searchDocs(pool, query) : [],
  ]);

  const merged = [...entities, ...docs].sort((a, b) => b.score - a.score);
  const total = merged.length;
  const data = merged.slice(query.offset, query.offset + query.limit);

  return {
    data,
    pagination: { offset: query.offset, limit: query.limit, total },
    query: query.q,
    scope: query.scope,
  };
}
