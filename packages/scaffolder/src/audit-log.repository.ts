import type { Pool } from 'pg';

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ts: Date;
}

export interface CreateAuditLogInput {
  actor: string;
  action: string;
  target_type: string;
  target_id?: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogFilters {
  targetId?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}

function mapEntry(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: row['id'] as string,
    actor: row['actor'] as string,
    action: row['action'] as string,
    target_type: row['target_type'] as string,
    target_id: (row['target_id'] as string) ?? null,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    ts: new Date(row['ts'] as string),
  };
}

export class AuditLogRepository {
  constructor(private readonly pool: Pool) {}

  /** Append-only: never UPDATE or DELETE. */
  async append(data: CreateAuditLogInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (id, actor, action, target_type, target_id, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [
        data.actor,
        data.action,
        data.target_type,
        data.target_id ?? null,
        JSON.stringify(data.metadata),
      ],
    );
  }

  async list(
    filters: AuditLogFilters = {},
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const result = await this.pool.query(
      `SELECT * FROM audit_logs
       WHERE ($1::TEXT IS NULL OR target_id = $1)
         AND ($2::TEXT IS NULL OR actor = $2)
       ORDER BY ts DESC
       LIMIT $3 OFFSET $4`,
      [filters.targetId ?? null, filters.actor ?? null, limit, offset],
    );

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_logs
       WHERE ($1::TEXT IS NULL OR target_id = $1)
         AND ($2::TEXT IS NULL OR actor = $2)`,
      [filters.targetId ?? null, filters.actor ?? null],
    );

    return {
      entries: result.rows.map((r) => mapEntry(r as Record<string, unknown>)),
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
    };
  }

  async getById(id: string): Promise<AuditLogEntry | null> {
    const result = await this.pool.query(
      'SELECT * FROM audit_logs WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapEntry(result.rows[0] as Record<string, unknown>);
  }
}
