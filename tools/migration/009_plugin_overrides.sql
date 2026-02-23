-- Admin UI: persist plugin enable/disable overrides (PATCH /api/v1/admin/plugins/:id).
-- Overrides are applied at startup; restart required after toggle.
CREATE TABLE IF NOT EXISTS plugin_overrides (
  plugin_id  TEXT PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
