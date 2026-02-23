-- 008_jobs_payload_index.sql
-- GIN index on jobs.payload for efficient JSONB field lookups used by the
-- scorecard-eval dedup check (payload->>'entityId', payload->>'scorecardId').
BEGIN;

CREATE INDEX IF NOT EXISTS ix_jobs_payload
  ON jobs USING GIN(payload);

COMMIT;
