-- 002_triggers.sql
-- ForgePortal V1 triggers: updated_at maintenance + docs FTS vector maintenance

BEGIN;

-- =========================
-- Generic updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entities' AND column_name='updated_at') THEN
    DROP TRIGGER IF EXISTS trg_entities_updated_at ON entities;
    CREATE TRIGGER trg_entities_updated_at
      BEFORE UPDATE ON entities
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entity_sources' AND column_name='updated_at') THEN
    DROP TRIGGER IF EXISTS trg_entity_sources_updated_at ON entity_sources;
    CREATE TRIGGER trg_entity_sources_updated_at
      BEFORE UPDATE ON entity_sources
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- =========================
-- Docs FTS vector maintenance
-- =========================
-- Keep docs_pages.content_tsv updated.
-- NOTE: We use english config by default. If you need French, switch to 'french'.
-- (Postgres ships built-in text search configurations; english/french availability is standard.)
CREATE OR REPLACE FUNCTION docs_pages_update_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_tsv =
    to_tsvector('english',
      coalesce(NEW.title,'') || ' ' || coalesce(NEW.path,'') || ' ' || coalesce(NEW.content_text,'')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_docs_pages_tsv ON docs_pages;
CREATE TRIGGER trg_docs_pages_tsv
  BEFORE INSERT OR UPDATE OF title, path, content_text ON docs_pages
  FOR EACH ROW
  EXECUTE FUNCTION docs_pages_update_tsv();

-- One-time backfill in case docs_pages already has data
UPDATE docs_pages
SET content_tsv = to_tsvector('english',
  coalesce(title,'') || ' ' || coalesce(path,'') || ' ' || coalesce(content_text,'')
)
WHERE content_tsv IS NULL;

COMMIT;