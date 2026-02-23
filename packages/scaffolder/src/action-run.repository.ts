import crypto from 'node:crypto';
import type { Pool } from 'pg';

export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled';

export interface ActionRun {
  id: string;
  action_id: string | null;
  template_id: string | null;
  template_run_id: string | null;
  step_id: string | null;
  entity_id: string | null;
  requested_by: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  locked_by: string | null;
  locked_at: Date | null;
  retry_count: number;
  max_retries: number;
  idempotency_key: string | null;
  next_attempt_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

export interface CreateRunInput {
  action_id?: string;
  template_id?: string;
  template_run_id?: string;
  step_id?: string;
  entity_id?: string;
  requested_by: string;
  input: Record<string, unknown>;
  max_retries?: number;
  idempotency_key?: string;
}

function mapRun(row: Record<string, unknown>): ActionRun {
  return {
    id: row['id'] as string,
    action_id: (row['action_id'] as string) ?? null,
    template_id: (row['template_id'] as string) ?? null,
    template_run_id: (row['template_run_id'] as string) ?? null,
    step_id: (row['step_id'] as string) ?? null,
    entity_id: (row['entity_id'] as string) ?? null,
    requested_by: row['requested_by'] as string,
    status: row['status'] as RunStatus,
    input: (row['input'] as Record<string, unknown>) ?? {},
    output: (row['output'] as Record<string, unknown>) ?? {},
    locked_by: (row['locked_by'] as string) ?? null,
    locked_at: row['locked_at'] ? new Date(row['locked_at'] as string) : null,
    retry_count: (row['retry_count'] as number) ?? 0,
    max_retries: (row['max_retries'] as number) ?? 3,
    idempotency_key: (row['idempotency_key'] as string) ?? null,
    next_attempt_at: row['next_attempt_at']
      ? new Date(row['next_attempt_at'] as string)
      : null,
    started_at: row['started_at'] ? new Date(row['started_at'] as string) : null,
    finished_at: row['finished_at']
      ? new Date(row['finished_at'] as string)
      : null,
    created_at: new Date(row['created_at'] as string),
  };
}

export class ActionRunRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: CreateRunInput): Promise<ActionRun> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO action_runs
         (id, action_id, template_id, template_run_id, step_id,
          entity_id, requested_by, status, input, max_retries, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued', $8, $9, $10)
       RETURNING *`,
      [
        id,
        data.action_id ?? null,
        data.template_id ?? null,
        data.template_run_id ?? null,
        data.step_id ?? null,
        data.entity_id ?? null,
        data.requested_by,
        JSON.stringify(data.input),
        data.max_retries ?? 3,
        data.idempotency_key ?? null,
      ],
    );
    return mapRun(result.rows[0] as Record<string, unknown>);
  }

  async findByIdempotencyKey(key: string): Promise<ActionRun | null> {
    const result = await this.pool.query(
      `SELECT * FROM action_runs WHERE idempotency_key = $1 AND status = 'success' LIMIT 1`,
      [key],
    );
    if (result.rows.length === 0) return null;
    return mapRun(result.rows[0] as Record<string, unknown>);
  }

  /** Atomically claim the next queued run (FOR UPDATE SKIP LOCKED). */
  async claimNext(workerId: string): Promise<ActionRun | null> {
    const result = await this.pool.query(
      `WITH next AS (
         SELECT id FROM action_runs
         WHERE status = 'queued'
           AND (next_attempt_at IS NULL OR next_attempt_at <= now())
           AND (locked_by IS NULL OR locked_at < now() - interval '5 minutes')
         ORDER BY created_at
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE action_runs SET
         status = 'running',
         locked_by = $1,
         locked_at = now(),
         started_at = COALESCE(started_at, now())
       FROM next
       WHERE action_runs.id = next.id
       RETURNING action_runs.*`,
      [workerId],
    );
    if (result.rows.length === 0) return null;
    return mapRun(result.rows[0] as Record<string, unknown>);
  }

  async markSuccess(
    runId: string,
    output: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE action_runs SET
         status = 'success',
         output = $2,
         locked_by = NULL,
         finished_at = now()
       WHERE id = $1`,
      [runId, JSON.stringify(output)],
    );
  }

  async markFailedOrRetry(
    runId: string,
    error: string,
    run: ActionRun,
  ): Promise<void> {
    if (run.retry_count < run.max_retries) {
      const backoffSeconds = Math.min(
        Math.pow(2, run.retry_count) * 30,
        600,
      );
      await this.pool.query(
        `UPDATE action_runs SET
           status = 'queued',
           retry_count = retry_count + 1,
           locked_by = NULL,
           locked_at = NULL,
           next_attempt_at = now() + ($1 * interval '1 second')
         WHERE id = $2`,
        [backoffSeconds, runId],
      );
    } else {
      await this.pool.query(
        `UPDATE action_runs SET
           status = 'failed',
           output = $2,
           locked_by = NULL,
           finished_at = now()
         WHERE id = $1`,
        [runId, JSON.stringify({ error })],
      );
    }
  }

  async cancel(runId: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE action_runs SET status = 'canceled', finished_at = now()
       WHERE id = $1 AND status = 'queued'`,
      [runId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getById(runId: string): Promise<ActionRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM action_runs WHERE id = $1',
      [runId],
    );
    if (result.rows.length === 0) return null;
    return mapRun(result.rows[0] as Record<string, unknown>);
  }

  async listByEntity(entityId: string, limit = 20): Promise<ActionRun[]> {
    const result = await this.pool.query(
      `SELECT * FROM action_runs WHERE entity_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [entityId, limit],
    );
    return result.rows.map((r) => mapRun(r as Record<string, unknown>));
  }

  async listByUser(requestedBy: string, limit = 20): Promise<ActionRun[]> {
    const result = await this.pool.query(
      `SELECT * FROM action_runs WHERE requested_by = $1
       ORDER BY created_at DESC LIMIT $2`,
      [requestedBy, limit],
    );
    return result.rows.map((r) => mapRun(r as Record<string, unknown>));
  }

  async countRecentByUser(requestedBy: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM action_runs
       WHERE requested_by = $1
         AND created_at > now() - interval '1 minute'`,
      [requestedBy],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }
}
