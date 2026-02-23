-- seed_v1.sql
-- Minimal runnable data: default actions, one scorecard, two templates.
-- Run after tools/migration/001_init.sql and 002_triggers.sql.
-- Requires pgcrypto for gen_random_uuid()
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------
-- Actions (10 built-ins)
-- -------------------------
INSERT INTO actions (id, name, version, definition, created_at)
VALUES
  (
    gen_random_uuid(), 'scm.createRepo', 'v1',
    '{
      "title": "scm.createRepo@v1",
      "description": "Create GitHub repo or GitLab project",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo"],
        "properties": {
          "provider":       { "type": "string", "enum": ["github", "gitlab"] },
          "owner":          { "type": "string" },
          "repo":           { "type": "string" },
          "visibility":     { "type": "string", "enum": ["private", "internal", "public"], "default": "private" },
          "description":    { "type": "string", "default": "" },
          "initWithReadme": { "type": "boolean", "default": false }
        }
      },
      "output": {
        "properties": {
          "repoUrl":       { "type": "string" },
          "defaultBranch": { "type": "string" }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'scm.createOrUpdateFile', 'v1',
    '{
      "title": "scm.createOrUpdateFile@v1",
      "description": "Write a single file to a repo branch",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo", "path", "contentBase64", "message"],
        "properties": {
          "provider":      { "type": "string", "enum": ["github", "gitlab"] },
          "owner":         { "type": "string" },
          "repo":          { "type": "string" },
          "defaultBranch": { "type": "string", "default": "main" },
          "path":          { "type": "string" },
          "contentBase64": { "type": "string" },
          "message":       { "type": "string" },
          "branch":        { "type": "string" },
          "expectedSha":   { "type": "string" }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'scm.pushSkeleton', 'v1',
    '{
      "title": "scm.pushSkeleton@v1",
      "description": "Write multiple files to a repo branch",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo", "files"],
        "properties": {
          "provider": { "type": "string", "enum": ["github", "gitlab"] },
          "owner":    { "type": "string" },
          "repo":     { "type": "string" },
          "branch":   { "type": "string", "default": "main" },
          "message":  { "type": "string", "default": "chore: scaffold files" },
          "files":    {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["path", "contentBase64"],
              "properties": {
                "path":          { "type": "string" },
                "contentBase64": { "type": "string" }
              }
            }
          }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'scm.openPrOrMr', 'v1',
    '{
      "title": "scm.openPrOrMr@v1",
      "description": "Open a pull request or merge request",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo", "headBranch", "baseBranch", "title"],
        "properties": {
          "provider":   { "type": "string", "enum": ["github", "gitlab"] },
          "owner":      { "type": "string" },
          "repo":       { "type": "string" },
          "headBranch": { "type": "string" },
          "baseBranch": { "type": "string" },
          "title":      { "type": "string" },
          "body":       { "type": "string", "default": "" }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'scm.ensureWebhook', 'v1',
    '{
      "title": "scm.ensureWebhook@v1",
      "description": "Ensure a webhook exists on a repo",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo", "callbackUrl"],
        "properties": {
          "provider":    { "type": "string", "enum": ["github", "gitlab"] },
          "owner":       { "type": "string" },
          "repo":        { "type": "string" },
          "callbackUrl": { "type": "string" },
          "events":      { "type": "array", "items": { "type": "string" }, "default": ["push"] }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'catalog.registerEntity', 'v1',
    '{
      "title": "catalog.registerEntity@v1",
      "description": "Upsert an entity in the catalog",
      "parameters": {
        "type": "object",
        "required": ["entity"],
        "properties": {
          "entity": {
            "type": "object",
            "required": ["kind", "name"],
            "properties": {
              "kind":      { "type": "string" },
              "namespace": { "type": "string", "default": "default" },
              "name":      { "type": "string" },
              "ownerRef":  { "type": "string" },
              "lifecycle": { "type": "string" },
              "tags":      { "type": "array", "items": { "type": "string" } },
              "links":     { "type": "array" },
              "scm":       { "type": "object" },
              "spec":      { "type": "object" }
            }
          },
          "source": { "type": "object" }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'docs.bootstrap', 'v1',
    '{
      "title": "docs.bootstrap@v1",
      "description": "Create docs skeleton and bind docs path for an entity",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo"],
        "properties": {
          "provider": { "type": "string", "enum": ["github", "gitlab"] },
          "owner":    { "type": "string" },
          "repo":     { "type": "string" },
          "branch":   { "type": "string", "default": "main" },
          "docsPath": { "type": "string", "default": "docs" },
          "entityId": { "type": "string" }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'ci.bootstrap', 'v1',
    '{
      "title": "ci.bootstrap@v1",
      "description": "Add CI pipeline configuration to a repo",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo", "type"],
        "properties": {
          "provider":     { "type": "string", "enum": ["github", "gitlab"] },
          "owner":        { "type": "string" },
          "repo":         { "type": "string" },
          "type":         { "type": "string", "enum": ["github-actions", "gitlab-ci"] },
          "language":     { "type": "string", "enum": ["node", "java", "go", "python", "other"], "default": "node" },
          "buildCommand": { "type": "string" },
          "testCommand":  { "type": "string" }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'k8s.bootstrap', 'v1',
    '{
      "title": "k8s.bootstrap@v1",
      "description": "Add Kubernetes manifest or Helm chart skeleton to a repo",
      "parameters": {
        "type": "object",
        "required": ["provider", "owner", "repo", "mode", "name"],
        "properties": {
          "provider":    { "type": "string", "enum": ["github", "gitlab"] },
          "owner":       { "type": "string" },
          "repo":        { "type": "string" },
          "mode":        { "type": "string", "enum": ["manifests", "helm"] },
          "name":        { "type": "string" },
          "namespace":   { "type": "string", "default": "default" },
          "servicePort": { "type": "integer", "default": 8080 },
          "image":       { "type": "string" },
          "replicas":    { "type": "integer", "default": 1 }
        }
      }
    }'::jsonb, now()
  ),
  (
    gen_random_uuid(), 'scorecards.evaluate', 'v1',
    '{
      "title": "scorecards.evaluate@v1",
      "description": "Evaluate a scorecard for an entity (with cache)",
      "parameters": {
        "type": "object",
        "required": ["entityId", "scorecardId"],
        "properties": {
          "entityId":    { "type": "string" },
          "scorecardId": { "type": "string" },
          "force":       { "type": "boolean", "default": false }
        }
      }
    }'::jsonb, now()
  )
ON CONFLICT (name, version) DO UPDATE SET definition = EXCLUDED.definition;

-- -------------------------
-- Scorecard (default)
-- -------------------------
-- A simple "Service maturity" scorecard with levels Bronze/Silver/Gold.
INSERT INTO scorecards (id, name, applies_to_kind, version, enabled, definition, created_at)
VALUES
(
  gen_random_uuid(),
  'service-maturity',
  'service',
  'v1',
  true,
  '{
    "name": "service-maturity",
    "levels": ["Bronze","Silver","Gold"],
    "rules": [
      {
        "id": "owner",
        "title": "Owner is set",
        "level": "Bronze",
        "type": "entity.field.exists",
        "params": {"field": "owner_ref"}
      },
      {
        "id": "readme",
        "title": "README.md exists",
        "level": "Bronze",
        "type": "scm.file.exists",
        "params": {"path": "README.md"},
        "fixAction": {
          "actionId": "scm.createOrUpdateFile@v1",
          "suggestedInputs": {
            "path": "README.md",
            "message": "[ForgePortal] Add README.md"
          }
        }
      },
      {
        "id": "runbook",
        "title": "Runbook link exists",
        "level": "Silver",
        "type": "entity.link.exists",
        "params": {"titleContains": "runbook"}
      },
      {
        "id": "ci",
        "title": "CI configured",
        "level": "Silver",
        "type": "scm.anyOf",
        "params": {"paths": [".github/workflows/ci.yml",".gitlab-ci.yml"]},
        "fixAction": {
          "actionId": "ci.bootstrap@v1",
          "suggestedInputs": {
            "type": "github-actions",
            "language": "node"
          }
        }
      },
      {
        "id": "docs",
        "title": "Docs homepage exists",
        "level": "Gold",
        "type": "scm.anyOf",
        "params": {"paths": ["docs/index.md","docs/README.md"]},
        "fixAction": {
          "actionId": "docs.bootstrap@v1",
          "suggestedInputs": {
            "docsPath": "docs"
          }
        }
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (name, applies_to_kind, version) DO NOTHING;

-- -------------------------
-- Templates (2 examples — forgeportal/v1 format)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES
(
  gen_random_uuid(),
  'spring-boot-service',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "spring-boot-service",
      "title": "Spring Boot Service",
      "description": "Bootstrap a Spring Boot microservice with CI, docs, and catalog registration.",
      "tags": ["java", "spring-boot", "service"]
    },
    "spec": {
      "parameters": [
        { "id": "name",        "title": "Service Name", "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$", "description": "Lowercase name used for repo and entity" },
        { "id": "owner",       "title": "Owning Team",  "type": "string",  "required": true,  "description": "e.g. team:payments" },
        { "id": "provider",    "title": "SCM Provider", "type": "string",  "required": true,  "enum": ["github", "gitlab"] },
        { "id": "ownerGroup",  "title": "Org / Group",  "type": "string",  "required": true,  "description": "GitHub org or GitLab group" },
        { "id": "description", "title": "Description",  "type": "string",  "required": false, "default": "" }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "visibility": "private", "description": "{{description}}" }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "branch": "main",
            "message": "feat: bootstrap {{name}}",
            "files": [
              { "path": "README.md",     "contentBase64": "IyB7e25hbWV9fQoKPiB7e2Rlc2NyaXB0aW9ufX0KCiMjIEdldHRpbmcgU3RhcnRlZAoKYGBgYmFzaApteG4gc3ByaW5nLWJvb3Q6cnVuCmBgYAo=" },
              { "path": "docs/index.md", "contentBase64": "IyB7e25hbWV9fSBEb2N1bWVudGF0aW9uCgojIyBPdmVydmlldwoKe3tkZXNjcmlwdGlvbn19Cg==" },
              { "path": "entity.yaml",   "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogc2VydmljZQptZXRhZGF0YToKICBuYW1lOiB7e25hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdApzcGVjOgogIG93bmVyOiB7e293bmVyfX0KICBsaWZlY3ljbGU6IGV4cGVyaW1lbnRhbAo=" }
            ]
          }
        },
        {
          "id": "bootstrap-ci",
          "action": "ci.bootstrap@v1",
          "input": {
            "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}",
            "type": "{{#if (eq provider \"github\")}}github-actions{{else}}gitlab-ci{{/if}}",
            "language": "java"
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "service", "name": "{{name}}", "ownerRef": "{{owner}}",
              "lifecycle": "experimental", "tags": ["java", "spring-boot"],
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "defaultBranch": "main" }
            },
            "source": { "provider": "{{provider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":  "{{steps.create-repo.outputs.repoUrl}}",
        "entityId": "{{steps.register.outputs.entityId}}"
      }
    }
  }'::jsonb,
  now()
),
(
  gen_random_uuid(),
  'go-service',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "go-service",
      "title": "Go Service",
      "description": "Bootstrap a Go microservice with CI, docs, and catalog registration.",
      "tags": ["go", "service"]
    },
    "spec": {
      "parameters": [
        { "id": "name",        "title": "Service Name", "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$", "description": "Lowercase name used for repo and entity" },
        { "id": "owner",       "title": "Owning Team",  "type": "string",  "required": true,  "description": "e.g. team:platform" },
        { "id": "provider",    "title": "SCM Provider", "type": "string",  "required": true,  "enum": ["github", "gitlab"] },
        { "id": "ownerGroup",  "title": "Org / Group",  "type": "string",  "required": true,  "description": "GitHub org or GitLab group" },
        { "id": "description", "title": "Description",  "type": "string",  "required": false, "default": "" }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "visibility": "private", "description": "{{description}}" }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "branch": "main",
            "message": "feat: bootstrap {{name}}",
            "files": [
              { "path": "README.md",            "contentBase64": "IyB7e25hbWV9fQoKPiB7e2Rlc2NyaXB0aW9ufX0KCiMjIEdldHRpbmcgU3RhcnRlZAoKYGBgYmFzaApnbyBydW4gLi9jbWQve3tuYW1lfX0KYGBgCg==" },
              { "path": "cmd/main.go",          "contentBase64": "cGFja2FnZSBtYWluCgppbXBvcnQgImZtdCIKCmZ1bmMgbWFpbigpIHsKCWZtdC5QcmludGxuKCJIZWxsbyBmcm9tIHt7bmFtZX19IikKfQo=" },
              { "path": "docs/index.md",        "contentBase64": "IyB7e25hbWV9fSBEb2N1bWVudGF0aW9uCgojIyBPdmVydmlldwoKe3tkZXNjcmlwdGlvbn19Cg==" },
              { "path": "entity.yaml",          "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogc2VydmljZQptZXRhZGF0YToKICBuYW1lOiB7e25hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdApzcGVjOgogIG93bmVyOiB7e293bmVyfX0KICBsaWZlY3ljbGU6IGV4cGVyaW1lbnRhbAo=" }
            ]
          }
        },
        {
          "id": "bootstrap-ci",
          "action": "ci.bootstrap@v1",
          "input": {
            "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}",
            "type": "{{#if (eq provider \"github\")}}github-actions{{else}}gitlab-ci{{/if}}",
            "language": "go"
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "service", "name": "{{name}}", "ownerRef": "{{owner}}",
              "lifecycle": "experimental", "tags": ["go"],
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "defaultBranch": "main" }
            },
            "source": { "provider": "{{provider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":  "{{steps.create-repo.outputs.repoUrl}}",
        "entityId": "{{steps.register.outputs.entityId}}"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

-- -------------------------
-- Template: Node.js Service golden path (forgeportal/v1 format)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'node-service',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "node-service",
      "title": "Node.js Service",
      "description": "Bootstrap a Node.js microservice with CI, docs, and Kubernetes manifests.",
      "tags": ["node", "service", "recommended"]
    },
    "spec": {
      "parameters": [
        { "id": "name",        "title": "Service Name",  "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$", "description": "Lowercase name used for repo, entity, and K8s resources" },
        { "id": "owner",       "title": "Owning Team",   "type": "string",  "required": true,  "description": "e.g., team:payments" },
        { "id": "provider",    "title": "SCM Provider",  "type": "string",  "required": true,  "enum": ["github", "gitlab"] },
        { "id": "ownerGroup",  "title": "Org / Group",   "type": "string",  "required": true,  "description": "GitHub org or GitLab group" },
        { "id": "description", "title": "Description",   "type": "string",  "required": false, "default": "" }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "visibility": "private", "description": "{{description}}" }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "branch": "main",
            "message": "feat: bootstrap {{name}}",
            "files": [
              { "path": "README.md",     "templatePath": "skeleton/README.md.hbs" },
              { "path": "entity.yaml",   "templatePath": "skeleton/entity.yaml.hbs" },
              { "path": "docs/index.md", "templatePath": "skeleton/docs-index.md.hbs" }
            ]
          }
        },
        {
          "id": "bootstrap-ci",
          "action": "ci.bootstrap@v1",
          "input": {
            "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}",
            "type": "{{#if (eq provider \"github\")}}github-actions{{else}}gitlab-ci{{/if}}",
            "language": "node"
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "service", "name": "{{name}}", "ownerRef": "{{owner}}",
              "lifecycle": "experimental", "tags": ["node"],
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{name}}", "defaultBranch": "main" }
            },
            "source": { "provider": "{{provider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":  "{{steps.create-repo.outputs.repoUrl}}",
        "entityId": "{{steps.register.outputs.entityId}}"
      },
      "skeletonFiles": {
        "skeleton/README.md.hbs":     "# {{name}}\n\n> {{description}}\n\n## Overview\n\nAdd an overview here.\n\n## Getting Started\n\n```bash\nnpm install\nnpm start\n```\n",
        "skeleton/entity.yaml.hbs":   "apiVersion: forgeportal/v1\nkind: service\nmetadata:\n  name: {{name}}\n  namespace: default\nspec:\n  owner: {{owner}}\n  lifecycle: experimental\n  tags:\n    - node\n",
        "skeleton/docs-index.md.hbs": "# {{name}} Documentation\n\n## Overview\n\n{{description}}\n\n## Getting Started\n\nDescribe how to run **{{name}}**.\n"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO NOTHING;

-- Fix template: creates a file on a branch, then opens a PR
-- Used by the scorecard fix flow (Story 4-4). One template handles all file-based fixes.
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'forge-fix-file',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "forge-fix-file",
      "version": "v1",
      "title": "Fix: Create File + Open PR",
      "description": "Internal template used by the scorecard fix flow. Creates a missing file on a fix branch and opens a PR."
    },
    "parameters": [],
    "steps": [
      {
        "id": "create-file",
        "title": "Create {{inputs.path}}",
        "action": "scm.createOrUpdateFile@v1",
        "input": {
          "provider":      "{{inputs.provider}}",
          "owner":         "{{inputs.owner}}",
          "repo":          "{{inputs.repo}}",
          "defaultBranch": "{{inputs.defaultBranch}}",
          "path":          "{{inputs.path}}",
          "contentBase64": "{{inputs.contentBase64}}",
          "message":       "{{inputs.commitMessage}}",
          "branch":        "{{inputs.branch}}"
        }
      },
      {
        "id": "open-pr",
        "title": "Open Pull Request",
        "action": "scm.openPrOrMr@v1",
        "input": {
          "provider":    "{{inputs.provider}}",
          "owner":       "{{inputs.owner}}",
          "repo":        "{{inputs.repo}}",
          "headBranch":  "{{inputs.branch}}",
          "baseBranch":  "{{inputs.defaultBranch}}",
          "title":       "{{inputs.prTitle}}",
          "body":        "{{inputs.prBody}}"
        }
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO NOTHING;

COMMIT;
