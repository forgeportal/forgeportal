import type { Pool } from 'pg';

export interface ActionRunLogEntry {
  ts: Date;
  level: string;
  message: string;
}

export class ActionRunLogRepository {
  constructor(private readonly pool: Pool) {}

  async appendLog(
    runId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO action_run_logs (id, run_id, level, message)
       VALUES (gen_random_uuid(), $1, $2, $3)`,
      [runId, level, message],
    );
  }

  async getLogsForRun(runId: string): Promise<ActionRunLogEntry[]> {
    const result = await this.pool.query(
      `SELECT ts, level, message FROM action_run_logs
       WHERE run_id = $1 ORDER BY ts ASC`,
      [runId],
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      ts: new Date(row['ts'] as string),
      level: row['level'] as string,
      message: row['message'] as string,
    }));
  }
}
