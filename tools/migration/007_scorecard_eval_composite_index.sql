-- 007_scorecard_eval_composite_index.sql
-- Add composite index for efficient TTL-based cache lookup on scorecard_evaluations.
-- The existing ix_score_eval_entity index is retained for entity-only scans.
BEGIN;

CREATE INDEX IF NOT EXISTS ix_score_eval_entity_sc
  ON scorecard_evaluations(entity_id, scorecard_id, evaluated_at DESC);

COMMIT;
