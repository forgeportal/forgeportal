import type { Pool } from 'pg';
import type { SearchResultItem, DocMeta } from './types.js';
import type { SearchQuery } from './search.schema.js';

export async function searchDocs(
  pool: Pool,
  query: SearchQuery,
): Promise<SearchResultItem[]> {
  const sql = `
    SELECT
      dp.id,
      coalesce(dp.title, dp.path)                            AS title,
      dp.entity_id,
      dp.path,
      ts_rank(dp.content_tsv, plainto_tsquery('english', $1)) AS score,
      ts_headline(
        'english',
        dp.content_text,
        plainto_tsquery('english', $1),
        'MaxWords=20,MinWords=8,ShortWord=3,HighlightAll=false,MaxFragments=1'
      )                                                       AS excerpt
    FROM docs_pages dp
    WHERE dp.content_tsv @@ plainto_tsquery('english', $1)
    ORDER BY score DESC
  `;

  const result = await pool.query(sql, [query.q]);

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const entityId = r['entity_id'] as string;
    const path = r['path'] as string;
    const meta: DocMeta = { entity_id: entityId, path };
    return {
      type: 'doc' as const,
      id: r['id'] as string,
      title: r['title'] as string,
      excerpt: (r['excerpt'] as string) ?? '',
      url: `/catalog/${entityId}/docs?path=${encodeURIComponent(path)}`,
      score: Number(r['score']),
      meta,
    };
  });
}
