import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { EntitySourceRow } from './entity.types.js';

export interface UpsertSourceInput {
  entity_id: string;
  provider: string;
  repo_url: string;
  path?: string;
}

function mapSourceRow(row: Record<string, unknown>): EntitySourceRow {
  return {
    id: row['id'] as string,
    entity_id: row['entity_id'] as string,
    provider: row['provider'] as string,
    repo_url: row['repo_url'] as string,
    path: row['path'] as string,
    last_seen_at: (row['last_seen_at'] as Date) ?? null,
    created_at: row['created_at'] as Date,
    updated_at: row['updated_at'] as Date,
  };
}

export class SourceRepository {
  constructor(private readonly pool: Pool) {}

  async getSourcesForEntity(entityId: string): Promise<EntitySourceRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM entity_sources WHERE entity_id = $1`,
      [entityId],
    );
    return result.rows.map((r) =>
      mapSourceRow(r as Record<string, unknown>),
    );
  }

  async upsertSource(data: UpsertSourceInput): Promise<EntitySourceRow> {
    const id = crypto.randomUUID();
    const path = data.path ?? '/';
    const result = await this.pool.query(
      `INSERT INTO entity_sources (id, entity_id, provider, repo_url, path)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity_id, provider, repo_url)
       DO UPDATE SET path = EXCLUDED.path, updated_at = now()
       RETURNING *`,
      [id, data.entity_id, data.provider, data.repo_url, path],
    );
    return mapSourceRow(result.rows[0] as Record<string, unknown>);
  }
}
