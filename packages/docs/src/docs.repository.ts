import type { Pool } from 'pg';

export interface DocsBinding {
  entity_id: string;
  repo_url: string;
  docs_path: string;
  last_indexed_at: Date | null;
}

export interface DocsPageRecord {
  id: string;
  entity_id: string;
  path: string;
  title: string | null;
  content_text: string;
  content_hash: string;
  updated_at: Date;
}

export interface UpsertBindingInput {
  entityId: string;
  repoUrl: string;
  docsPath: string;
}

export interface UpsertPageInput {
  entityId: string;
  path: string;
  title: string | null;
  contentText: string;
  contentHash: string;
}

function mapBinding(row: Record<string, unknown>): DocsBinding {
  return {
    entity_id: row['entity_id'] as string,
    repo_url: row['repo_url'] as string,
    docs_path: row['docs_path'] as string,
    last_indexed_at: row['last_indexed_at']
      ? new Date(row['last_indexed_at'] as string)
      : null,
  };
}

function mapPage(row: Record<string, unknown>): DocsPageRecord {
  return {
    id: row['id'] as string,
    entity_id: row['entity_id'] as string,
    path: row['path'] as string,
    title: (row['title'] as string) ?? null,
    content_text: (row['content_text'] as string) ?? '',
    content_hash: (row['content_hash'] as string) ?? '',
    updated_at: new Date(row['updated_at'] as string),
  };
}

export class DocsRepository {
  constructor(private readonly pool: Pool) {}

  async getBinding(entityId: string): Promise<DocsBinding | null> {
    const result = await this.pool.query(
      'SELECT * FROM docs_bindings WHERE entity_id = $1',
      [entityId],
    );
    if (result.rows.length === 0) return null;
    return mapBinding(result.rows[0] as Record<string, unknown>);
  }

  async listPages(
    entityId: string,
  ): Promise<Pick<DocsPageRecord, 'path' | 'title'>[]> {
    const result = await this.pool.query(
      'SELECT path, title FROM docs_pages WHERE entity_id = $1 ORDER BY path',
      [entityId],
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      path: row['path'] as string,
      title: (row['title'] as string) ?? null,
    }));
  }

  async getAllPaths(entityId: string): Promise<string[]> {
    const result = await this.pool.query(
      'SELECT path FROM docs_pages WHERE entity_id = $1',
      [entityId],
    );
    return result.rows.map((row: Record<string, unknown>) => row['path'] as string);
  }

  async getContentHash(
    entityId: string,
    path: string,
  ): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT content_hash FROM docs_pages WHERE entity_id = $1 AND path = $2',
      [entityId, path],
    );
    if (result.rows.length === 0) return null;
    return (result.rows[0] as Record<string, unknown>)['content_hash'] as string;
  }

  async upsertPage(data: UpsertPageInput): Promise<DocsPageRecord> {
    const result = await this.pool.query(
      `INSERT INTO docs_pages (entity_id, path, title, content_text, content_hash, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (entity_id, path) DO UPDATE
         SET title        = EXCLUDED.title,
             content_text = EXCLUDED.content_text,
             content_hash = EXCLUDED.content_hash,
             updated_at   = now()
       RETURNING *`,
      [data.entityId, data.path, data.title, data.contentText, data.contentHash],
    );
    return mapPage(result.rows[0] as Record<string, unknown>);
  }

  async deletePages(entityId: string, paths: string[]): Promise<number> {
    if (paths.length === 0) return 0;
    const result = await this.pool.query(
      'DELETE FROM docs_pages WHERE entity_id = $1 AND path = ANY($2)',
      [entityId, paths],
    );
    return result.rowCount ?? 0;
  }

  async updateLastIndexedAt(entityId: string): Promise<void> {
    await this.pool.query(
      'UPDATE docs_bindings SET last_indexed_at = now() WHERE entity_id = $1',
      [entityId],
    );
  }

  async upsertBinding(data: UpsertBindingInput): Promise<DocsBinding> {
    const result = await this.pool.query(
      `INSERT INTO docs_bindings (entity_id, repo_url, docs_path)
       VALUES ($1, $2, $3)
       ON CONFLICT (entity_id) DO UPDATE
         SET repo_url  = EXCLUDED.repo_url,
             docs_path = EXCLUDED.docs_path
       RETURNING *`,
      [data.entityId, data.repoUrl, data.docsPath],
    );
    return mapBinding(result.rows[0] as Record<string, unknown>);
  }
}
