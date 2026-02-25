-- 012_entity_annotations.sql
-- Add annotations column to entities table.
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS on index).

BEGIN;

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS annotations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- GIN index for annotation key/value containment queries:
--   WHERE annotations @> '{"forgeportal.dev/k8s-label-selector": "app=foo"}'
CREATE INDEX IF NOT EXISTS ix_entities_annotations
  ON entities USING GIN (annotations);

COMMIT;
