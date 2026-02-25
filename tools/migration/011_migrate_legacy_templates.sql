-- 011_migrate_legacy_templates.sql
-- Migrate forge-fix-file template from the legacy flat format
-- (parameters/steps at root level) to the forgeportal/v1 format
-- expected by TemplateOrchestrator (parameters/steps inside spec).
--
-- Also fixes {{inputs.X}} variable references to {{X}} to match
-- the buildStepContext output: { ...userInputs, steps: {} }.
--
-- Safe to run on fresh installs: the WHERE condition uses
-- (schema->'spec'->'steps') IS NULL to detect the legacy format only.
-- Already-migrated rows are untouched (idempotent).
BEGIN;

UPDATE templates
SET schema = '{
  "apiVersion": "forgeportal/v1",
  "kind": "Template",
  "metadata": {
    "name": "forge-fix-file",
    "title": "Fix: Create File + Open PR",
    "description": "Internal template used by the scorecard fix flow. Creates a missing file on a fix branch and opens a PR.",
    "tags": []
  },
  "spec": {
    "parameters": [],
    "steps": [
      {
        "id": "create-file",
        "action": "scm.createOrUpdateFile@v1",
        "input": {
          "provider":      "{{provider}}",
          "owner":         "{{owner}}",
          "repo":          "{{repo}}",
          "defaultBranch": "{{defaultBranch}}",
          "path":          "{{path}}",
          "contentBase64": "{{contentBase64}}",
          "message":       "{{commitMessage}}",
          "branch":        "{{branch}}"
        }
      },
      {
        "id": "open-pr",
        "action": "scm.openPrOrMr@v1",
        "input": {
          "provider":   "{{provider}}",
          "owner":      "{{owner}}",
          "repo":       "{{repo}}",
          "headBranch": "{{branch}}",
          "baseBranch": "{{defaultBranch}}",
          "title":      "{{prTitle}}",
          "body":       "{{prBody}}"
        }
      }
    ]
  }
}'::jsonb
WHERE name    = 'forge-fix-file'
  AND version = 'v1'
  AND (schema->'spec'->'steps') IS NULL;

COMMIT;
