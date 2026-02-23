-- 001_init.sql
-- ForgePortal V1 schema (PostgreSQL)

BEGIN;

-- =========================
-- Catalog
-- =========================
CREATE TABLE IF NOT EXISTS entities (
  id               UUID PRIMARY KEY,
  kind             TEXT NOT NULL,
  namespace        TEXT NOT NULL DEFAULT 'default',
  name             TEXT NOT NULL,
  owner_ref        TEXT,
  lifecycle        TEXT,
  tags             JSONB NOT NULL DEFAULT '[]'::jsonb,
  links            JSONB NOT NULL DEFAULT '[]'::jsonb,
  scm              JSONB NOT NULL DEFAULT '{}'::jsonb,
  spec             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_entities_kind_ns_name
  ON entities(kind, namespace, name);

CREATE INDEX IF NOT EXISTS ix_entities_owner_ref
  ON entities(owner_ref);

CREATE INDEX IF NOT EXISTS ix_entities_lifecycle
  ON entities(lifecycle);

CREATE TABLE IF NOT EXISTS entity_relations (
  id               UUID PRIMARY KEY,
  from_entity_id   UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  to_entity_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_rel_from
  ON entity_relations(from_entity_id);

CREATE INDEX IF NOT EXISTS ix_rel_to
  ON entity_relations(to_entity_id);

CREATE INDEX IF NOT EXISTS ix_rel_type
  ON entity_relations(type);

CREATE TABLE IF NOT EXISTS entity_sources (
  id               UUID PRIMARY KEY,
  entity_id        UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,                -- github | gitlab
  repo_url         TEXT NOT NULL,
  path             TEXT NOT NULL DEFAULT '/',
  last_seen_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_sources_repo
  ON entity_sources(repo_url);

-- =========================
-- Docs
-- =========================
CREATE TABLE IF NOT EXISTS docs_bindings (
  entity_id        UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  repo_url         TEXT NOT NULL,
  docs_path        TEXT NOT NULL DEFAULT 'docs',
  last_indexed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS docs_pages (
  id              UUID PRIMARY KEY,
  entity_id       UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  path            TEXT NOT NULL,
  title           TEXT,
  content_text    TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_docs_pages_entity_path
  ON docs_pages(entity_id, path);

-- FTS (simple V1)
ALTER TABLE docs_pages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector;

CREATE INDEX IF NOT EXISTS ix_docs_pages_tsv
  ON docs_pages USING GIN(content_tsv);

-- =========================
-- Scorecards
-- =========================
CREATE TABLE IF NOT EXISTS scorecards (
  id               UUID PRIMARY KEY,
  name             TEXT NOT NULL,
  applies_to_kind  TEXT NOT NULL,                -- service/library/...
  version          TEXT NOT NULL,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  definition       JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_scorecards_name_kind_version
  ON scorecards(name, applies_to_kind, version);

CREATE TABLE IF NOT EXISTS scorecard_evaluations (
  id               UUID PRIMARY KEY,
  scorecard_id     UUID NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  entity_id        UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  status           TEXT NOT NULL,                -- success|failed|partial
  level            TEXT,                         -- bronze|silver|gold
  results          JSONB NOT NULL,
  evaluated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cache_ttl_seconds INT NOT NULL DEFAULT 3600
);

CREATE INDEX IF NOT EXISTS ix_score_eval_entity
  ON scorecard_evaluations(entity_id, evaluated_at DESC);

-- =========================
-- Templates / Actions / Runs
-- =========================
CREATE TABLE IF NOT EXISTS templates (
  id               UUID PRIMARY KEY,
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  schema           JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_templates_name_version
  ON templates(name, version);

CREATE TABLE IF NOT EXISTS actions (
  id               UUID PRIMARY KEY,
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  definition       JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_actions_name_version
  ON actions(name, version);

CREATE TABLE IF NOT EXISTS action_runs (
  id               UUID PRIMARY KEY,
  action_id        UUID REFERENCES actions(id) ON DELETE SET NULL,
  template_id      UUID REFERENCES templates(id) ON DELETE SET NULL,
  entity_id        UUID REFERENCES entities(id) ON DELETE SET NULL,
  requested_by     TEXT NOT NULL,
  status           TEXT NOT NULL,                -- queued|running|success|failed|canceled
  input            JSONB NOT NULL DEFAULT '{}'::jsonb,
  output           JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_runs_status_created
  ON action_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_runs_requested_by
  ON action_runs(requested_by, created_at DESC);

CREATE TABLE IF NOT EXISTS action_run_logs (
  id               UUID PRIMARY KEY,
  run_id           UUID NOT NULL REFERENCES action_runs(id) ON DELETE CASCADE,
  ts               TIMESTAMPTZ NOT NULL DEFAULT now(),
  level            TEXT NOT NULL,                -- debug|info|warn|error
  message          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_run_logs_run_ts
  ON action_run_logs(run_id, ts);

-- =========================
-- Integrations / Permissions / Audit
-- =========================
CREATE TABLE IF NOT EXISTS integrations (
  id               UUID PRIMARY KEY,
  type             TEXT NOT NULL,                -- scm.github | scm.gitlab | oidc
  name             TEXT NOT NULL,
  config           JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_ref       TEXT,                         -- pointer to K8s secret / vault path
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integrations_type_name
  ON integrations(type, name);

CREATE TABLE IF NOT EXISTS permissions (
  id               UUID PRIMARY KEY,
  subject_ref      TEXT NOT NULL,                -- user:... | team:... | role:...
  role             TEXT NOT NULL,                -- platform-admin | template-admin | ...
  scope            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_permissions_subject
  ON permissions(subject_ref);

CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID PRIMARY KEY,
  actor            TEXT NOT NULL,
  action           TEXT NOT NULL,
  target_type      TEXT NOT NULL,
  target_id        TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_audit_ts
  ON audit_logs(ts DESC);

COMMIT;