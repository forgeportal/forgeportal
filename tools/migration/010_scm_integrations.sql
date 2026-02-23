-- Admin UI: SCM integrations managed via /api/v1/admin/integrations.
-- Secrets (tokens, keys) are stored encrypted (AES-256-GCM) and never returned in plain text.
CREATE TABLE IF NOT EXISTS scm_integrations (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
  name          TEXT NOT NULL,
  base_url      TEXT,
  app_id        TEXT,
  secret_config JSONB NOT NULL DEFAULT '{}',   -- encrypted values keyed by field name
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scm_integrations_provider_name_idx ON scm_integrations (provider, name);
