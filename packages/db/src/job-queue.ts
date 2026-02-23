import type { Pool } from 'pg';

export interface JobRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'success' | 'failed';
  locked_by: string | null;
  locked_at: Date | null;
  created_at: Date;
  finished_at: Date | null;
}

function mapJobRow(row: Record<string, unknown>): JobRow {
  return {
    id: row['id'] as string,
    type: row['type'] as string,
    payload: (row['payload'] as Record<string, unknown>) ?? {},
    status: row['status'] as JobRow['status'],
    locked_by: (row['locked_by'] as string) ?? null,
    locked_at: (row['locked_at'] as Date) ?? null,
    created_at: row['created_at'] as Date,
    finished_at: (row['finished_at'] as Date) ?? null,
  };
}

export async function enqueueJob(
  pool: Pool,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<JobRow> {
  const result = await pool.query(
    `INSERT INTO jobs (type, payload, status)
     VALUES ($1, $2, 'queued')
     RETURNING *`,
    [type, JSON.stringify(payload)],
  );
  return mapJobRow(result.rows[0] as Record<string, unknown>);
}

export async function claimJob(
  pool: Pool,
  types: string[],
  workerId: string,
): Promise<JobRow | null> {
  const result = await pool.query(
    `WITH next AS (
       SELECT id FROM jobs
       WHERE status = 'queued' AND type = ANY($1)
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE jobs SET
       status = 'running',
       locked_by = $2,
       locked_at = now()
     FROM next
     WHERE jobs.id = next.id
     RETURNING jobs.*`,
    [types, workerId],
  );
  if (result.rows.length === 0) return null;
  return mapJobRow(result.rows[0] as Record<string, unknown>);
}

export async function completeJob(
  pool: Pool,
  jobId: string,
  status: 'success' | 'failed',
): Promise<void> {
  await pool.query(
    `UPDATE jobs SET status = $2, finished_at = now() WHERE id = $1`,
    [jobId, status],
  );
}

export async function getLatestJob(
  pool: Pool,
  type: string,
): Promise<JobRow | null> {
  const result = await pool.query(
    `SELECT * FROM jobs WHERE type = $1 ORDER BY created_at DESC LIMIT 1`,
    [type],
  );
  if (result.rows.length === 0) return null;
  return mapJobRow(result.rows[0] as Record<string, unknown>);
}

export async function listJobsByType(
  pool: Pool,
  type: string,
  limit: number = 20,
): Promise<JobRow[]> {
  const result = await pool.query(
    `SELECT * FROM jobs WHERE type = $1 ORDER BY created_at DESC LIMIT $2`,
    [type, limit],
  );
  return result.rows.map((row) => mapJobRow(row as Record<string, unknown>));
}
