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
      "description": "Production-ready Node.js microservice with Express, Dockerfile, GitHub Actions CI, and ForgePortal entity registration.",
      "tags": ["node", "service", "recommended"]
    },
    "spec": {
      "parameters": [
        { "id": "name",        "title": "Service Name",  "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$", "description": "Lowercase slug used for repo, entity, and K8s label (e.g. payments-api)" },
        { "id": "description", "title": "Description",   "type": "string",  "required": true,  "description": "One-line description displayed in the catalog" },
        { "id": "owner",       "title": "Owning Team",   "type": "string",  "required": true,  "description": "Team reference, e.g. team:payments", "ui": "team-picker" },
        { "id": "provider",    "title": "SCM Provider",  "type": "string",  "required": true,  "enum": ["github", "gitlab"] },
        { "id": "ownerGroup",  "title": "Org / Group",   "type": "string",  "required": true,  "description": "GitHub organisation or GitLab group" },
        { "id": "port",        "title": "HTTP Port",     "type": "number",  "required": false, "default": 8080, "description": "Port the service listens on (default: 8080)" }
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
            "message": "feat: bootstrap {{name}} via ForgePortal golden path",
            "files": [
              { "path": "README.md",                    "contentBase64": "IyB7e25hbWV9fQoKPiB7e2Rlc2NyaXB0aW9ufX0KCiMjIEdldHRpbmcgU3RhcnRlZAoKYGBgYmFzaApucG0gaW5zdGFsbApucG0gc3RhcnQKYGBgCgojIyBEZXZlbG9wbWVudAoKYGBgYmFzaApucG0gdGVzdApgYGAKCiMjIERvY2tlcgoKYGBgYmFzaApkb2NrZXIgYnVpbGQgLXQge3tuYW1lfX0gLgpkb2NrZXIgcnVuIC1wIDgwODA6ODA4MCB7e25hbWV9fQpgYGA=" },
              { "path": "package.json",                 "contentBase64": "ewogICJuYW1lIjogInt7bmFtZX19IiwKICAidmVyc2lvbiI6ICIwLjEuMCIsCiAgImRlc2NyaXB0aW9uIjogInt7ZGVzY3JpcHRpb259fSIsCiAgInR5cGUiOiAibW9kdWxlIiwKICAiZW5naW5lcyI6IHsgIm5vZGUiOiAiPj0yMCIgfSwKICAic2NyaXB0cyI6IHsKICAgICJzdGFydCI6ICJub2RlIHNyYy9pbmRleC5qcyIsCiAgICAidGVzdCI6ICJub2RlIC0tdGVzdCIKICB9LAogICJkZXBlbmRlbmNpZXMiOiB7CiAgICAiZXhwcmVzcyI6ICJeNC4xOS4yIgogIH0KfQ==" },
              { "path": "src/index.js",                 "contentBase64": "aW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7Cgpjb25zdCBhcHAgID0gZXhwcmVzcygpOwpjb25zdCBwb3J0ID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuUE9SVCA/PyAnODA4MCcsIDEwKTsKCmFwcC51c2UoZXhwcmVzcy5qc29uKCkpOwoKYXBwLmdldCgnL2hlYWx0aHonLCAoX3JlcSwgcmVzKSA9PiB7CiAgcmVzLmpzb24oeyBzdGF0dXM6ICdvaycsIHNlcnZpY2U6ICd7e25hbWV9fScsIHRzOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfSk7Cn0pOwoKYXBwLmdldCgnLycsIChfcmVxLCByZXMpID0+IHsKICByZXMuanNvbih7IG1lc3NhZ2U6ICdIZWxsbyBmcm9tIHt7bmFtZX19IScgfSk7Cn0pOwoKYXBwLmxpc3Rlbihwb3J0LCAoKSA9PiB7CiAgY29uc29sZS5sb2coYFt7e25hbWV9fV0gTGlzdGVuaW5nIG9uIHBvcnQgJHtwb3J0fWApOwp9KTs=" },
              { "path": ".env.example",                 "contentBase64": "UE9SVD04MDgwCk5PREVfRU5WPWRldmVsb3BtZW50" },
              { "path": "Dockerfile",                   "contentBase64": "RlJPTSBub2RlOjIyLWFscGluZSBBUyBkZXBzCldPUktESVIgL2FwcApDT1BZIHBhY2thZ2UqLmpzb24gLi8KUlVOIG5wbSBjaSAtLW9taXQ9ZGV2CgpGUk9NIG5vZGU6MjItYWxwaW5lIEFTIGZpbmFsCldPUktESVIgL2FwcApFTlYgTk9ERV9FTlY9cHJvZHVjdGlvbgpDT1BZIC0tZnJvbT1kZXBzIC9hcHAvbm9kZV9tb2R1bGVzIC4vbm9kZV9tb2R1bGVzCkNPUFkgLiAuCkVYUE9TRSA4MDgwClVTRVIgbm9kZQpDTUQgWyJub2RlIiwgInNyYy9pbmRleC5qcyJd" },
              { "path": ".github/workflows/ci.yml",     "contentBase64": "bmFtZTogQ0kKCm9uOgogIHB1c2g6CiAgICBicmFuY2hlczogW21haW5dCiAgcHVsbF9yZXF1ZXN0OgogICAgYnJhbmNoZXM6IFttYWluXQoKam9iczoKICBjaToKICAgIG5hbWU6IExpbnQgKyBUZXN0ICsgQnVpbGQKICAgIHJ1bnMtb246IHVidW50dS1sYXRlc3QKICAgIHN0ZXBzOgogICAgICAtIHVzZXM6IGFjdGlvbnMvY2hlY2tvdXRAdjQKICAgICAgLSB1c2VzOiBhY3Rpb25zL3NldHVwLW5vZGVAdjQKICAgICAgICB3aXRoOgogICAgICAgICAgbm9kZS12ZXJzaW9uOiAnMjInCiAgICAgICAgICBjYWNoZTogbnBtCiAgICAgIC0gcnVuOiBucG0gY2kKICAgICAgLSBydW46IG5wbSB0ZXN0CiAgICAgIC0gbmFtZTogQnVpbGQgRG9ja2VyIGltYWdlCiAgICAgICAgcnVuOiBkb2NrZXIgYnVpbGQgLXQgbXlhcHA6JHt7IGdpdGh1Yi5zaGEgfX0gLg==" },
              { "path": "entity.yaml",                  "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogc2VydmljZQptZXRhZGF0YToKICBuYW1lOiB7e25hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdAogIGFubm90YXRpb25zOgogICAgZm9yZ2Vwb3J0YWwuZGV2L2s4cy1sYWJlbC1zZWxlY3RvcjogImFwcD17e25hbWV9fSIKc3BlYzoKICBvd25lcjoge3tvd25lcn19CiAgbGlmZWN5Y2xlOiBleHBlcmltZW50YWwKICBkZXNjcmlwdGlvbjogInt7ZGVzY3JpcHRpb259fSIKICB0YWdzOgogICAgLSBub2RlCiAgbGlua3M6CiAgICAtIHRpdGxlOiBTb3VyY2UgQ29kZQogICAgICB1cmw6ICJodHRwczovL2dpdGh1Yi5jb20ve3tvd25lckdyb3VwfX0ve3tuYW1lfX0iCiAgICAgIGljb246IGdpdGh1Yg==" },
              { "path": "docs/index.md",                "contentBase64": "IyB7e25hbWV9fQoKe3tkZXNjcmlwdGlvbn19CgojIyBPdmVydmlldwoKVGhpcyBzZXJ2aWNlIHdhcyBib290c3RyYXBwZWQgd2l0aCB0aGUgRm9yZ2VQb3J0YWwgTm9kZS5qcyBnb2xkZW4gcGF0aC4KCiMjIEFQSQoKfCBFbmRwb2ludCAgIHwgTWV0aG9kIHwgRGVzY3JpcHRpb24gICAgICAgICAgICAgfAp8LS0tLS0tLS0tLS0tfC0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS18CnwgYC9gICAgICAgICB8IEdFVCAgICB8IFJldHVybnMgYSBoZWxsbyBtZXNzYWdlIHwKfCBgL2hlYWx0aHpgIHwgR0VUICAgIHwgSGVhbHRoIGNoZWNrIGVuZHBvaW50ICAgfAoKIyMgR2V0dGluZyBTdGFydGVkCgpgYGBiYXNoCm5wbSBpbnN0YWxsCm5wbSBzdGFydApgYGAKCiMjIENvbmZpZ3VyYXRpb24KCnwgVmFyaWFibGUgICB8IERlZmF1bHQgICAgICAgfCBEZXNjcmlwdGlvbiAgICAgICAgIHwKfC0tLS0tLS0tLS0tLXwtLS0tLS0tLS0tLS0tLS18LS0tLS0tLS0tLS0tLS0tLS0tLS0tfAp8IFBPUlQgICAgICAgfCA4MDgwICAgICAgICAgIHwgSFRUUCBwb3J0ICAgICAgICAgICB8CnwgTk9ERV9FTlYgICB8IGRldmVsb3BtZW50ICAgfCBOb2RlLmpzIGVudmlyb25tZW50IHw=" }
            ]
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
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

-- Fix template: creates a file on a branch, then opens a PR.
-- Used by the scorecard fix flow. One template handles all file-based fixes.
-- Inputs (passed programmatically by the fix engine, not filled by users):
--   provider, owner, repo, branch, defaultBranch,
--   path, contentBase64, commitMessage, prTitle, prBody
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
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

COMMIT;
