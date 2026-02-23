import type { Pool } from 'pg';
import type { SearchResultItem, EntityMeta } from './types.js';
import type { SearchQuery } from './search.schema.js';

export async function searchEntities(
  pool: Pool,
  query: SearchQuery,
): Promise<SearchResultItem[]> {
  const sql = `
    SELECT
      e.id,
      e.name                                                AS title,
      e.kind,
      e.namespace,
      e.owner_ref,
      e.lifecycle,
      ts_rank(e.search_tsv, plainto_tsquery('english', $1)) AS score,
      ts_headline(
        'english',
        coalesce(e.name,'') || ' ' || coalesce(e.kind,'') || ' ' || coalesce(e.owner_ref,''),
        plainto_tsquery('english', $1),
        'MaxWords=15,MinWords=5,ShortWord=3,HighlightAll=false,MaxFragments=1'
      )                                                     AS excerpt
    FROM entities e
    WHERE e.search_tsv @@ plainto_tsquery('english', $1)
    ORDER BY score DESC
  `;

  const result = await pool.query(sql, [query.q]);

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const meta: EntityMeta = {
      kind: r['kind'] as string,
      namespace: r['namespace'] as string,
      name: r['title'] as string,
      owner_ref: (r['owner_ref'] as string) ?? null,
      lifecycle: (r['lifecycle'] as string) ?? null,
    };
    return {
      type: 'entity' as const,
      id: r['id'] as string,
      title: r['title'] as string,
      excerpt: (r['excerpt'] as string) ?? '',
      url: `/catalog/${r['id']}`,
      score: Number(r['score']),
      meta,
    };
  });
}
