BEGIN;

-- Template run tracking (parent for a multi-step template execution)
CREATE TABLE IF NOT EXISTS template_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  requested_by  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running',  -- running|success|failed|canceled
  user_inputs   JSONB NOT NULL DEFAULT '{}',       -- original user-provided params
  step_outputs  JSONB NOT NULL DEFAULT '{}',       -- { "step-id": { outputs: {...} } }
  current_step  TEXT,                              -- id of the currently running step
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_template_runs_status
  ON template_runs(status, created_at DESC);

-- Link action_runs to a template run + record the step id
ALTER TABLE action_runs
  ADD COLUMN IF NOT EXISTS template_run_id UUID REFERENCES template_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_id TEXT;   -- e.g., "create-repo"

CREATE INDEX IF NOT EXISTS ix_action_runs_template_run
  ON action_runs(template_run_id) WHERE template_run_id IS NOT NULL;

COMMIT;
