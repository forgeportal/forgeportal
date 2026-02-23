import type { Pool } from 'pg';
import type {
  ScorecardRow,
  EvaluationRow,
  EvaluationStatus,
  RuleResult,
} from './types.js';

function mapScorecardRow(row: Record<string, unknown>): ScorecardRow {
  return {
    id:              row['id'] as string,
    name:            row['name'] as string,
    applies_to_kind: row['applies_to_kind'] as string,
    version:         row['version'] as string,
    enabled:         row['enabled'] as boolean,
    definition:      row['definition'] as ScorecardRow['definition'],
    created_at:      row['created_at'] as Date,
  };
}

function mapEvalRow(row: Record<string, unknown>): EvaluationRow {
  return {
    id:                row['id'] as string,
    scorecard_id:      row['scorecard_id'] as string,
    entity_id:         row['entity_id'] as string,
    status:            row['status'] as EvaluationStatus,
    level:             row['level'] as string | null,
    results:           row['results'] as RuleResult[],
    evaluated_at:      row['evaluated_at'] as Date,
    cache_ttl_seconds: row['cache_ttl_seconds'] as number,
  };
}

export class ScorecardRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<ScorecardRow | null> {
    const res = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scorecards WHERE id = $1 AND enabled = true`,
      [id],
    );
    return res.rows[0] ? mapScorecardRow(res.rows[0]) : null;
  }

  async findLatestEvaluation(
    entityId:    string,
    scorecardId: string,
  ): Promise<EvaluationRow | null> {
    const res = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scorecard_evaluations
       WHERE entity_id = $1 AND scorecard_id = $2
       ORDER BY evaluated_at DESC
       LIMIT 1`,
      [entityId, scorecardId],
    );
    return res.rows[0] ? mapEvalRow(res.rows[0]) : null;
  }

  async findAll(): Promise<ScorecardRow[]> {
    const res = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scorecards WHERE enabled = true ORDER BY name`,
    );
    return res.rows.map(mapScorecardRow);
  }

  async findByKind(kind: string): Promise<ScorecardRow[]> {
    const res = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM scorecards WHERE applies_to_kind = $1 AND enabled = true ORDER BY name`,
      [kind],
    );
    return res.rows.map(mapScorecardRow);
  }

  async findLatestPerScorecardForEntity(entityId: string): Promise<EvaluationRow[]> {
    // DISTINCT ON: returns one row per scorecard_id — the one with the max evaluated_at
    const res = await this.pool.query<Record<string, unknown>>(
      `SELECT DISTINCT ON (scorecard_id) *
       FROM scorecard_evaluations
       WHERE entity_id = $1
       ORDER BY scorecard_id, evaluated_at DESC`,
      [entityId],
    );
    return res.rows.map(mapEvalRow);
  }

  async insertEvaluation(data: {
    scorecardId:      string;
    entityId:         string;
    status:           EvaluationStatus;
    level:            string | null;
    results:          RuleResult[];
    cacheTtlSeconds?: number;
  }): Promise<EvaluationRow> {
    const res = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO scorecard_evaluations
         (id, scorecard_id, entity_id, status, level, results, cache_ttl_seconds)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.scorecardId,
        data.entityId,
        data.status,
        data.level,
        JSON.stringify(data.results),
        data.cacheTtlSeconds ?? 3600,
      ],
    );
    return mapEvalRow(res.rows[0] as Record<string, unknown>);
  }
}
