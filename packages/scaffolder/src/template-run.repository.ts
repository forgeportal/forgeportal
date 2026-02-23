import type { Pool } from 'pg';
import type { StepOutputMap } from './template-engine.js';

export type TemplateRunStatus = 'running' | 'success' | 'failed' | 'canceled';

export interface TemplateRun {
  id:           string;
  template_id:  string;
  requested_by: string;
  status:       TemplateRunStatus;
  user_inputs:  Record<string, unknown>;
  step_outputs: StepOutputMap;
  current_step: string | null;
  created_at:   Date;
  finished_at:  Date | null;
}

function mapRow(row: Record<string, unknown>): TemplateRun {
  return {
    id:           row['id'] as string,
    template_id:  row['template_id'] as string,
    requested_by: row['requested_by'] as string,
    status:       row['status'] as TemplateRunStatus,
    user_inputs:  (row['user_inputs'] as Record<string, unknown>) ?? {},
    step_outputs: (row['step_outputs'] as StepOutputMap) ?? {},
    current_step: (row['current_step'] as string) ?? null,
    created_at:   new Date(row['created_at'] as string),
    finished_at:  row['finished_at'] ? new Date(row['finished_at'] as string) : null,
  };
}

export interface CreateTemplateRunInput {
  template_id:  string;
  requested_by: string;
  user_inputs:  Record<string, unknown>;
}

export interface TemplateRunFilters {
  requestedBy?: string;
  status?:      TemplateRunStatus;
  limit?:       number;
  offset?:      number;
}

export class TemplateRunRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: CreateTemplateRunInput): Promise<TemplateRun> {
    const result = await this.pool.query(
      `INSERT INTO template_runs (template_id, requested_by, user_inputs)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.template_id, data.requested_by, JSON.stringify(data.user_inputs)],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async getById(id: string): Promise<TemplateRun | null> {
    const result = await this.pool.query(
      'SELECT * FROM template_runs WHERE id = $1',
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Append a step's outputs to step_outputs using Postgres JSONB merge operator (||).
   * Also updates current_step to track progress.
   */
  async updateStepOutput(
    id:      string,
    stepId:  string,
    outputs: Record<string, unknown>,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE template_runs SET
         step_outputs = step_outputs || jsonb_build_object($2, jsonb_build_object('outputs', $3::jsonb)),
         current_step = $2
       WHERE id = $1`,
      [id, stepId, JSON.stringify(outputs)],
    );
  }

  async markSuccess(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE template_runs
       SET status = 'success', finished_at = now(), current_step = NULL
       WHERE id = $1`,
      [id],
    );
  }

  async markFailed(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE template_runs
       SET status = 'failed', finished_at = now()
       WHERE id = $1`,
      [id],
    );
  }

  async markCanceled(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE template_runs
       SET status = 'canceled', finished_at = now()
       WHERE id = $1`,
      [id],
    );
  }

  async list(
    filters: TemplateRunFilters,
  ): Promise<{ runs: TemplateRun[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.requestedBy) {
      conditions.push(`requested_by = $${idx++}`);
      params.push(filters.requestedBy);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = filters.limit  ?? 20;
    const offset = filters.offset ?? 0;

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM template_runs ${where}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM template_runs ${where}`,
        params,
      ),
    ]);

    return {
      runs:  dataResult.rows.map((r) => mapRow(r as Record<string, unknown>)),
      total: parseInt((countResult.rows[0] as { count: string })['count'], 10),
    };
  }
}
