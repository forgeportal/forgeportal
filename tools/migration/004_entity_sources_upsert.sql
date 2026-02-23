-- 004_entity_sources_upsert.sql
-- Unique index for entity_sources upsert (ON CONFLICT)

BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_sources_entity_provider_repo
  ON entity_sources(entity_id, provider, repo_url);
COMMIT;
