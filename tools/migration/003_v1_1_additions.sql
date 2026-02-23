-- 003_v1_1_additions.sql
-- ForgePortal V1.1: action_runs lock columns, entity FTS, jobs table

BEGIN;

-- =========================
-- action_runs: locking and retry columns
-- =========================
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE action_runs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ux_runs_idempotency
  ON action_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- =========================
-- entities: full-text search
-- =========================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS search_tsv tsvector;

CREATE INDEX IF NOT EXISTS ix_entities_tsv ON entities USING GIN(search_tsv);

CREATE OR REPLACE FUNCTION entities_update_tsv() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv = to_tsvector('english',
    coalesce(NEW.name,'') || ' ' || coalesce(NEW.kind,'') || ' '
    || coalesce(NEW.owner_ref,'') || ' ' || coalesce(NEW.tags::text,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entities_tsv ON entities;
CREATE TRIGGER trg_entities_tsv
  BEFORE INSERT OR UPDATE OF name, kind, owner_ref, tags ON entities
  FOR EACH ROW EXECUTE FUNCTION entities_update_tsv();

-- =========================
-- jobs: background task queue
-- =========================
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'queued',
  locked_by     TEXT,
  locked_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_jobs_status ON jobs(status, created_at);

COMMIT;
