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
              { "path": "Dockerfile",                   "contentBase64": "RlJPTSBub2RlOjIyLWFscGluZSBBUyBkZXBzCldPUktESVIgL2FwcApDT1BZIHBhY2thZ2UqLmpzb24gLi8KUlVOIG5wbSBpbnN0YWxsIC0tb21pdD1kZXYKCkZST00gbm9kZToyMi1hbHBpbmUgQVMgZmluYWwKV09SS0RJUiAvYXBwCkVOViBOT0RFX0VOVj1wcm9kdWN0aW9uCkNPUFkgLS1mcm9tPWRlcHMgL2FwcC9ub2RlX21vZHVsZXMgLi9ub2RlX21vZHVsZXMKQ09QWSAuIC4KRVhQT1NFIDgwODAKVVNFUiBub2RlCkNNRCBbIm5vZGUiLCAic3JjL2luZGV4LmpzIl0=" },
              { "path": ".github/workflows/ci.yml",     "contentBase64": "bmFtZTogQ0kKCm9uOgogIHB1c2g6CiAgICBicmFuY2hlczogW21haW5dCiAgcHVsbF9yZXF1ZXN0OgogICAgYnJhbmNoZXM6IFttYWluXQoKam9iczoKICBjaToKICAgIG5hbWU6IExpbnQgKyBUZXN0ICsgQnVpbGQKICAgIHJ1bnMtb246IHVidW50dS1sYXRlc3QKICAgIHN0ZXBzOgogICAgICAtIHVzZXM6IGFjdGlvbnMvY2hlY2tvdXRAdjQKICAgICAgLSB1c2VzOiBhY3Rpb25zL3NldHVwLW5vZGVAdjQKICAgICAgICB3aXRoOgogICAgICAgICAgbm9kZS12ZXJzaW9uOiAnMjInCiAgICAgIC0gbmFtZTogSW5zdGFsbCBkZXBlbmRlbmNpZXMKICAgICAgICBydW46IG5wbSBpbnN0YWxsCiAgICAgIC0gbmFtZTogUnVuIHRlc3RzCiAgICAgICAgcnVuOiBucG0gdGVzdAogICAgICAtIG5hbWU6IEJ1aWxkIERvY2tlciBpbWFnZQogICAgICAgIHJ1bjogZG9ja2VyIGJ1aWxkIC10IG15YXBwOiR7eyBnaXRodWIuc2hhIH19IC4=" },
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

-- -------------------------
-- Template: Create Database (multi-destination wizard)
-- Supports: local-docker, docker-compose, kubernetes, aws-rds
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'create-database',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "create-database",
      "title": "Create Database",
      "description": "Provision a PostgreSQL or MySQL database for local-docker, Kubernetes, AWS RDS, or docker-compose — then register it in the catalog.",
      "tags": ["database", "infrastructure", "postgres", "mysql"]
    },
    "spec": {
      "parameters": [
        { "id": "engine",      "title": "Database engine",        "type": "string",  "required": true,  "enum": ["postgres", "mysql"],                                                                          "description": "The database engine to provision" },
        { "id": "dbName",      "title": "Database name",          "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9_]{1,30}$",                                                                   "description": "Lowercase, letters/numbers/underscores (e.g. payments_db)" },
        { "id": "destination", "title": "Where to deploy",        "type": "string",  "required": true,  "enum": ["local-docker", "docker-compose", "kubernetes", "aws-rds"],                                    "description": "Choose your deployment target" },
        { "id": "owner",       "title": "Owning team",            "type": "string",  "required": true,  "ui": "team-picker",                                                                                    "description": "e.g. team:platform" },
        { "id": "version",     "title": "Engine version",         "type": "string",  "required": false, "default": "16",                                                                                        "description": "PostgreSQL: 15/16. MySQL: 8.0/8.4" },
        { "id": "provider",    "title": "SCM provider",           "type": "string",  "required": true,  "enum": ["github", "gitlab"],                                                                           "description": "Where to create the config repo" },
        { "id": "ownerGroup",  "title": "Org / Group",            "type": "string",  "required": true,                                                                                                          "description": "GitHub org or GitLab group" },
        { "id": "dockerPort",  "title": "Local port",             "type": "number",  "required": false, "default": 5432,   "dependsOn": { "destination": "local-docker" },                                     "description": "Host port to bind (local-docker only)" },
        { "id": "composeProvider", "title": "SCM provider (compose repo)", "type": "string", "required": false, "enum": ["github", "gitlab"], "dependsOn": { "destination": "docker-compose" } },
        { "id": "composeRepo", "title": "Repository (org/repo)",  "type": "string",  "required": false, "dependsOn": { "destination": "docker-compose" },                                                       "description": "Repo containing your docker-compose.yml" },
        { "id": "k8sNamespace","title": "Kubernetes namespace",   "type": "string",  "required": false, "default": "default", "dependsOn": { "destination": "kubernetes" } },
        { "id": "k8sStorageClass", "title": "Storage class",      "type": "string",  "required": false, "default": "standard", "dependsOn": { "destination": "kubernetes" } },
        { "id": "k8sPvcSize",  "title": "PVC size",               "type": "string",  "required": false, "default": "10Gi", "dependsOn": { "destination": "kubernetes" } },
        { "id": "k8sReplicas", "title": "Replicas (HA)",          "type": "number",  "required": false, "default": 1,      "dependsOn": { "destination": "kubernetes" },                                        "description": "Set to 3 for high-availability with read replicas" },
        { "id": "rdsInstanceClass", "title": "RDS instance class","type": "string",  "required": false, "default": "db.t3.micro", "enum": ["db.t3.micro","db.t3.small","db.t3.medium","db.m5.large","db.m5.xlarge"], "dependsOn": { "destination": "aws-rds" } },
        { "id": "rdsMultiAz",  "title": "Multi-AZ deployment",    "type": "boolean", "required": false, "default": false,  "dependsOn": { "destination": "aws-rds" } },
        { "id": "rdsBackupRetention", "title": "Backup retention (days)", "type": "number", "required": false, "default": 7, "dependsOn": { "destination": "aws-rds" } },
        { "id": "infraProvider","title": "SCM provider (infra repo)", "type": "string", "required": false, "enum": ["github", "gitlab"], "dependsOn": { "destination": "aws-rds" } },
        { "id": "infraRepo",   "title": "Infrastructure repo (org/repo)", "type": "string", "required": false, "dependsOn": { "destination": "aws-rds" }, "description": "Repo where Terraform modules live" }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{dbName}}-db",
            "visibility": "private",
            "description": "{{engine}} database config — {{dbName}} ({{destination}})"
          }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{dbName}}-db",
            "branch": "main",
            "message": "feat: provision {{dbName}} ({{engine}} on {{destination}})",
            "files": [
              { "path": "README.md",                           "contentBase64": "IyB7e2RiTmFtZX19Cgo+IHt7ZW5naW5lfX0ge3t2ZXJzaW9ufX0gZGF0YWJhc2Ug4oCUIGRlcGxveWVkIG9uIHt7ZGVzdGluYXRpb259fQoKIyMgU2V0dXAKCkNob29zZSB0aGUgc2VjdGlvbiBtYXRjaGluZyB5b3VyIGRlcGxveW1lbnQgdGFyZ2V0LgoKIyMjIExvY2FsIERvY2tlcgoKYGBgYmFzaApjaG1vZCAreCBsb2NhbC1kb2NrZXIvcnVuLnNoCi4vbG9jYWwtZG9ja2VyL3J1bi5zaApgYGAKCiMjIyBLdWJlcm5ldGVzIChIZWxtIC8gQml0bmFtaSkKCmBgYGJhc2gKY2htb2QgK3gga3ViZXJuZXRlcy9oZWxtL2luc3RhbGwuc2gKLi9rdWJlcm5ldGVzL2hlbG0vaW5zdGFsbC5zaApgYGAKCiMjIyBBV1MgUkRTIChUZXJyYWZvcm0pCgpgYGBiYXNoCmNkIHRlcnJhZm9ybQp0ZXJyYWZvcm0gaW5pdCAmJiB0ZXJyYWZvcm0gcGxhbiAmJiB0ZXJyYWZvcm0gYXBwbHkKYGBgCgojIyMgRG9ja2VyIENvbXBvc2UKClNlZSB0aGUgYGRvY2tlci1jb21wb3NlYCBzbmlwcGV0IGJlbG93IGFuZCBhZGQgaXQgdG8geW91ciBleGlzdGluZyBgZG9ja2VyLWNvbXBvc2UueW1sYC4KCiMjIENvbm5lY3Rpb24KCmBgYApwb3N0Z3JlczovL3t7ZGJOYW1lfX1fdXNlcjo8cGFzc3dvcmQ+QDxob3N0Pjo1NDMyL3t7ZGJOYW1lfX0KYGBgCgojIyBGb3JnZVBvcnRhbAoKVGhpcyByZXNvdXJjZSBpcyB0cmFja2VkIGluIHRoZSBjYXRhbG9nOiBbVmlldyBlbnRpdHldKGh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9jYXRhbG9nKQ==" },
              { "path": "entity.yaml",                         "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogcmVzb3VyY2UKbWV0YWRhdGE6CiAgbmFtZToge3tkYk5hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdAogIGFubm90YXRpb25zOgogICAgZm9yZ2Vwb3J0YWwuZGV2L2RiLWVuZ2luZTogInt7ZW5naW5lfX0iCiAgICBmb3JnZXBvcnRhbC5kZXYvZGItZGVzdGluYXRpb246ICJ7e2Rlc3RpbmF0aW9ufX0iCnNwZWM6CiAgb3duZXI6IHt7b3duZXJ9fQogIGxpZmVjeWNsZTogcHJvZHVjdGlvbgogIHR5cGU6IGRhdGFiYXNlCiAgZGVzY3JpcHRpb246ICJ7e2VuZ2luZX19IHt7dmVyc2lvbn19IGRhdGFiYXNlIGRlcGxveWVkIG9uIHt7ZGVzdGluYXRpb259fSIKICB0YWdzOgogICAgLSBkYXRhYmFzZQogICAgLSAie3tlbmdpbmV9fSI=" },
              { "path": "local-docker/run-postgres.sh",        "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFN0YXJ0IHt7ZGJOYW1lfX0gKFBvc3RncmVTUUwge3t2ZXJzaW9ufX0pCnNldCAtZXVvIHBpcGVmYWlsClBBU1NXT1JEPSQob3BlbnNzbCByYW5kIC1oZXggMTYpCmRvY2tlciBydW4gLWQgXAogIC0tbmFtZSB7e2RiTmFtZX19IFwKICAtZSBQT1NUR1JFU19EQj17e2RiTmFtZX19IFwKICAtZSBQT1NUR1JFU19VU0VSPXt7ZGJOYW1lfX1fdXNlciBcCiAgLWUgUE9TVEdSRVNfUEFTU1dPUkQ9IiR7UEFTU1dPUkR9IiBcCiAgLXAge3tkb2NrZXJQb3J0fX06NTQzMiBcCiAgLXYge3tkYk5hbWV9fV9kYXRhOi92YXIvbGliL3Bvc3RncmVzcWwvZGF0YSBcCiAgcG9zdGdyZXM6e3t2ZXJzaW9ufX0tYWxwaW5lCmVjaG8gIuKchSB7e2RiTmFtZX19IHJ1bm5pbmcgb24gbG9jYWxob3N0Ont7ZG9ja2VyUG9ydH19IgplY2hvICIgICBDb25uZWN0aW9uOiBwb3N0Z3JlczovL3t7ZGJOYW1lfX1fdXNlcjoke1BBU1NXT1JEfUBsb2NhbGhvc3Q6e3tkb2NrZXJQb3J0fX0ve3tkYk5hbWV9fSIKZWNobyAiICAgU2F2ZSB5b3VyIHBhc3N3b3JkIOKAlCBpdCB3b24ndCBiZSBzaG93biBhZ2FpbiEi" },
              { "path": "local-docker/run-mysql.sh",           "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFN0YXJ0IHt7ZGJOYW1lfX0gKE15U1FMIHt7dmVyc2lvbn19KQpzZXQgLWV1byBwaXBlZmFpbApQQVNTV09SRD0kKG9wZW5zc2wgcmFuZCAtaGV4IDE2KQpkb2NrZXIgcnVuIC1kIFwKICAtLW5hbWUge3tkYk5hbWV9fSBcCiAgLWUgTVlTUUxfREFUQUJBU0U9e3tkYk5hbWV9fSBcCiAgLWUgTVlTUUxfVVNFUj17e2RiTmFtZX19X3VzZXIgXAogIC1lIE1ZU1FMX1BBU1NXT1JEPSIke1BBU1NXT1JEfSIgXAogIC1lIE1ZU1FMX1JBTkRPTV9ST09UX1BBU1NXT1JEPXllcyBcCiAgLXAge3tkb2NrZXJQb3J0fX06MzMwNiBcCiAgLXYge3tkYk5hbWV9fV9kYXRhOi92YXIvbGliL215c3FsIFwKICBteXNxbDp7e3ZlcnNpb259fQplY2hvICLinIUge3tkYk5hbWV9fSBNeVNRTCBydW5uaW5nIG9uIGxvY2FsaG9zdDp7e2RvY2tlclBvcnR9fSIKZWNobyAiICAgQ29ubmVjdGlvbjogbXlzcWw6Ly97e2RiTmFtZX19X3VzZXI6JHtQQVNTV09SRH1AbG9jYWxob3N0Ont7ZG9ja2VyUG9ydH19L3t7ZGJOYW1lfX0i" },
              { "path": "kubernetes/helm/values-postgres.yaml", "contentBase64": "Z2xvYmFsOgogIHBvc3RncmVzcWw6CiAgICBhdXRoOgogICAgICBkYXRhYmFzZToge3tkYk5hbWV9fQogICAgICB1c2VybmFtZToge3tkYk5hbWV9fV91c2VyCiAgICAgIGV4aXN0aW5nU2VjcmV0OiB7e2RiTmFtZX19LXNlY3JldAoKcHJpbWFyeToKICBwZXJzaXN0ZW5jZToKICAgIGVuYWJsZWQ6IHRydWUKICAgIHN0b3JhZ2VDbGFzczoge3trOHNTdG9yYWdlQ2xhc3N9fQogICAgc2l6ZToge3trOHNQdmNTaXplfX0KICByZXNvdXJjZXM6CiAgICByZXF1ZXN0czoKICAgICAgbWVtb3J5OiAyNTZNaQogICAgICBjcHU6IDI1MG0=" },
              { "path": "kubernetes/helm/values-mysql.yaml",   "contentBase64": "YXV0aDoKICBkYXRhYmFzZToge3tkYk5hbWV9fQogIHVzZXJuYW1lOiB7e2RiTmFtZX19X3VzZXIKICBleGlzdGluZ1NlY3JldDoge3tkYk5hbWV9fS1zZWNyZXQKCnByaW1hcnk6CiAgcGVyc2lzdGVuY2U6CiAgICBlbmFibGVkOiB0cnVlCiAgICBzdG9yYWdlQ2xhc3M6IHt7azhzU3RvcmFnZUNsYXNzfX0KICAgIHNpemU6IHt7azhzUHZjU2l6ZX19CiAgcmVzb3VyY2VzOgogICAgcmVxdWVzdHM6CiAgICAgIG1lbW9yeTogMjU2TWkKICAgICAgY3B1OiAyNTBt" },
              { "path": "kubernetes/helm/install.sh",          "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIEluc3RhbGwge3tkYk5hbWV9fSB2aWEgSGVsbSAoQml0bmFtaSkKc2V0IC1ldW8gcGlwZWZhaWwKRU5HSU5FPXt7ZW5naW5lfX0KQ0hBUlQ9ImJpdG5hbWkvJHtFTkdJTkV9IgpoZWxtIHJlcG8gYWRkIGJpdG5hbWkgaHR0cHM6Ly9jaGFydHMuYml0bmFtaS5jb20vYml0bmFtaQpoZWxtIHJlcG8gdXBkYXRlCmt1YmVjdGwgY3JlYXRlIHNlY3JldCBnZW5lcmljIHt7ZGJOYW1lfX0tc2VjcmV0IFwKICAtLW5hbWVzcGFjZSB7e2s4c05hbWVzcGFjZX19IFwKICAtLWZyb20tbGl0ZXJhbD1wYXNzd29yZD0iJChvcGVuc3NsIHJhbmQgLWhleCAxNikiIFwKICAtLWRyeS1ydW49Y2xpZW50IC1vIHlhbWwgfCBrdWJlY3RsIGFwcGx5IC1mIC0KaGVsbSB1cGdyYWRlIC0taW5zdGFsbCB7e2RiTmFtZX19ICIke0NIQVJUfSIgXAogIC0tbmFtZXNwYWNlIHt7azhzTmFtZXNwYWNlfX0gXAogIC0tY3JlYXRlLW5hbWVzcGFjZSBcCiAgLWYgImt1YmVybmV0ZXMvaGVsbS92YWx1ZXMtJHtFTkdJTkV9LnlhbWwiCmVjaG8gIuKchSB7e2RiTmFtZX19IGRlcGxveWVkIGluIG5hbWVzcGFjZSB7e2s4c05hbWVzcGFjZX19Ig==" },
              { "path": "kubernetes/k8s-secret.yaml",          "contentBase64": "IyBBcHBseSB3aXRoOiBrdWJlY3RsIGFwcGx5IC1mIGt1YmVybmV0ZXMvazhzLXNlY3JldC55YW1sIC1uIHt7azhzTmFtZXNwYWNlfX0KIyBSZXBsYWNlIDxCQVNFNjRfUEFTU1dPUkQ+IHdpdGg6IGVjaG8gLW4gInlvdXJwYXNzd29yZCIgfCBiYXNlNjQKYXBpVmVyc2lvbjogdjEKa2luZDogU2VjcmV0Cm1ldGFkYXRhOgogIG5hbWU6IHt7ZGJOYW1lfX0tc2VjcmV0CiAgbmFtZXNwYWNlOiB7e2s4c05hbWVzcGFjZX19CnR5cGU6IE9wYXF1ZQpkYXRhOgogIHBhc3N3b3JkOiA8QkFTRTY0X1BBU1NXT1JEPg==" },
              { "path": "terraform/main.tf",                   "contentBase64": "bW9kdWxlICJkYiIgewogIHNvdXJjZSAgPSAidGVycmFmb3JtLWF3cy1tb2R1bGVzL3Jkcy9hd3MiCiAgdmVyc2lvbiA9ICJ+PiA2LjAiCgogIGlkZW50aWZpZXIgICAgICAgID0gInt7ZGJOYW1lfX0iCiAgZW5naW5lICAgICAgICAgICAgPSAie3tlbmdpbmV9fSIKICBlbmdpbmVfdmVyc2lvbiAgICA9ICJ7e3ZlcnNpb259fSIKICBpbnN0YW5jZV9jbGFzcyAgICA9ICJ7e3Jkc0luc3RhbmNlQ2xhc3N9fSIKICBhbGxvY2F0ZWRfc3RvcmFnZSA9IDIwCgogIGRiX25hbWUgID0gInt7ZGJOYW1lfX0iCiAgdXNlcm5hbWUgPSAie3tkYk5hbWV9fV9hZG1pbiIKICBwb3J0ICAgICA9ICI1NDMyIgoKICBtdWx0aV9heiAgICAgICAgICAgICAgICA9IHt7cmRzTXVsdGlBen19CiAgYmFja3VwX3JldGVudGlvbl9wZXJpb2QgPSB7e3Jkc0JhY2t1cFJldGVudGlvbn19CgogIHZwY19zZWN1cml0eV9ncm91cF9pZHMgPSB2YXIudnBjX3NlY3VyaXR5X2dyb3VwX2lkcwogIHN1Ym5ldF9pZHMgICAgICAgICAgICAgPSB2YXIuc3VibmV0X2lkcwoKICB0YWdzID0gewogICAgT3duZXIgICAgICAgPSAie3tvd25lcn19IgogICAgTWFuYWdlZEJ5ICAgPSAiZm9yZ2Vwb3J0YWwiCiAgICBFbnZpcm9ubWVudCA9ICJwcm9kdWN0aW9uIgogIH0KfQoKb3V0cHV0ICJkYl9lbmRwb2ludCIgewogIHZhbHVlID0gbW9kdWxlLmRiLmRiX2luc3RhbmNlX2VuZHBvaW50Cn0=" },
              { "path": "terraform/variables.tf",              "contentBase64": "dmFyaWFibGUgInZwY19zZWN1cml0eV9ncm91cF9pZHMiIHsKICB0eXBlICAgICAgICA9IGxpc3Qoc3RyaW5nKQogIGRlc2NyaXB0aW9uID0gIkxpc3Qgb2YgVlBDIHNlY3VyaXR5IGdyb3VwIElEcyBmb3IgdGhlIFJEUyBpbnN0YW5jZSIKfQoKdmFyaWFibGUgInN1Ym5ldF9pZHMiIHsKICB0eXBlICAgICAgICA9IGxpc3Qoc3RyaW5nKQogIGRlc2NyaXB0aW9uID0gIkxpc3Qgb2Ygc3VibmV0IElEcyBmb3IgdGhlIFJEUyBzdWJuZXQgZ3JvdXAiCn0=" }
            ]
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "resource",
              "name": "{{dbName}}",
              "ownerRef": "{{owner}}",
              "lifecycle": "production",
              "tags": ["database", "{{engine}}"],
              "annotations": {
                "forgeportal.dev/db-engine": "{{engine}}",
                "forgeportal.dev/db-destination": "{{destination}}"
              },
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{dbName}}-db", "defaultBranch": "main" },
              "spec": { "type": "database", "description": "{{engine}} {{version}} database deployed on {{destination}}" }
            },
            "source": { "provider": "{{provider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":                "{{steps.create-repo.outputs.repoUrl}}",
        "entityId":               "{{steps.register.outputs.entityId}}",
        "connectionStringFormat": "{{engine}}://{{dbName}}_user:<password>@<host>:5432/{{dbName}}"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

-- -------------------------
-- Scorecard: resource-maturity
-- Applies to: resource kind entities
-- -------------------------
INSERT INTO scorecards (id, name, applies_to_kind, enabled, version, definition, created_at)
VALUES (
  gen_random_uuid(),
  'resource-maturity',
  'resource',
  true,
  'v1',
  '{
    "rules": [
      {
        "id":          "has-owner",
        "title":       "Resource has an owner",
        "level":       "Bronze",
        "type":        "metadata",
        "field":       "owner_ref",
        "operator":    "notEmpty"
      },
      {
        "id":          "has-description",
        "title":       "Resource has a description",
        "level":       "Bronze",
        "type":        "metadata",
        "field":       "description",
        "operator":    "notEmpty"
      },
      {
        "id":          "has-lifecycle-tag",
        "title":       "Resource lifecycle is set",
        "level":       "Silver",
        "type":        "metadata",
        "field":       "lifecycle",
        "operator":    "notEmpty"
      },
      {
        "id":          "has-db-engine-annotation",
        "title":       "DB engine annotation is set",
        "level":       "Silver",
        "type":        "annotation",
        "annotation":  "forgeportal.dev/db-engine",
        "operator":    "notEmpty"
      },
      {
        "id":          "has-db-destination-annotation",
        "title":       "DB destination annotation is set",
        "level":       "Gold",
        "type":        "annotation",
        "annotation":  "forgeportal.dev/db-destination",
        "operator":    "notEmpty"
      }
    ]
  }'::jsonb,
  now()
)
ON CONFLICT (name, applies_to_kind, version) DO UPDATE
  SET definition = EXCLUDED.definition,
      enabled    = EXCLUDED.enabled;

-- -------------------------
-- Template: create-cache (Story 12-2)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'create-cache',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "create-cache",
      "title": "Create Cache (Redis)",
      "description": "Provision a Redis cache for local-docker, Kubernetes (Bitnami), AWS ElastiCache, or docker-compose — then register it in the catalog.",
      "tags": ["cache", "redis", "infrastructure"]
    },
    "spec": {
      "parameters": [
        { "id": "cacheName",    "title": "Cache name",          "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{1,30}$",                                                                                               "description": "Lowercase letters, numbers, hyphens (e.g. session-cache)" },
        { "id": "destination",  "title": "Where to deploy",     "type": "string",  "required": true,  "enum": ["local-docker", "docker-compose", "kubernetes", "aws-elasticache"],                                                        "description": "Choose your deployment target" },
        { "id": "redisVersion", "title": "Redis version",       "type": "string",  "required": false, "default": "7.2",                                                                                                                    "description": "Redis version to deploy" },
        { "id": "owner",        "title": "Owning team",         "type": "string",  "required": true,  "ui": "team-picker",                                                                                                                 "description": "e.g. team:platform" },
        { "id": "provider",     "title": "SCM provider",        "type": "string",  "required": true,  "enum": ["github", "gitlab"],                                                                                                        "description": "Where to create the config repo" },
        { "id": "ownerGroup",   "title": "Org / Group",         "type": "string",  "required": true,                                                                                                                                       "description": "GitHub org or GitLab group" },
        { "id": "enableAuth",   "title": "Enable password auth","type": "boolean", "required": false, "default": true,                                                                                                                     "description": "Generate a random password for Redis AUTH" },
        { "id": "maxMemory",    "title": "Max memory",          "type": "string",  "required": false, "default": "256mb",                                                                                                                  "description": "e.g. 256mb, 1gb" },
        { "id": "evictionPolicy","title": "Eviction policy",    "type": "string",  "required": false, "enum": ["noeviction", "allkeys-lru", "volatile-lru", "allkeys-lfu"], "default": "allkeys-lru",                                     "description": "Memory eviction policy" },
        { "id": "k8sNamespace", "title": "Kubernetes namespace","type": "string",  "required": false, "default": "default", "dependsOn": { "destination": "kubernetes" } },
        { "id": "k8sMode",      "title": "Redis mode",          "type": "string",  "required": false, "enum": ["standalone", "sentinel", "cluster"], "default": "standalone", "dependsOn": { "destination": "kubernetes" },             "description": "standalone, sentinel, or cluster" },
        { "id": "elasticacheNodeType", "title": "Node type",    "type": "string",  "required": false, "enum": ["cache.t3.micro", "cache.t3.small", "cache.m6g.large"], "default": "cache.t3.micro", "dependsOn": { "destination": "aws-elasticache" } },
        { "id": "elasticacheReplicas", "title": "Read replicas","type": "number",  "required": false, "default": 0, "dependsOn": { "destination": "aws-elasticache" } },
        { "id": "infraRepo",    "title": "Infrastructure repo (org/repo)", "type": "string", "required": false, "dependsOn": { "destination": "aws-elasticache" }, "description": "Repo where Terraform modules live" }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{cacheName}}-cache",
            "visibility": "private",
            "description": "Redis cache config — {{cacheName}} ({{destination}})"
          }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{cacheName}}-cache",
            "branch": "main",
            "message": "feat: provision {{cacheName}} Redis cache on {{destination}}",
            "files": [
              { "path": "README.md",                        "contentBase64": "IyB7e2NhY2hlTmFtZX19Cgo+IFJlZGlzIHt7cmVkaXNWZXJzaW9ufX0gY2FjaGUg4oCUIGRlcGxveWVkIG9uIHt7ZGVzdGluYXRpb259fQoKIyMgU2V0dXAKCiMjIyBMb2NhbCBEb2NrZXIKYGBgYmFzaApjaG1vZCAreCBsb2NhbC1kb2NrZXIvcnVuLnNoCi4vbG9jYWwtZG9ja2VyL3J1bi5zaApgYGAKCiMjIyBLdWJlcm5ldGVzIChIZWxtIC8gQml0bmFtaSkKYGBgYmFzaApjaG1vZCAreCBrdWJlcm5ldGVzL2hlbG0vaW5zdGFsbC5zaAouL2t1YmVybmV0ZXMvaGVsbS9pbnN0YWxsLnNoCmBgYAoKIyMjIEFXUyBFbGFzdGlDYWNoZSAoVGVycmFmb3JtKQpgYGBiYXNoCmNkIHRlcnJhZm9ybQp0ZXJyYWZvcm0gaW5pdCAmJiB0ZXJyYWZvcm0gcGxhbiAmJiB0ZXJyYWZvcm0gYXBwbHkKYGBgCgojIyBDb25uZWN0aW9uCmBgYApyZWRpczovLzp7e3Bhc3N3b3JkfX1APGhvc3Q+OjYzNzkvMApgYGAKCiMjIEZvcmdlUG9ydGFsClRoaXMgcmVzb3VyY2UgaXMgdHJhY2tlZCBpbiB0aGUgY2F0YWxvZzogW1ZpZXcgZW50aXR5XShodHRwOi8vbG9jYWxob3N0OjMwMDAvY2F0YWxvZyk=" },
              { "path": "entity.yaml",                     "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogcmVzb3VyY2UKbWV0YWRhdGE6CiAgbmFtZToge3tjYWNoZU5hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdAogIGFubm90YXRpb25zOgogICAgZm9yZ2Vwb3J0YWwuZGV2L2RiLWVuZ2luZTogInJlZGlzIgogICAgZm9yZ2Vwb3J0YWwuZGV2L2RiLWRlc3RpbmF0aW9uOiAie3tkZXN0aW5hdGlvbn19IgpzcGVjOgogIG93bmVyOiB7e293bmVyfX0KICBsaWZlY3ljbGU6IHByb2R1Y3Rpb24KICB0eXBlOiBjYWNoZQogIGRlc2NyaXB0aW9uOiAiUmVkaXMge3tyZWRpc1ZlcnNpb259fSBjYWNoZSBkZXBsb3llZCBvbiB7e2Rlc3RpbmF0aW9ufX0iCiAgdGFnczoKICAgIC0gY2FjaGUKICAgIC0gcmVkaXM=" },
              { "path": "local-docker/run.sh",             "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFN0YXJ0IHt7Y2FjaGVOYW1lfX0gKFJlZGlzIHt7cmVkaXNWZXJzaW9ufX0pCnNldCAtZXVvIHBpcGVmYWlsClBBU1NXT1JEPSQob3BlbnNzbCByYW5kIC1oZXggMTYpCmRvY2tlciBydW4gLWQgXAogIC0tbmFtZSB7e2NhY2hlTmFtZX19IFwKICAtcCA2Mzc5OjYzNzkgXAogIC12IHt7Y2FjaGVOYW1lfX1fZGF0YTovZGF0YSBcCiAgcmVkaXM6e3tyZWRpc1ZlcnNpb259fS1hbHBpbmUgXAogIHJlZGlzLXNlcnZlciBcCiAgLS1tYXhtZW1vcnkge3ttYXhNZW1vcnl9fSBcCiAgLS1tYXhtZW1vcnktcG9saWN5IHt7ZXZpY3Rpb25Qb2xpY3l9fSBcCiAgLS1yZXF1aXJlcGFzcyAiJHtQQVNTV09SRH0iIFwKICAtLWFwcGVuZG9ubHkgeWVzCmVjaG8gIuKchSB7e2NhY2hlTmFtZX19IFJlZGlzIHJ1bm5pbmcgb24gbG9jYWxob3N0OjYzNzkiCmVjaG8gIiAgIENvbm5lY3Rpb246IHJlZGlzOi8vOiR7UEFTU1dPUkR9QGxvY2FsaG9zdDo2Mzc5LzAiCmVjaG8gIiAgIFNhdmUgeW91ciBwYXNzd29yZCDigJQgaXQgd29uJ3QgYmUgc2hvd24gYWdhaW4hIg==" },
              { "path": "local-docker/redis.conf",         "contentBase64": "IyBSZWRpcyBjb25maWd1cmF0aW9uIGZvciB7e2NhY2hlTmFtZX19Cm1heG1lbW9yeSB7e21heE1lbW9yeX19Cm1heG1lbW9yeS1wb2xpY3kge3tldmljdGlvblBvbGljeX19CmFwcGVuZG9ubHkgeWVz" },
              { "path": "kubernetes/helm/values.yaml",     "contentBase64": "IyBCaXRuYW1pIFJlZGlzIOKAlCB7e2NhY2hlTmFtZX19CnJlcGxpY2E6CiAgcmVwbGljYUNvdW50OiAwCgphdXRoOgogIGVuYWJsZWQ6IHRydWUKICBleGlzdGluZ1NlY3JldDoge3tjYWNoZU5hbWV9fS1yZWRpcy1zZWNyZXQKCm1hc3RlcjoKICBwZXJzaXN0ZW5jZToKICAgIGVuYWJsZWQ6IHRydWUKICAgIHNpemU6IDhHaQogIHJlc291cmNlczoKICAgIHJlcXVlc3RzOgogICAgICBtZW1vcnk6IDI1Nk1pCiAgICAgIGNwdTogMTAwbQoKY29tbW9uQ29uZmlndXJhdGlvbjogfC0KICBtYXhtZW1vcnkge3ttYXhNZW1vcnl9fQogIG1heG1lbW9yeS1wb2xpY3kge3tldmljdGlvblBvbGljeX19CiAgYXBwZW5kb25seSB5ZXM=" },
              { "path": "kubernetes/helm/install.sh",      "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaApzZXQgLWV1byBwaXBlZmFpbApoZWxtIHJlcG8gYWRkIGJpdG5hbWkgaHR0cHM6Ly9jaGFydHMuYml0bmFtaS5jb20vYml0bmFtaQpoZWxtIHJlcG8gdXBkYXRlCmt1YmVjdGwgY3JlYXRlIHNlY3JldCBnZW5lcmljIHt7Y2FjaGVOYW1lfX0tcmVkaXMtc2VjcmV0IFwKICAtLW5hbWVzcGFjZSB7e2s4c05hbWVzcGFjZX19IFwKICAtLWZyb20tbGl0ZXJhbD1yZWRpcy1wYXNzd29yZD0iJChvcGVuc3NsIHJhbmQgLWhleCAxNikiIFwKICAtLWRyeS1ydW49Y2xpZW50IC1vIHlhbWwgfCBrdWJlY3RsIGFwcGx5IC1mIC0KaGVsbSB1cGdyYWRlIC0taW5zdGFsbCB7e2NhY2hlTmFtZX19IGJpdG5hbWkvcmVkaXMgXAogIC0tbmFtZXNwYWNlIHt7azhzTmFtZXNwYWNlfX0gXAogIC0tY3JlYXRlLW5hbWVzcGFjZSBcCiAgLWYga3ViZXJuZXRlcy9oZWxtL3ZhbHVlcy55YW1sCmVjaG8gIuKchSB7e2NhY2hlTmFtZX19IFJlZGlzIGRlcGxveWVkIGluIG5hbWVzcGFjZSB7e2s4c05hbWVzcGFjZX19Ig==" },
              { "path": "terraform/main.tf",               "contentBase64": "cmVzb3VyY2UgImF3c19lbGFzdGljYWNoZV9yZXBsaWNhdGlvbl9ncm91cCIgImNhY2hlIiB7CiAgcmVwbGljYXRpb25fZ3JvdXBfaWQgICAgICAgPSAie3tjYWNoZU5hbWV9fSIKICBkZXNjcmlwdGlvbiAgICAgICAgICAgICAgICA9ICJSZWRpcyBjYWNoZSBmb3Ige3tjYWNoZU5hbWV9fSIKICBub2RlX3R5cGUgICAgICAgICAgICAgICAgICA9ICJ7e2VsYXN0aWNhY2hlTm9kZVR5cGV9fSIKICBudW1fY2FjaGVfY2x1c3RlcnMgICAgICAgICA9IDEKICBhdXRvbWF0aWNfZmFpbG92ZXJfZW5hYmxlZCA9IGZhbHNlCgogIGVuZ2luZSAgICAgICAgID0gInJlZGlzIgogIGVuZ2luZV92ZXJzaW9uID0gInt7cmVkaXNWZXJzaW9ufX0iCiAgcG9ydCAgICAgICAgICAgPSA2Mzc5CgogIGF0X3Jlc3RfZW5jcnlwdGlvbl9lbmFibGVkID0gdHJ1ZQogIHRyYW5zaXRfZW5jcnlwdGlvbl9lbmFibGVkID0gdHJ1ZQoKICBwYXJhbWV0ZXJfZ3JvdXBfbmFtZSA9IGF3c19lbGFzdGljYWNoZV9wYXJhbWV0ZXJfZ3JvdXAuY2FjaGUubmFtZQoKICB0YWdzID0gewogICAgT3duZXIgICAgID0gInt7b3duZXJ9fSIKICAgIE1hbmFnZWRCeSA9ICJmb3JnZXBvcnRhbCIKICB9Cn0KCnJlc291cmNlICJhd3NfZWxhc3RpY2FjaGVfcGFyYW1ldGVyX2dyb3VwIiAiY2FjaGUiIHsKICBuYW1lICAgPSAie3tjYWNoZU5hbWV9fS1wYXJhbXMiCiAgZmFtaWx5ID0gInJlZGlzNyIKCiAgcGFyYW1ldGVyIHsKICAgIG5hbWUgID0gIm1heG1lbW9yeS1wb2xpY3kiCiAgICB2YWx1ZSA9ICJ7e2V2aWN0aW9uUG9saWN5fX0iCiAgfQp9" }
            ]
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "resource",
              "name": "{{cacheName}}",
              "ownerRef": "{{owner}}",
              "lifecycle": "production",
              "tags": ["cache", "redis"],
              "annotations": {
                "forgeportal.dev/db-engine": "redis",
                "forgeportal.dev/db-destination": "{{destination}}"
              },
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{cacheName}}-cache", "defaultBranch": "main" },
              "spec": { "type": "cache", "description": "Redis {{redisVersion}} cache deployed on {{destination}}" }
            },
            "source": { "provider": "{{provider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":                "{{steps.create-repo.outputs.repoUrl}}",
        "entityId":               "{{steps.register.outputs.entityId}}",
        "connectionStringFormat": "redis://:{{password}}@<host>:6379/0"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

-- -------------------------
-- Template: create-message-queue (Story 12-3)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'create-message-queue',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "create-message-queue",
      "title": "Create Message Queue (RabbitMQ / Kafka)",
      "description": "Provision RabbitMQ or Kafka for local-docker, docker-compose, or Kubernetes — then register it in the catalog.",
      "tags": ["messaging", "rabbitmq", "kafka", "infrastructure"]
    },
    "spec": {
      "parameters": [
        { "id": "queueName",    "title": "Queue / broker name",  "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{1,30}$",                                                   "description": "Lowercase letters, numbers, hyphens (e.g. payments-events)" },
        { "id": "engine",       "title": "Message broker",       "type": "string",  "required": true,  "enum": ["rabbitmq", "kafka"],                                                           "description": "RabbitMQ for task queues / pub-sub; Kafka for high-volume event streaming" },
        { "id": "destination",  "title": "Where to deploy",      "type": "string",  "required": true,  "enum": ["local-docker", "docker-compose", "kubernetes"],                               "description": "Choose your deployment target" },
        { "id": "owner",        "title": "Owning team",          "type": "string",  "required": true,  "ui": "team-picker",                                                                     "description": "e.g. team:platform" },
        { "id": "provider",     "title": "SCM provider",         "type": "string",  "required": true,  "enum": ["github", "gitlab"],                                                           "description": "Where to create the config repo" },
        { "id": "ownerGroup",   "title": "Org / Group",          "type": "string",  "required": true,                                                                                          "description": "GitHub org or GitLab group" },
        { "id": "rmqVhost",     "title": "Virtual host",         "type": "string",  "required": false, "default": "/", "dependsOn": { "engine": "rabbitmq" },                                  "description": "RabbitMQ virtual host (default: /)" },
        { "id": "rmqManagementUI", "title": "Enable management UI", "type": "boolean", "required": false, "default": true, "dependsOn": { "engine": "rabbitmq" },                             "description": "Expose RabbitMQ management console on port 15672" },
        { "id": "kafkaPartitions", "title": "Default partitions","type": "number",  "required": false, "default": 3, "dependsOn": { "engine": "kafka" } },
        { "id": "kafkaReplicationFactor", "title": "Replication factor", "type": "number", "required": false, "default": 1, "dependsOn": { "engine": "kafka" },                               "description": "Set to 3 for production HA" },
        { "id": "kafkaKraft",   "title": "Use KRaft mode (no ZooKeeper)", "type": "boolean", "required": false, "default": true, "dependsOn": { "engine": "kafka" } },
        { "id": "k8sNamespace", "title": "Kubernetes namespace", "type": "string",  "required": false, "default": "default", "dependsOn": { "destination": "kubernetes" } }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{queueName}}-mq",
            "visibility": "private",
            "description": "{{engine}} message broker config — {{queueName}} ({{destination}})"
          }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{queueName}}-mq",
            "branch": "main",
            "message": "feat: provision {{queueName}} ({{engine}} on {{destination}})",
            "files": [
              { "path": "README.md",                                "contentBase64": "IyB7e3F1ZXVlTmFtZX19Cgo+IHt7ZW5naW5lfX0gbWVzc2FnZSBicm9rZXIg4oCUIGRlcGxveWVkIG9uIHt7ZGVzdGluYXRpb259fQoKIyMgU2V0dXAKCiMjIyBMb2NhbCBEb2NrZXIKYGBgYmFzaApjaG1vZCAreCBsb2NhbC1kb2NrZXIvcnVuLnNoCi4vbG9jYWwtZG9ja2VyL3J1bi5zaApgYGAKCiMjIyBEb2NrZXIgQ29tcG9zZQpgYGBiYXNoCmRvY2tlciBjb21wb3NlIC1mIGRvY2tlci1jb21wb3NlL2RvY2tlci1jb21wb3NlLnltbCB1cCAtZApgYGAKCiMjIyBLdWJlcm5ldGVzIChIZWxtIC8gQml0bmFtaSkKYGBgYmFzaApjaG1vZCAreCBrdWJlcm5ldGVzL2hlbG0vaW5zdGFsbC5zaAouL2t1YmVybmV0ZXMvaGVsbS9pbnN0YWxsLnNoCmBgYAoKIyMgRm9yZ2VQb3J0YWwKVGhpcyByZXNvdXJjZSBpcyB0cmFja2VkIGluIHRoZSBjYXRhbG9nOiBbVmlldyBlbnRpdHldKGh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9jYXRhbG9nKQ==" },
              { "path": "entity.yaml",                              "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogcmVzb3VyY2UKbWV0YWRhdGE6CiAgbmFtZToge3txdWV1ZU5hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdAogIGFubm90YXRpb25zOgogICAgZm9yZ2Vwb3J0YWwuZGV2L21xLWVuZ2luZTogInt7ZW5naW5lfX0iCnNwZWM6CiAgb3duZXI6IHt7b3duZXJ9fQogIGxpZmVjeWNsZTogcHJvZHVjdGlvbgogIHR5cGU6IG1lc3NhZ2UtcXVldWUKICBkZXNjcmlwdGlvbjogInt7ZW5naW5lfX0gbWVzc2FnZSBicm9rZXIgZGVwbG95ZWQgb24ge3tkZXN0aW5hdGlvbn19IgogIHRhZ3M6CiAgICAtIG1lc3NhZ2UtcXVldWUKICAgIC0gInt7ZW5naW5lfX0i" },
              { "path": "local-docker/run-rabbitmq.sh",             "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFN0YXJ0IHt7cXVldWVOYW1lfX0gKFJhYmJpdE1RKQpzZXQgLWV1byBwaXBlZmFpbApQQVNTPSQob3BlbnNzbCByYW5kIC1oZXggMTIpCmRvY2tlciBydW4gLWQgXAogIC0tbmFtZSB7e3F1ZXVlTmFtZX19IFwKICAtZSBSQUJCSVRNUV9ERUZBVUxUX1VTRVI9YWRtaW4gXAogIC1lICJSQUJCSVRNUV9ERUZBVUxUX1BBU1M9JHtQQVNTfSIgXAogIC1lIFJBQkJJVE1RX0RFRkFVTFRfVkhPU1Q9e3tybXFWaG9zdH19IFwKICAtcCA1NjcyOjU2NzIgXAogIC1wIDE1NjcyOjE1NjcyIFwKICByYWJiaXRtcTptYW5hZ2VtZW50LWFscGluZQplY2hvICLinIUge3txdWV1ZU5hbWV9fSBSYWJiaXRNUSBydW5uaW5nIgplY2hvICIgICBBTVFQOiAgICAgICAgYW1xcDovL2FkbWluOiR7UEFTU31AbG9jYWxob3N0OjU2NzIve3tybXFWaG9zdH19IgplY2hvICIgICBNYW5hZ2VtZW50OiAgaHR0cDovL2xvY2FsaG9zdDoxNTY3MiAgKGFkbWluIC8gJHtQQVNTfSkiCmVjaG8gIiAgIFNhdmUgeW91ciBwYXNzd29yZCDigJQgaXQgd29uJ3QgYmUgc2hvd24gYWdhaW4hIg==" },
              { "path": "local-docker/run-kafka.sh",                "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFN0YXJ0IHt7cXVldWVOYW1lfX0gKEthZmthIOKAlCBLUmFmdCBtb2RlKQpzZXQgLWV1byBwaXBlZmFpbApDTFVTVEVSX0lEPSQob3BlbnNzbCByYW5kIC1oZXggMTYpCmRvY2tlciBydW4gLWQgXAogIC0tbmFtZSB7e3F1ZXVlTmFtZX19IFwKICAtZSBLQUZLQV9DRkdfTk9ERV9JRD0wIFwKICAtZSBLQUZLQV9DRkdfUFJPQ0VTU19ST0xFUz1jb250cm9sbGVyLGJyb2tlciBcCiAgLWUgS0FGS0FfQ0ZHX0xJU1RFTkVSUz1QTEFJTlRFWFQ6Ly86OTA5MixDT05UUk9MTEVSOi8vOjkwOTMgXAogIC1lIEtBRktBX0NGR19BRFZFUlRJU0VEX0xJU1RFTkVSUz1QTEFJTlRFWFQ6Ly9sb2NhbGhvc3Q6OTA5MiBcCiAgLWUgS0FGS0FfQ0ZHX0xJU1RFTkVSX1NFQ1VSSVRZX1BST1RPQ09MX01BUD1DT05UUk9MTEVSOlBMQUlOVEVYVCxQTEFJTlRFWFQ6UExBSU5URVhUIFwKICAtZSBLQUZLQV9DRkdfQ09OVFJPTExFUl9RVU9SVU1fVk9URVJTPTBAe3txdWV1ZU5hbWV9fTo5MDkzIFwKICAtZSBLQUZLQV9DRkdfQ09OVFJPTExFUl9MSVNURU5FUl9OQU1FUz1DT05UUk9MTEVSIFwKICAtZSBLQUZLQV9DRkdfTlVNX1BBUlRJVElPTlM9e3trYWZrYVBhcnRpdGlvbnN9fSBcCiAgLWUgS0FGS0FfQ0ZHX0RFRkFVTFRfUkVQTElDQVRJT05fRkFDVE9SPXt7a2Fma2FSZXBsaWNhdGlvbkZhY3Rvcn19IFwKICAtZSBLQUZLQV9LUkFGVF9DTFVTVEVSX0lEPSIke0NMVVNURVJfSUR9IiBcCiAgLXAgOTA5Mjo5MDkyIFwKICAtdiB7e3F1ZXVlTmFtZX19X2RhdGE6L2JpdG5hbWkva2Fma2EgXAogIGJpdG5hbWkva2Fma2E6bGF0ZXN0CmVjaG8gIuKchSB7e3F1ZXVlTmFtZX19IEthZmthIChLUmFmdCkgcnVubmluZyBvbiBsb2NhbGhvc3Q6OTA5MiI=" },
              { "path": "docker-compose/docker-compose-rabbitmq.yml","contentBase64": "c2VydmljZXM6CiAge3txdWV1ZU5hbWV9fToKICAgIGltYWdlOiByYWJiaXRtcTptYW5hZ2VtZW50LWFscGluZQogICAgZW52aXJvbm1lbnQ6CiAgICAgIFJBQkJJVE1RX0RFRkFVTFRfVVNFUjogYWRtaW4KICAgICAgUkFCQklUTVFfREVGQVVMVF9QQVNTOiBjaGFuZ2VtZQogICAgICBSQUJCSVRNUV9ERUZBVUxUX1ZIT1NUOiB7e3JtcVZob3N0fX0KICAgIHBvcnRzOgogICAgICAtICI1NjcyOjU2NzIiCiAgICAgIC0gIjE1NjcyOjE1NjcyIgogICAgdm9sdW1lczoKICAgICAgLSB7e3F1ZXVlTmFtZX19X2RhdGE6L3Zhci9saWIvcmFiYml0bXEKCnZvbHVtZXM6CiAge3txdWV1ZU5hbWV9fV9kYXRhOg==" },
              { "path": "docker-compose/docker-compose-kafka.yml",   "contentBase64": "c2VydmljZXM6CiAge3txdWV1ZU5hbWV9fToKICAgIGltYWdlOiBiaXRuYW1pL2thZmthOmxhdGVzdAogICAgZW52aXJvbm1lbnQ6CiAgICAgIEtBRktBX0NGR19OT0RFX0lEOiAiMCIKICAgICAgS0FGS0FfQ0ZHX1BST0NFU1NfUk9MRVM6IGNvbnRyb2xsZXIsYnJva2VyCiAgICAgIEtBRktBX0NGR19MSVNURU5FUlM6IFBMQUlOVEVYVDovLzo5MDkyLENPTlRST0xMRVI6Ly86OTA5MwogICAgICBLQUZLQV9DRkdfQURWRVJUSVNFRF9MSVNURU5FUlM6IFBMQUlOVEVYVDovL3t7cXVldWVOYW1lfX06OTA5MgogICAgICBLQUZLQV9DRkdfTElTVEVORVJfU0VDVVJJVFlfUFJPVE9DT0xfTUFQOiBDT05UUk9MTEVSOlBMQUlOVEVYVCxQTEFJTlRFWFQ6UExBSU5URVhUCiAgICAgIEtBRktBX0NGR19DT05UUk9MTEVSX1FVT1JVTV9WT1RFUlM6IDBAe3txdWV1ZU5hbWV9fTo5MDkzCiAgICAgIEtBRktBX0NGR19DT05UUk9MTEVSX0xJU1RFTkVSX05BTUVTOiBDT05UUk9MTEVSCiAgICAgIEtBRktBX0NGR19OVU1fUEFSVElUSU9OUzogInt7a2Fma2FQYXJ0aXRpb25zfX0iCiAgICAgIEtBRktBX0NGR19ERUZBVUxUX1JFUExJQ0FUSU9OX0ZBQ1RPUjogInt7a2Fma2FSZXBsaWNhdGlvbkZhY3Rvcn19IgogICAgICBLQUZLQV9LUkFGVF9DTFVTVEVSX0lEOiBjaGFuZ2VtZS1jbHVzdGVyLWlkCiAgICBwb3J0czoKICAgICAgLSAiOTA5Mjo5MDkyIgogICAgdm9sdW1lczoKICAgICAgLSB7e3F1ZXVlTmFtZX19X2thZmthX2RhdGE6L2JpdG5hbWkva2Fma2EKCnZvbHVtZXM6CiAge3txdWV1ZU5hbWV9fV9rYWZrYV9kYXRhOg==" },
              { "path": "kubernetes/helm/values-rabbitmq.yaml",      "contentBase64": "IyBCaXRuYW1pIFJhYmJpdE1RIOKAlCB7e3F1ZXVlTmFtZX19CmF1dGg6CiAgdXNlcm5hbWU6IGFkbWluCiAgZXhpc3RpbmdQYXNzd29yZFNlY3JldDoge3txdWV1ZU5hbWV9fS1ybXEtc2VjcmV0CgpwZXJzaXN0ZW5jZToKICBlbmFibGVkOiB0cnVlCiAgc2l6ZTogOEdpCgpyZXNvdXJjZXM6CiAgcmVxdWVzdHM6CiAgICBtZW1vcnk6IDI1Nk1pCiAgICBjcHU6IDEwMG0=" },
              { "path": "kubernetes/helm/values-kafka.yaml",         "contentBase64": "IyBCaXRuYW1pIEthZmthIChLUmFmdCkg4oCUIHt7cXVldWVOYW1lfX0Ka3JhZnQ6CiAgZW5hYmxlZDogdHJ1ZQoKcmVwbGljYUNvdW50OiB7e2thZmthUmVwbGljYXRpb25GYWN0b3J9fQpkZWZhdWx0UmVwbGljYXRpb25GYWN0b3I6IHt7a2Fma2FSZXBsaWNhdGlvbkZhY3Rvcn19Cm51bVBhcnRpdGlvbnM6IHt7a2Fma2FQYXJ0aXRpb25zfX0KCnBlcnNpc3RlbmNlOgogIGVuYWJsZWQ6IHRydWUKICBzaXplOiA4R2kKCnJlc291cmNlczoKICByZXF1ZXN0czoKICAgIG1lbW9yeTogNTEyTWkKICAgIGNwdTogMjUwbQ==" },
              { "path": "kubernetes/helm/install.sh",                "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIEluc3RhbGwge3txdWV1ZU5hbWV9fSB2aWEgSGVsbSAoQml0bmFtaSkKc2V0IC1ldW8gcGlwZWZhaWwKRU5HSU5FPXt7ZW5naW5lfX0KaGVsbSByZXBvIGFkZCBiaXRuYW1pIGh0dHBzOi8vY2hhcnRzLmJpdG5hbWkuY29tL2JpdG5hbWkKaGVsbSByZXBvIHVwZGF0ZQoKaWYgWyAiJEVOR0lORSIgPSAicmFiYml0bXEiIF07IHRoZW4KICBrdWJlY3RsIGNyZWF0ZSBzZWNyZXQgZ2VuZXJpYyB7e3F1ZXVlTmFtZX19LXJtcS1zZWNyZXQgXAogICAgLS1uYW1lc3BhY2Uge3trOHNOYW1lc3BhY2V9fSBcCiAgICAtLWZyb20tbGl0ZXJhbD1yYWJiaXRtcS1wYXNzd29yZD0iJChvcGVuc3NsIHJhbmQgLWhleCAxNikiIFwKICAgIC0tZHJ5LXJ1bj1jbGllbnQgLW8geWFtbCB8IGt1YmVjdGwgYXBwbHkgLWYgLQogIGhlbG0gdXBncmFkZSAtLWluc3RhbGwge3txdWV1ZU5hbWV9fSBiaXRuYW1pL3JhYmJpdG1xIFwKICAgIC0tbmFtZXNwYWNlIHt7azhzTmFtZXNwYWNlfX0gXAogICAgLS1jcmVhdGUtbmFtZXNwYWNlIFwKICAgIC1mIGt1YmVybmV0ZXMvaGVsbS92YWx1ZXMtcmFiYml0bXEueWFtbAplbHNlCiAgaGVsbSB1cGdyYWRlIC0taW5zdGFsbCB7e3F1ZXVlTmFtZX19IGJpdG5hbWkva2Fma2EgXAogICAgLS1uYW1lc3BhY2Uge3trOHNOYW1lc3BhY2V9fSBcCiAgICAtLWNyZWF0ZS1uYW1lc3BhY2UgXAogICAgLWYga3ViZXJuZXRlcy9oZWxtL3ZhbHVlcy1rYWZrYS55YW1sCmZpCmVjaG8gIuKchSB7e3F1ZXVlTmFtZX19ICgkRU5HSU5FKSBkZXBsb3llZCBpbiBuYW1lc3BhY2Uge3trOHNOYW1lc3BhY2V9fSI=" }
            ]
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "resource",
              "name": "{{queueName}}",
              "ownerRef": "{{owner}}",
              "lifecycle": "production",
              "tags": ["message-queue", "{{engine}}"],
              "annotations": {
                "forgeportal.dev/mq-engine": "{{engine}}"
              },
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{queueName}}-mq", "defaultBranch": "main" },
              "spec": { "type": "message-queue", "description": "{{engine}} message broker deployed on {{destination}}" }
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
-- Template: create-k8s-cluster (Story 12-4)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'create-k8s-cluster',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "create-k8s-cluster",
      "title": "Create Kubernetes Cluster",
      "description": "Provision or document a Kubernetes cluster — kind or k3d locally, EKS / GKE / AKS in the cloud — then register it in the catalog.",
      "tags": ["kubernetes", "cluster", "infrastructure", "eks", "gke", "aks", "kind", "k3d"]
    },
    "spec": {
      "parameters": [
        { "id": "clusterName",        "title": "Cluster name",               "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$",                                                                  "description": "Lowercase, letters/numbers/hyphens (e.g. platform-dev)" },
        { "id": "destination",        "title": "Cluster type",               "type": "string",  "required": true,  "enum": ["kind", "k3d", "eks", "gke", "aks"],                                                          "description": "Where to create the cluster" },
        { "id": "owner",              "title": "Owning team",                "type": "string",  "required": true,  "ui": "team-picker",                                                                                   "description": "e.g. team:platform" },
        { "id": "environment",        "title": "Environment",                "type": "string",  "required": true,  "enum": ["development", "staging", "production"], "default": "development" },
        { "id": "kubernetesVersion",  "title": "Kubernetes version",         "type": "string",  "required": false, "default": "1.31",                                                                                     "description": "e.g. 1.29, 1.30, 1.31" },
        { "id": "nodeCount",          "title": "Node count",                 "type": "number",  "required": false, "default": 1,                                                                                          "description": "Number of worker nodes (local: up to 5; cloud: autoscaling min)" },
        { "id": "scmProvider",        "title": "SCM provider",               "type": "string",  "required": true,  "enum": ["github", "gitlab"],                                                                          "description": "Where to push generated config files" },
        { "id": "scmOwner",           "title": "Organisation / Group",       "type": "string",  "required": true,                                                                                                          "description": "GitHub org or GitLab group" },

        { "id": "kindExtraPortMappings", "title": "Expose ports (host:container)", "type": "string",  "required": false, "default": "80:80,443:443", "dependsOn": { "destination": "kind" },                             "description": "Comma-separated host:container port pairs" },
        { "id": "kindIngressReady",   "title": "Pre-configure for ingress-nginx", "type": "boolean", "required": false, "default": true, "dependsOn": { "destination": "kind" },                                        "description": "Adds kubeadm config and installs ingress-nginx after cluster creation" },

        { "id": "k3dLoadBalancer",    "title": "Enable load balancer",       "type": "boolean", "required": false, "default": true, "dependsOn": { "destination": "k3d" } },
        { "id": "k3dRegistry",        "title": "Create local registry",      "type": "boolean", "required": false, "default": false, "dependsOn": { "destination": "k3d" },                                             "description": "Creates a local container registry at registry.localhost:5001" },

        { "id": "region",             "title": "Cloud region",               "type": "string",  "required": false, "default": "eu-west-1",                                                                               "description": "AWS: eu-west-1 / GCP: europe-west1 / Azure: westeurope" },
        { "id": "nodeType",           "title": "Node instance type",         "type": "string",  "required": false, "default": "t3.medium",                                                                               "description": "AWS: t3.medium / GCP: e2-standard-2 / Azure: Standard_D2s_v3" },
        { "id": "infraRepo",          "title": "Infrastructure repository (org/repo)", "type": "string", "required": false,                                                                                              "description": "Repo where Terraform modules live (cloud destinations only)" }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": {
            "provider": "{{scmProvider}}",
            "owner": "{{scmOwner}}",
            "repo": "{{clusterName}}-cluster",
            "visibility": "private",
            "description": "Kubernetes cluster config — {{clusterName}} ({{destination}}, {{environment}})"
          }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{scmProvider}}",
            "owner": "{{scmOwner}}",
            "repo": "{{clusterName}}-cluster",
            "branch": "main",
            "message": "feat: provision {{clusterName}} Kubernetes cluster ({{destination}})",
            "files": [
              { "path": "README.md",                         "contentBase64": "IyB7e2NsdXN0ZXJOYW1lfX0KCj4gS3ViZXJuZXRlcyB7e2t1YmVybmV0ZXNWZXJzaW9ufX0gY2x1c3RlciDigJQge3tkZXN0aW5hdGlvbn19ICh7e2Vudmlyb25tZW50fX0pCgojIyBRdWljayBTdGFydAoKIyMjIGtpbmQgLyBrM2QgKGxvY2FsKQpgYGBiYXNoCmNobW9kICt4IHNldHVwLnNoCi4vc2V0dXAuc2gKYGBgCgojIyMgQ2xvdWQgKEVLUyAvIEdLRSAvIEFLUykKYGBgYmFzaApjZCB0ZXJyYWZvcm0KdGVycmFmb3JtIGluaXQKdGVycmFmb3JtIHBsYW4KdGVycmFmb3JtIGFwcGx5CmBgYAoKIyMgVGVhciBEb3duIChsb2NhbCBvbmx5KQpgYGBiYXNoCmNobW9kICt4IHRlYXJkb3duLnNoCi4vdGVhcmRvd24uc2gKYGBgCgojIyBGb3JnZVBvcnRhbApUaGlzIGNsdXN0ZXIgaXMgdHJhY2tlZCBpbiB0aGUgY2F0YWxvZzogW1ZpZXcgZW50aXR5XShodHRwOi8vbG9jYWxob3N0OjMwMDAvY2F0YWxvZyk=" },
              { "path": "entity.yaml",                       "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogcmVzb3VyY2UKbWV0YWRhdGE6CiAgbmFtZToge3tjbHVzdGVyTmFtZX19CiAgbmFtZXNwYWNlOiBkZWZhdWx0CiAgYW5ub3RhdGlvbnM6CiAgICBmb3JnZXBvcnRhbC5kZXYvY2x1c3Rlci10eXBlOiAie3tkZXN0aW5hdGlvbn19IgogICAgZm9yZ2Vwb3J0YWwuZGV2L2NsdXN0ZXItdmVyc2lvbjogInt7a3ViZXJuZXRlc1ZlcnNpb259fSIKICAgIGZvcmdlcG9ydGFsLmRldi9rOHMtY2x1c3RlcjogInt7Y2x1c3Rlck5hbWV9fSIKc3BlYzoKICBvd25lcjoge3tvd25lcn19CiAgbGlmZWN5Y2xlOiB7e2Vudmlyb25tZW50fX0KICB0eXBlOiBjbHVzdGVyCiAgZGVzY3JpcHRpb246ICJLdWJlcm5ldGVzIHt7a3ViZXJuZXRlc1ZlcnNpb259fSBjbHVzdGVyIOKAlCB7e2Rlc3RpbmF0aW9ufX0gKHt7ZW52aXJvbm1lbnR9fSkiCiAgdGFnczoKICAgIC0ga3ViZXJuZXRlcwogICAgLSBjbHVzdGVyCiAgICAtICJ7e2Rlc3RpbmF0aW9ufX0iCiAgICAtICJ7e2Vudmlyb25tZW50fX0i" },
              { "path": "kind/kind.yaml",                    "contentBase64": "a2luZDogQ2x1c3RlcgphcGlWZXJzaW9uOiBraW5kLngtazhzLmlvL3YxYWxwaGE0Cm5hbWU6IHt7Y2x1c3Rlck5hbWV9fQpub2RlczoKICAtIHJvbGU6IGNvbnRyb2wtcGxhbmUKICAgIGt1YmVhZG1Db25maWdQYXRjaGVzOgogICAgICAtIHwKICAgICAgICBraW5kOiBJbml0Q29uZmlndXJhdGlvbgogICAgICAgIG5vZGVSZWdpc3RyYXRpb246CiAgICAgICAgICBrdWJlbGV0RXh0cmFBcmdzOgogICAgICAgICAgICBub2RlLWxhYmVsczogImluZ3Jlc3MtcmVhZHk9dHJ1ZSIKICAgIGV4dHJhUG9ydE1hcHBpbmdzOgogICAgICAtIGNvbnRhaW5lclBvcnQ6IDgwCiAgICAgICAgaG9zdFBvcnQ6IDgwCiAgICAgICAgcHJvdG9jb2w6IFRDUAogICAgICAtIGNvbnRhaW5lclBvcnQ6IDQ0MwogICAgICAgIGhvc3RQb3J0OiA0NDMKICAgICAgICBwcm90b2NvbDogVENQCiAgIyBBZGQgd29ya2VyIG5vZGVzIGJ5IGR1cGxpY2F0aW5nIHRoZSBlbnRyeSBiZWxvdwogICMgLSByb2xlOiB3b3JrZXI=" },
              { "path": "kind/setup.sh",                     "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIENyZWF0ZSBraW5kIGNsdXN0ZXI6IHt7Y2x1c3Rlck5hbWV9fQpzZXQgLWV1byBwaXBlZmFpbAoKZWNobyAi4pqhIENyZWF0aW5nIGtpbmQgY2x1c3Rlcjoge3tjbHVzdGVyTmFtZX19IgpraW5kIGNyZWF0ZSBjbHVzdGVyIC0tY29uZmlnIGtpbmQva2luZC55YW1sIC0tbmFtZSB7e2NsdXN0ZXJOYW1lfX0Ka3ViZWN0bCBjbHVzdGVyLWluZm8gLS1jb250ZXh0IGtpbmQte3tjbHVzdGVyTmFtZX19CgplY2hvICIiCmVjaG8gIuKchSBDbHVzdGVyIHJlYWR5LiBDb250ZXh0OiBraW5kLXt7Y2x1c3Rlck5hbWV9fSIKZWNobyAiIgplY2hvICJJbnN0YWxsaW5nIGluZ3Jlc3MtbmdpbnguLi4iCmt1YmVjdGwgYXBwbHkgLWYgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL2t1YmVybmV0ZXMvaW5ncmVzcy1uZ2lueC9tYWluL2RlcGxveS9zdGF0aWMvcHJvdmlkZXIva2luZC9kZXBsb3kueWFtbAprdWJlY3RsIHdhaXQgLS1uYW1lc3BhY2UgaW5ncmVzcy1uZ2lueCBcCiAgLS1mb3I9Y29uZGl0aW9uPXJlYWR5IHBvZCBcCiAgLS1zZWxlY3Rvcj1hcHAua3ViZXJuZXRlcy5pby9jb21wb25lbnQ9Y29udHJvbGxlciBcCiAgLS10aW1lb3V0PTkwcwplY2hvICLinIUgaW5ncmVzcy1uZ2lueCByZWFkeSIKZWNobyAiIgplY2hvICJLdWJlY29uZmlnIGNvbnRleHQ6IGtpbmQte3tjbHVzdGVyTmFtZX19IgplY2hvICJTd2l0Y2ggd2l0aDoga3ViZWN0bCBjb25maWcgdXNlLWNvbnRleHQga2luZC17e2NsdXN0ZXJOYW1lfX0i" },
              { "path": "kind/teardown.sh",                  "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIERlbGV0ZSBraW5kIGNsdXN0ZXI6IHt7Y2x1c3Rlck5hbWV9fQpzZXQgLWV1byBwaXBlZmFpbAoKZWNobyAi8J+Xke+4jyAgRGVsZXRpbmcga2luZCBjbHVzdGVyOiB7e2NsdXN0ZXJOYW1lfX0iCmtpbmQgZGVsZXRlIGNsdXN0ZXIgLS1uYW1lIHt7Y2x1c3Rlck5hbWV9fQplY2hvICLinIUgQ2x1c3RlciB7e2NsdXN0ZXJOYW1lfX0gZGVsZXRlZCI=" },
              { "path": "k3d/setup.sh",                      "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIENyZWF0ZSBrM2QgY2x1c3Rlcjoge3tjbHVzdGVyTmFtZX19CnNldCAtZXVvIHBpcGVmYWlsCgplY2hvICLimqEgQ3JlYXRpbmcgazNkIGNsdXN0ZXI6IHt7Y2x1c3Rlck5hbWV9fSIKazNkIGNsdXN0ZXIgY3JlYXRlIHt7Y2x1c3Rlck5hbWV9fSBcCiAgLS1hZ2VudHMge3tub2RlQ291bnR9fSBcCiAgLS1wb3J0ICI4MDo4MEBsb2FkYmFsYW5jZXIiIFwKICAtLXBvcnQgIjQ0Mzo0NDNAbG9hZGJhbGFuY2VyIiBcCiAgLS1rM3MtYXJnICItLWRpc2FibGU9dHJhZWZpa0BzZXJ2ZXI6MCIgXAogIC0taW1hZ2UgcmFuY2hlci9rM3M6dnt7a3ViZXJuZXRlc1ZlcnNpb259fS1rM3MxCgplY2hvICIiCmVjaG8gIuKchSBrM2QgY2x1c3RlciB7e2NsdXN0ZXJOYW1lfX0gcmVhZHkiCmt1YmVjdGwgY2x1c3Rlci1pbmZvCmVjaG8gIkt1YmVjb25maWcgY29udGV4dDogazNkLXt7Y2x1c3Rlck5hbWV9fSIKZWNobyAiU3dpdGNoIHdpdGg6IGt1YmVjdGwgY29uZmlnIHVzZS1jb250ZXh0IGszZC17e2NsdXN0ZXJOYW1lfX0iCgojIE9wdGlvbmFsOiBjcmVhdGUgbG9jYWwgcmVnaXN0cnkKIyBrM2QgcmVnaXN0cnkgY3JlYXRlIHJlZ2lzdHJ5LmxvY2FsaG9zdCAtLXBvcnQgNTAwMQ==" },
              { "path": "k3d/teardown.sh",                   "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaAojIERlbGV0ZSBrM2QgY2x1c3Rlcjoge3tjbHVzdGVyTmFtZX19CnNldCAtZXVvIHBpcGVmYWlsCgplY2hvICLwn5eR77iPICBEZWxldGluZyBrM2QgY2x1c3Rlcjoge3tjbHVzdGVyTmFtZX19IgprM2QgY2x1c3RlciBkZWxldGUge3tjbHVzdGVyTmFtZX19CmVjaG8gIuKchSBDbHVzdGVyIHt7Y2x1c3Rlck5hbWV9fSBkZWxldGVkIg==" },
              { "path": "eks/terraform/main.tf",              "contentBase64": "bW9kdWxlICJla3MiIHsKICBzb3VyY2UgID0gInRlcnJhZm9ybS1hd3MtbW9kdWxlcy9la3MvYXdzIgogIHZlcnNpb24gPSAifj4gMjAuMCIKCiAgY2x1c3Rlcl9uYW1lICAgID0gInt7Y2x1c3Rlck5hbWV9fSIKICBjbHVzdGVyX3ZlcnNpb24gPSAie3trdWJlcm5ldGVzVmVyc2lvbn19IgoKICBjbHVzdGVyX2VuZHBvaW50X3B1YmxpY19hY2Nlc3MgPSB0cnVlCgogIHZwY19pZCAgICAgPSB2YXIudnBjX2lkCiAgc3VibmV0X2lkcyA9IHZhci5zdWJuZXRfaWRzCgogIGVrc19tYW5hZ2VkX25vZGVfZ3JvdXBzID0gewogICAgZGVmYXVsdCA9IHsKICAgICAgbWluX3NpemUgICAgICAgPSB7e25vZGVDb3VudH19CiAgICAgIG1heF9zaXplICAgICAgID0ge3tub2RlQ291bnR9fQogICAgICBkZXNpcmVkX3NpemUgICA9IHt7bm9kZUNvdW50fX0KICAgICAgaW5zdGFuY2VfdHlwZXMgPSBbInt7bm9kZVR5cGV9fSJdCiAgICB9CiAgfQoKICB0YWdzID0gewogICAgRW52aXJvbm1lbnQgPSAie3tlbnZpcm9ubWVudH19IgogICAgT3duZXIgICAgICAgPSAie3tvd25lcn19IgogICAgTWFuYWdlZEJ5ICAgPSAiZm9yZ2Vwb3J0YWwiCiAgfQp9CgpvdXRwdXQgImNsdXN0ZXJfZW5kcG9pbnQiIHsKICB2YWx1ZSA9IG1vZHVsZS5la3MuY2x1c3Rlcl9lbmRwb2ludAp9CgpvdXRwdXQgImNsdXN0ZXJfbmFtZSIgewogIHZhbHVlID0gbW9kdWxlLmVrcy5jbHVzdGVyX25hbWUKfQ==" },
              { "path": "eks/terraform/variables.tf",         "contentBase64": "dmFyaWFibGUgInZwY19pZCIgewogIHR5cGUgICAgICAgID0gc3RyaW5nCiAgZGVzY3JpcHRpb24gPSAiVlBDIElEIGZvciB0aGUgRUtTIGNsdXN0ZXIiCn0KCnZhcmlhYmxlICJzdWJuZXRfaWRzIiB7CiAgdHlwZSAgICAgICAgPSBsaXN0KHN0cmluZykKICBkZXNjcmlwdGlvbiA9ICJTdWJuZXQgSURzIGZvciB0aGUgRUtTIG5vZGUgZ3JvdXBzIgp9" },
              { "path": "gke/terraform/main.tf",              "contentBase64": "bW9kdWxlICJna2UiIHsKICBzb3VyY2UgID0gInRlcnJhZm9ybS1nb29nbGUtbW9kdWxlcy9rdWJlcm5ldGVzLWVuZ2luZS9nb29nbGUiCiAgdmVyc2lvbiA9ICJ+PiAzMS4wIgoKICBwcm9qZWN0X2lkICAgICAgICAgPSB2YXIucHJvamVjdF9pZAogIG5hbWUgICAgICAgICAgICAgICA9ICJ7e2NsdXN0ZXJOYW1lfX0iCiAgcmVnaW9uICAgICAgICAgICAgID0gInt7cmVnaW9ufX0iCiAgem9uZXMgICAgICAgICAgICAgID0gWyJ7e3JlZ2lvbn19LWEiXQogIG5ldHdvcmsgICAgICAgICAgICA9IHZhci5uZXR3b3JrCiAgc3VibmV0d29yayAgICAgICAgID0gdmFyLnN1Ym5ldHdvcmsKICBrdWJlcm5ldGVzX3ZlcnNpb24gPSAie3trdWJlcm5ldGVzVmVyc2lvbn19IgoKICBub2RlX3Bvb2xzID0gW3sKICAgIG5hbWUgICAgICAgICA9ICJkZWZhdWx0LXBvb2wiCiAgICBtYWNoaW5lX3R5cGUgPSAie3tub2RlVHlwZX19IgogICAgbm9kZV9jb3VudCAgID0ge3tub2RlQ291bnR9fQogICAgYXV0b3NjYWxpbmcgID0gdHJ1ZQogICAgbWluX2NvdW50ICAgID0ge3tub2RlQ291bnR9fQogICAgbWF4X2NvdW50ICAgID0ge3tub2RlQ291bnR9fQogIH1dCgogIG5vZGVfcG9vbHNfbGFiZWxzID0gewogICAgZGVmYXVsdC1wb29sID0gewogICAgICBlbnZpcm9ubWVudCA9ICJ7e2Vudmlyb25tZW50fX0iCiAgICAgIG93bmVyICAgICAgID0gInt7b3duZXJ9fSIKICAgICAgbWFuYWdlZC1ieSAgPSAiZm9yZ2Vwb3J0YWwiCiAgICB9CiAgfQp9CgpvdXRwdXQgImNsdXN0ZXJfZW5kcG9pbnQiIHsKICB2YWx1ZSA9IG1vZHVsZS5na2UuZW5kcG9pbnQKfQoKb3V0cHV0ICJjbHVzdGVyX25hbWUiIHsKICB2YWx1ZSA9IG1vZHVsZS5na2UubmFtZQp9" },
              { "path": "gke/terraform/variables.tf",         "contentBase64": "dmFyaWFibGUgInByb2plY3RfaWQiIHsKICB0eXBlICAgICAgICA9IHN0cmluZwogIGRlc2NyaXB0aW9uID0gIkdDUCBwcm9qZWN0IElEIgp9Cgp2YXJpYWJsZSAibmV0d29yayIgewogIHR5cGUgICAgICAgID0gc3RyaW5nCiAgZGVzY3JpcHRpb24gPSAiVlBDIG5ldHdvcmsgbmFtZSIKICBkZWZhdWx0ICAgICA9ICJkZWZhdWx0Igp9Cgp2YXJpYWJsZSAic3VibmV0d29yayIgewogIHR5cGUgICAgICAgID0gc3RyaW5nCiAgZGVzY3JpcHRpb24gPSAiVlBDIHN1Ym5ldHdvcmsgbmFtZSIKICBkZWZhdWx0ICAgICA9ICJkZWZhdWx0Igp9" },
              { "path": "aks/terraform/main.tf",              "contentBase64": "cmVzb3VyY2UgImF6dXJlcm1fa3ViZXJuZXRlc19jbHVzdGVyIiAibWFpbiIgewogIG5hbWUgICAgICAgICAgICAgICAgPSAie3tjbHVzdGVyTmFtZX19IgogIGxvY2F0aW9uICAgICAgICAgICAgPSAie3tyZWdpb259fSIKICByZXNvdXJjZV9ncm91cF9uYW1lID0gdmFyLnJlc291cmNlX2dyb3VwX25hbWUKICBkbnNfcHJlZml4ICAgICAgICAgID0gInt7Y2x1c3Rlck5hbWV9fSIKICBrdWJlcm5ldGVzX3ZlcnNpb24gID0gInt7a3ViZXJuZXRlc1ZlcnNpb259fSIKCiAgZGVmYXVsdF9ub2RlX3Bvb2wgewogICAgbmFtZSAgICAgICAgICAgICAgICA9ICJkZWZhdWx0IgogICAgbm9kZV9jb3VudCAgICAgICAgICA9IHt7bm9kZUNvdW50fX0KICAgIHZtX3NpemUgICAgICAgICAgICAgPSAie3tub2RlVHlwZX19IgogICAgZW5hYmxlX2F1dG9fc2NhbGluZyA9IHRydWUKICAgIG1pbl9jb3VudCAgICAgICAgICAgPSB7e25vZGVDb3VudH19CiAgICBtYXhfY291bnQgICAgICAgICAgID0ge3tub2RlQ291bnR9fQogIH0KCiAgaWRlbnRpdHkgewogICAgdHlwZSA9ICJTeXN0ZW1Bc3NpZ25lZCIKICB9CgogIHRhZ3MgPSB7CiAgICBlbnZpcm9ubWVudCA9ICJ7e2Vudmlyb25tZW50fX0iCiAgICBvd25lciAgICAgICA9ICJ7e293bmVyfX0iCiAgICBtYW5hZ2VkX2J5ICA9ICJmb3JnZXBvcnRhbCIKICB9Cn0KCm91dHB1dCAia3ViZV9jb25maWciIHsKICB2YWx1ZSAgICAgPSBhenVyZXJtX2t1YmVybmV0ZXNfY2x1c3Rlci5tYWluLmt1YmVfY29uZmlnX3JhdwogIHNlbnNpdGl2ZSA9IHRydWUKfQoKb3V0cHV0ICJjbHVzdGVyX25hbWUiIHsKICB2YWx1ZSA9IGF6dXJlcm1fa3ViZXJuZXRlc19jbHVzdGVyLm1haW4ubmFtZQp9" },
              { "path": "aks/terraform/variables.tf",         "contentBase64": "dmFyaWFibGUgInJlc291cmNlX2dyb3VwX25hbWUiIHsKICB0eXBlICAgICAgICA9IHN0cmluZwogIGRlc2NyaXB0aW9uID0gIkF6dXJlIHJlc291cmNlIGdyb3VwIG5hbWUiCn0=" }
            ]
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "resource",
              "name": "{{clusterName}}",
              "ownerRef": "{{owner}}",
              "lifecycle": "{{environment}}",
              "tags": ["kubernetes", "cluster", "{{destination}}", "{{environment}}"],
              "annotations": {
                "forgeportal.dev/cluster-type": "{{destination}}",
                "forgeportal.dev/cluster-version": "{{kubernetesVersion}}",
                "forgeportal.dev/k8s-cluster": "{{clusterName}}"
              },
              "scm": { "provider": "{{scmProvider}}", "owner": "{{scmOwner}}", "repo": "{{clusterName}}-cluster", "defaultBranch": "main" },
              "spec": { "type": "cluster", "description": "Kubernetes {{kubernetesVersion}} cluster — {{destination}} ({{environment}})" }
            },
            "source": { "provider": "{{scmProvider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":         "{{steps.create-repo.outputs.repoUrl}}",
        "entityId":        "{{steps.register.outputs.entityId}}",
        "setupCommand":    "bash kind/setup.sh",
        "kubeconfigContext": "kind-{{clusterName}}"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

-- Template: create-monitoring-stack (Story 12-5)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'create-monitoring-stack',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "create-monitoring-stack",
      "title": "Create Monitoring Stack (Prometheus + Grafana)",
      "description": "Deploy Prometheus + Grafana + Alertmanager on Kubernetes (kube-prometheus-stack Helm) or Docker Compose for local dev — then register it in the catalog.",
      "tags": ["monitoring", "prometheus", "grafana", "alertmanager", "observability", "infrastructure"]
    },
    "spec": {
      "parameters": [
        { "id": "stackName",             "title": "Stack name",                      "type": "string",  "required": true,  "default": "monitoring", "pattern": "^[a-z][a-z0-9-]{1,30}$",                                    "description": "e.g. monitoring, observability" },
        { "id": "destination",           "title": "Destination",                     "type": "string",  "required": true,  "enum": ["kubernetes", "docker-compose"],                                                         "description": "Where to deploy the monitoring stack" },
        { "id": "owner",                 "title": "Owning team",                     "type": "string",  "required": true,  "ui": "team-picker",                                                                              "description": "e.g. team:platform" },
        { "id": "scmProvider",           "title": "SCM provider",                    "type": "string",  "required": true,  "enum": ["github", "gitlab"],                                                                     "description": "Where to push generated config files" },
        { "id": "scmOwner",              "title": "Organisation / Group",            "type": "string",  "required": true,                                                                                                     "description": "GitHub org or GitLab group" },

        { "id": "scrapeForgePortal",     "title": "Scrape ForgePortal metrics",      "type": "boolean", "required": false, "default": true,                                                                                  "description": "Add a scrape config for ForgePortal /metrics endpoint" },
        { "id": "alertsEnabled",         "title": "Enable default alerts",           "type": "boolean", "required": false, "default": true,                                                                                  "description": "CPU >80%, memory >85%, pod CrashLoopBackOff, PVC >90%" },
        { "id": "grafanaAdminPassword",  "title": "Grafana admin password",          "type": "string",  "required": false, "default": "admin",                                                                               "description": "Password for the Grafana admin user" },

        { "id": "k8sNamespace",          "title": "Kubernetes namespace",            "type": "string",  "required": false, "default": "monitoring",  "dependsOn": { "destination": "kubernetes" },                          "description": "Namespace to deploy the stack into" },
        { "id": "persistence",           "title": "Enable persistence (PVC)",        "type": "boolean", "required": false, "default": false,          "dependsOn": { "destination": "kubernetes" },                          "description": "Recommended for production" },

        { "id": "grafanaPort",           "title": "Grafana port (local)",            "type": "number",  "required": false, "default": 3001,           "dependsOn": { "destination": "docker-compose" } },
        { "id": "prometheusPort",        "title": "Prometheus port (local)",         "type": "number",  "required": false, "default": 9090,           "dependsOn": { "destination": "docker-compose" } }
      ],
      "steps": [
        {
          "id": "create-repo",
          "action": "scm.createRepo@v1",
          "input": {
            "provider": "{{scmProvider}}",
            "owner": "{{scmOwner}}",
            "repo": "{{stackName}}-monitoring",
            "visibility": "private",
            "description": "Monitoring stack — {{stackName}} (Prometheus + Grafana, {{destination}})"
          }
        },
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{scmProvider}}",
            "owner": "{{scmOwner}}",
            "repo": "{{stackName}}-monitoring",
            "branch": "main",
            "message": "feat: provision {{stackName}} monitoring stack ({{destination}})",
            "files": [
              { "path": "README.md",                              "contentBase64": "IyB7e3N0YWNrTmFtZX19IOKAlCBNb25pdG9yaW5nIFN0YWNrCgpQcm9tZXRoZXVzICsgR3JhZmFuYSArIEFsZXJ0bWFuYWdlciBkZXBsb3llZCB2aWEgRm9yZ2VQb3J0YWwgdGVtcGxhdGUuCgoqKkRlc3RpbmF0aW9uOioqIHt7ZGVzdGluYXRpb259fQoqKk93bmVyOioqIHt7b3duZXJ9fQoKIyMgS3ViZXJuZXRlcwoKYGBgYmFzaApiYXNoIGhlbG0vaW5zdGFsbC5zaApgYGAKCkFjY2VzczoKLSBHcmFmYW5hOiBga3ViZWN0bCBwb3J0LWZvcndhcmQgLW4ge3trOHNOYW1lc3BhY2V9fSBzdmMve3tzdGFja05hbWV9fS1ncmFmYW5hIDMwMDA6ODBgCi0gUHJvbWV0aGV1czogYGt1YmVjdGwgcG9ydC1mb3J3YXJkIC1uIHt7azhzTmFtZXNwYWNlfX0gc3ZjL3t7c3RhY2tOYW1lfX0ta3ViZS1wcm9tZXRoZXVzLXByb21ldGhldXMgOTA5MDo5MDkwYAoKIyMgRG9ja2VyIENvbXBvc2UKCmBgYGJhc2gKZG9ja2VyIGNvbXBvc2UgdXAgLWQKYGBgCgpBY2Nlc3M6Ci0gR3JhZmFuYTogICAgaHR0cDovL2xvY2FsaG9zdDp7e2dyYWZhbmFQb3J0fX0KLSBQcm9tZXRoZXVzOiBodHRwOi8vbG9jYWxob3N0Ont7cHJvbWV0aGV1c1BvcnR9fQo=" },
              { "path": "entity.yaml",                            "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwuZGV2L3YxYWxwaGExCmtpbmQ6IFJlc291cmNlCm1ldGFkYXRhOgogIG5hbWU6IHt7c3RhY2tOYW1lfX0KICBhbm5vdGF0aW9uczoKICAgIGZvcmdlcG9ydGFsLmRldi9tYW5hZ2VkLWJ5OiBmb3JnZXBvcnRhbC10ZW1wbGF0ZQogICAgZm9yZ2Vwb3J0YWwuZGV2L2dyYWZhbmEtZGFzaGJvYXJkLXVybDogImh0dHA6Ly9sb2NhbGhvc3Q6e3tncmFmYW5hUG9ydH19IgogICAgZm9yZ2Vwb3J0YWwuZGV2L3Byb21ldGhldXMtdXJsOiAiaHR0cDovL2xvY2FsaG9zdDp7e3Byb21ldGhldXNQb3J0fX0iCnNwZWM6CiAgdHlwZTogbW9uaXRvcmluZwogIG93bmVyOiB7e293bmVyfX0KICBsaWZlY3ljbGU6IHByb2R1Y3Rpb24K" },
              { "path": "helm/values.yaml",                       "contentBase64": "IyBrdWJlLXByb21ldGhldXMtc3RhY2sgSGVsbSB2YWx1ZXMKIyBHZW5lcmF0ZWQgYnkgRm9yZ2VQb3J0YWwgdGVtcGxhdGUgY3JlYXRlLW1vbml0b3Jpbmctc3RhY2sKCmdyYWZhbmE6CiAgYWRtaW5QYXNzd29yZDogInt7Z3JhZmFuYUFkbWluUGFzc3dvcmR9fSIKICBwZXJzaXN0ZW5jZToKICAgIGVuYWJsZWQ6IHt7cGVyc2lzdGVuY2V9fQogIGRhc2hib2FyZFByb3ZpZGVyczoKICAgIGRhc2hib2FyZHByb3ZpZGVycy55YW1sOgogICAgICBhcGlWZXJzaW9uOiAxCiAgICAgIHByb3ZpZGVyczoKICAgICAgICAtIG5hbWU6IGZvcmdlcG9ydGFsCiAgICAgICAgICBvcmdJZDogMQogICAgICAgICAgZm9sZGVyOiBGb3JnZVBvcnRhbAogICAgICAgICAgdHlwZTogZmlsZQogICAgICAgICAgZGlzYWJsZURlbGV0aW9uOiBmYWxzZQogICAgICAgICAgb3B0aW9uczoKICAgICAgICAgICAgcGF0aDogL3Zhci9saWIvZ3JhZmFuYS9kYXNoYm9hcmRzL2ZvcmdlcG9ydGFsCgpwcm9tZXRoZXVzOgogIHByb21ldGhldXNTcGVjOgogICAgcmV0ZW50aW9uOiAxNWQKICAgIHt7I2lmIHNjcmFwZUZvcmdlUG9ydGFsfX0KICAgIGFkZGl0aW9uYWxTY3JhcGVDb25maWdzOgogICAgICAtIGpvYl9uYW1lOiBmb3JnZXBvcnRhbC1hcGkKICAgICAgICBzdGF0aWNfY29uZmlnczoKICAgICAgICAgIC0gdGFyZ2V0czogWyJmb3JnZXBvcnRhbC1hcGk6NDAwMCJdCiAgICAgICAgbWV0cmljc19wYXRoOiAvbWV0cmljcwogICAge3svaWZ9fQoKe3sjaWYgYWxlcnRzRW5hYmxlZH19CmRlZmF1bHRSdWxlczoKICBjcmVhdGU6IHRydWUKICBydWxlczoKICAgIGFsZXJ0bWFuYWdlcjogdHJ1ZQogICAgZXRjZDogZmFsc2UKICAgIGt1YmVBcGlzZXJ2ZXJBdmFpbGFiaWxpdHk6IHRydWUKICAgIG5vZGU6IHRydWUKICAgIGt1YmVQcm9tZXRoZXVzTm9kZUFsZXJ0aW5nOiB0cnVlCnt7L2lmfX0KCmFsZXJ0bWFuYWdlcjoKICBlbmFibGVkOiB7e2FsZXJ0c0VuYWJsZWR9fQo=" },
              { "path": "helm/install.sh",                        "contentBase64": "IyEvdXNyL2Jpbi9lbnYgYmFzaApzZXQgLWV1byBwaXBlZmFpbAoKU1RBQ0tfTkFNRT0ie3tzdGFja05hbWV9fSIKTkFNRVNQQUNFPSJ7e2s4c05hbWVzcGFjZX19IgoKZWNobyAi8J+TpiBBZGRpbmcgcHJvbWV0aGV1cy1jb21tdW5pdHkgSGVsbSByZXBvLi4uIgpoZWxtIHJlcG8gYWRkIHByb21ldGhldXMtY29tbXVuaXR5IGh0dHBzOi8vcHJvbWV0aGV1cy1jb21tdW5pdHkuZ2l0aHViLmlvL2hlbG0tY2hhcnRzCmhlbG0gcmVwbyB1cGRhdGUKCmVjaG8gIvCfmoAgSW5zdGFsbGluZyBrdWJlLXByb21ldGhldXMtc3RhY2suLi4iCmhlbG0gdXBncmFkZSAtLWluc3RhbGwgIiRTVEFDS19OQU1FIiBwcm9tZXRoZXVzLWNvbW11bml0eS9rdWJlLXByb21ldGhldXMtc3RhY2sgXAogIC0tbmFtZXNwYWNlICIkTkFNRVNQQUNFIiBcCiAgLS1jcmVhdGUtbmFtZXNwYWNlIFwKICAtZiBoZWxtL3ZhbHVlcy55YW1sIFwKICAtLXdhaXQgXAogIC0tdGltZW91dCA1bQoKZWNobyAiIgplY2hvICLinIUgTW9uaXRvcmluZyBzdGFjayByZWFkeSEiCmVjaG8gIiIKZWNobyAiICAgR3JhZmFuYTogICAga3ViZWN0bCBwb3J0LWZvcndhcmQgLW4gJE5BTUVTUEFDRSBzdmMvJFNUQUNLX05BTUUtZ3JhZmFuYSAzMDAwOjgwIgplY2hvICIgICBQcm9tZXRoZXVzOiBrdWJlY3RsIHBvcnQtZm9yd2FyZCAtbiAkTkFNRVNQQUNFIHN2Yy8kU1RBQ0tfTkFNRS1rdWJlLXByb21ldGhldXMtcHJvbWV0aGV1cyA5MDkwOjkwOTAiCg==" },
              { "path": "docker-compose/docker-compose.yml",      "contentBase64": "dmVyc2lvbjogIjMuOCIKCnNlcnZpY2VzOgogIHByb21ldGhldXM6CiAgICBpbWFnZTogcHJvbS9wcm9tZXRoZXVzOmxhdGVzdAogICAgY29udGFpbmVyX25hbWU6IHt7c3RhY2tOYW1lfX0tcHJvbWV0aGV1cwogICAgcG9ydHM6CiAgICAgIC0gInt7cHJvbWV0aGV1c1BvcnR9fTo5MDkwIgogICAgdm9sdW1lczoKICAgICAgLSAuL3Byb21ldGhldXMueW1sOi9ldGMvcHJvbWV0aGV1cy9wcm9tZXRoZXVzLnltbDpybwogICAgICAtIHByb21ldGhldXNfZGF0YTovcHJvbWV0aGV1cwogICAgY29tbWFuZDoKICAgICAgLSAiLS1jb25maWcuZmlsZT0vZXRjL3Byb21ldGhldXMvcHJvbWV0aGV1cy55bWwiCiAgICAgIC0gIi0tc3RvcmFnZS50c2RiLnJldGVudGlvbi50aW1lPTE1ZCIKICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkCgogIGdyYWZhbmE6CiAgICBpbWFnZTogZ3JhZmFuYS9ncmFmYW5hOmxhdGVzdAogICAgY29udGFpbmVyX25hbWU6IHt7c3RhY2tOYW1lfX0tZ3JhZmFuYQogICAgcG9ydHM6CiAgICAgIC0gInt7Z3JhZmFuYVBvcnR9fTozMDAwIgogICAgZW52aXJvbm1lbnQ6CiAgICAgIEdGX1NFQ1VSSVRZX0FETUlOX1BBU1NXT1JEOiAie3tncmFmYW5hQWRtaW5QYXNzd29yZH19IgogICAgICBHRl9VU0VSU19BTExPV19TSUdOX1VQOiAiZmFsc2UiCiAgICB2b2x1bWVzOgogICAgICAtIGdyYWZhbmFfZGF0YTovdmFyL2xpYi9ncmFmYW5hCiAgICBkZXBlbmRzX29uOgogICAgICAtIHByb21ldGhldXMKICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkCgogIHt7I2lmIGFsZXJ0c0VuYWJsZWR9fQogIGFsZXJ0bWFuYWdlcjoKICAgIGltYWdlOiBwcm9tL2FsZXJ0bWFuYWdlcjpsYXRlc3QKICAgIGNvbnRhaW5lcl9uYW1lOiB7e3N0YWNrTmFtZX19LWFsZXJ0bWFuYWdlcgogICAgcG9ydHM6CiAgICAgIC0gIjkwOTM6OTA5MyIKICAgIHZvbHVtZXM6CiAgICAgIC0gLi9hbGVydG1hbmFnZXIueW1sOi9ldGMvYWxlcnRtYW5hZ2VyL2FsZXJ0bWFuYWdlci55bWw6cm8KICAgIHJlc3RhcnQ6IHVubGVzcy1zdG9wcGVkCiAge3svaWZ9fQoKdm9sdW1lczoKICBwcm9tZXRoZXVzX2RhdGE6CiAgZ3JhZmFuYV9kYXRhOgo=" },
              { "path": "docker-compose/prometheus.yml",           "contentBase64": "Z2xvYmFsOgogIHNjcmFwZV9pbnRlcnZhbDogMTVzCiAgZXZhbHVhdGlvbl9pbnRlcnZhbDogMTVzCgpzY3JhcGVfY29uZmlnczoKICAtIGpvYl9uYW1lOiBwcm9tZXRoZXVzCiAgICBzdGF0aWNfY29uZmlnczoKICAgICAgLSB0YXJnZXRzOiBbImxvY2FsaG9zdDo5MDkwIl0KCiAge3sjaWYgc2NyYXBlRm9yZ2VQb3J0YWx9fQogIC0gam9iX25hbWU6IGZvcmdlcG9ydGFsLWFwaQogICAgc3RhdGljX2NvbmZpZ3M6CiAgICAgIC0gdGFyZ2V0czogWyJhcGk6NDAwMCJdCiAgICBtZXRyaWNzX3BhdGg6IC9tZXRyaWNzCiAgICBzY3JhcGVfaW50ZXJ2YWw6IDMwcwogIHt7L2lmfX0KCiAge3sjaWYgYWxlcnRzRW5hYmxlZH19CiAgLSBqb2JfbmFtZTogYWxlcnRtYW5hZ2VyCiAgICBzdGF0aWNfY29uZmlnczoKICAgICAgLSB0YXJnZXRzOiBbImFsZXJ0bWFuYWdlcjo5MDkzIl0KICB7ey9pZn19Cg==" },
              { "path": "docker-compose/alertmanager.yml",         "contentBase64": "Z2xvYmFsOgogIHJlc29sdmVfdGltZW91dDogNW0KCnJvdXRlOgogIGdyb3VwX2J5OiBbJ2FsZXJ0bmFtZSddCiAgZ3JvdXBfd2FpdDogMzBzCiAgZ3JvdXBfaW50ZXJ2YWw6IDVtCiAgcmVwZWF0X2ludGVydmFsOiAxaAogIHJlY2VpdmVyOiAnbnVsbCcKCnJlY2VpdmVyczoKICAtIG5hbWU6ICdudWxsJwo=" }
            ]
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "resource",
              "name": "{{stackName}}",
              "ownerRef": "{{owner}}",
              "lifecycle": "production",
              "tags": ["monitoring", "prometheus", "grafana", "{{destination}}"],
              "annotations": {
                "forgeportal.dev/grafana-dashboard-url": "http://localhost:{{grafanaPort}}",
                "forgeportal.dev/prometheus-url": "http://localhost:{{prometheusPort}}",
                "forgeportal.dev/managed-by": "forgeportal-template"
              },
              "scm": { "provider": "{{scmProvider}}", "owner": "{{scmOwner}}", "repo": "{{stackName}}-monitoring", "defaultBranch": "main" },
              "spec": { "type": "monitoring", "description": "Prometheus + Grafana monitoring stack — {{destination}}" }
            },
            "source": { "provider": "{{scmProvider}}", "repoUrl": "{{steps.create-repo.outputs.repoUrl}}", "path": "/" }
          }
        }
      ],
      "outputs": {
        "repoUrl":            "{{steps.create-repo.outputs.repoUrl}}",
        "entityId":           "{{steps.register.outputs.entityId}}",
        "grafanaDashboardUrl": "http://localhost:{{grafanaPort}}",
        "prometheusUrl":      "http://localhost:{{prometheusPort}}",
        "grafanaAdminUser":   "admin",
        "helmInstallCommand": "bash helm/install.sh"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

-- Template: create-helm-chart (Story 12-6)
-- -------------------------
INSERT INTO templates (id, name, version, schema, created_at)
VALUES (
  gen_random_uuid(),
  'create-helm-chart',
  'v1',
  '{
    "apiVersion": "forgeportal/v1",
    "kind": "Template",
    "metadata": {
      "name": "create-helm-chart",
      "title": "Create Helm Chart for Existing Service",
      "description": "Scaffold a complete, opinionated Helm chart for an existing service — Deployment, Service, Ingress, HPA, PDB, ConfigMap — and push it to the target repository.",
      "tags": ["helm", "kubernetes", "chart", "deployment", "infrastructure"]
    },
    "spec": {
      "parameters": [
        { "id": "serviceName",      "title": "Service name",                "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{1,40}$",                                              "description": "Must match the entity name in the catalog" },
        { "id": "imageRepo",        "title": "Container image repository",  "type": "string",  "required": true,                                                                                       "description": "e.g. ghcr.io/my-org/my-service" },
        { "id": "imageTag",         "title": "Default image tag",           "type": "string",  "required": false, "default": "latest" },
        { "id": "port",             "title": "Service HTTP port",           "type": "number",  "required": false, "default": 8080 },
        { "id": "replicaCount",     "title": "Default replicas",            "type": "number",  "required": false, "default": 2 },
        { "id": "owner",            "title": "Owning team",                 "type": "string",  "required": true,  "ui": "team-picker",                                                               "description": "e.g. team:platform" },
        { "id": "provider",         "title": "SCM provider",                "type": "string",  "required": true,  "enum": ["github", "gitlab"],                                                      "description": "Where to push generated files" },
        { "id": "ownerGroup",       "title": "Org / Group",                 "type": "string",  "required": true,                                                                                      "description": "GitHub org or GitLab group" },
        { "id": "targetRepo",       "title": "Target repository",           "type": "string",  "required": true,                                                                                      "description": "Repo where the chart will be added (repo name only)" },
        { "id": "chartPath",        "title": "Chart path in repo",          "type": "string",  "required": false, "default": "deploy/helm",                                                          "description": "Directory where Chart.yaml will be created" },
        { "id": "enableHPA",        "title": "Enable HorizontalPodAutoscaler", "type": "boolean", "required": false, "default": true,                                                               "description": "Auto-scale based on CPU (50%) and memory (80%)" },
        { "id": "enableIngress",    "title": "Enable Ingress",              "type": "boolean", "required": false, "default": true },
        { "id": "ingressHost",      "title": "Ingress hostname",            "type": "string",  "required": false, "default": "{{serviceName}}.example.com", "dependsOn": { "enableIngress": true }, "description": "e.g. myservice.example.com" },
        { "id": "enablePDB",        "title": "Enable PodDisruptionBudget",  "type": "boolean", "required": false, "default": true,                                                                   "description": "Ensures minAvailable=1 during cluster maintenance" },
        { "id": "configMapEnabled", "title": "Add ConfigMap for env vars",  "type": "boolean", "required": false, "default": true }
      ],
      "steps": [
        {
          "id": "push-skeleton",
          "action": "scm.pushSkeleton@v1",
          "input": {
            "provider": "{{provider}}",
            "owner": "{{ownerGroup}}",
            "repo": "{{targetRepo}}",
            "branch": "main",
            "message": "feat(helm): add Helm chart for {{serviceName}} — generated by ForgePortal",
            "files": [
              { "path": "{{chartPath}}/Chart.yaml",                    "contentBase64": "YXBpVmVyc2lvbjogdjIKbmFtZToge3tzZXJ2aWNlTmFtZX19CmRlc2NyaXB0aW9uOiBIZWxtIGNoYXJ0IGZvciB7e3NlcnZpY2VOYW1lfX0g4oCUIG1hbmFnZWQgYnkgRm9yZ2VQb3J0YWwKdHlwZTogYXBwbGljYXRpb24KdmVyc2lvbjogMC4xLjAKYXBwVmVyc2lvbjogInt7aW1hZ2VUYWd9fSIKaG9tZTogIiIKa2V5d29yZHM6CiAgLSB7e3NlcnZpY2VOYW1lfX0KICAtIGZvcmdlcG9ydGFsCm1haW50YWluZXJzOgogIC0gbmFtZTogInt7b3duZXJ9fSIK" },
              { "path": "{{chartPath}}/values.yaml",                   "contentBase64": "IyBEZWZhdWx0IHZhbHVlcyBmb3Ige3tzZXJ2aWNlTmFtZX19LgojIE92ZXJyaWRlIHBlci1lbnZpcm9ubWVudCB3aXRoIHZhbHVlcy48ZW52Pi55YW1sCgpyZXBsaWNhQ291bnQ6IHt7cmVwbGljYUNvdW50fX0KCmltYWdlOgogIHJlcG9zaXRvcnk6IHt7aW1hZ2VSZXBvfX0KICB0YWc6ICJ7e2ltYWdlVGFnfX0iCiAgcHVsbFBvbGljeTogSWZOb3RQcmVzZW50CgpuYW1lT3ZlcnJpZGU6ICIiCmZ1bGxuYW1lT3ZlcnJpZGU6ICIiCgpzZXJ2aWNlQWNjb3VudDoKICBjcmVhdGU6IGZhbHNlCiAgbmFtZTogIiIKCnBvZEFubm90YXRpb25zOiB7fQpwb2RTZWN1cml0eUNvbnRleHQ6IHt9CnNlY3VyaXR5Q29udGV4dDoge30KCnNlcnZpY2U6CiAgdHlwZTogQ2x1c3RlcklQCiAgcG9ydDoge3twb3J0fX0KCnt7I2lmIGVuYWJsZUluZ3Jlc3N9fQppbmdyZXNzOgogIGVuYWJsZWQ6IHRydWUKICBjbGFzc05hbWU6IG5naW54CiAgYW5ub3RhdGlvbnM6CiAgICBuZ2lueC5pbmdyZXNzLmt1YmVybmV0ZXMuaW8vcmV3cml0ZS10YXJnZXQ6IC8KICBob3N0czoKICAgIC0gaG9zdDoge3tpbmdyZXNzSG9zdH19CiAgICAgIHBhdGhzOgogICAgICAgIC0gcGF0aDogLwogICAgICAgICAgcGF0aFR5cGU6IFByZWZpeAogIHRsczogW10Ke3svaWZ9fQoKe3sjaWYgZW5hYmxlSFBBfX0KYXV0b3NjYWxpbmc6CiAgZW5hYmxlZDogdHJ1ZQogIG1pblJlcGxpY2FzOiB7e3JlcGxpY2FDb3VudH19CiAgbWF4UmVwbGljYXM6IDEwCiAgdGFyZ2V0Q1BVVXRpbGl6YXRpb25QZXJjZW50YWdlOiA1MAogIHRhcmdldE1lbW9yeVV0aWxpemF0aW9uUGVyY2VudGFnZTogODAKe3svaWZ9fQoKcmVzb3VyY2VzOgogIHJlcXVlc3RzOgogICAgY3B1OiAxMDBtCiAgICBtZW1vcnk6IDEyOE1pCiAgbGltaXRzOgogICAgY3B1OiA1MDBtCiAgICBtZW1vcnk6IDUxMk1pCgpsaXZlbmVzc1Byb2JlOgogIGh0dHBHZXQ6CiAgICBwYXRoOiAvaGVhbHRoCiAgICBwb3J0OiBodHRwCiAgaW5pdGlhbERlbGF5U2Vjb25kczogMTUKICBwZXJpb2RTZWNvbmRzOiAyMAoKcmVhZGluZXNzUHJvYmU6CiAgaHR0cEdldDoKICAgIHBhdGg6IC9yZWFkeQogICAgcG9ydDogaHR0cAogIGluaXRpYWxEZWxheVNlY29uZHM6IDUKICBwZXJpb2RTZWNvbmRzOiAxMAoKbm9kZVNlbGVjdG9yOiB7fQp0b2xlcmF0aW9uczogW10KYWZmaW5pdHk6IHt9Cgp7eyNpZiBjb25maWdNYXBFbmFibGVkfX0KY29uZmlnOgogICMgQWRkIHlvdXIgZW52aXJvbm1lbnQgdmFyaWFibGVzIGhlcmUKICAjIEtFWTogdmFsdWUKe3svaWZ9fQo=" },
              { "path": "{{chartPath}}/values.production.yaml",       "contentBase64": "IyBQcm9kdWN0aW9uIG92ZXJyaWRlcyBmb3Ige3tzZXJ2aWNlTmFtZX19CiMgVXNhZ2U6IGhlbG0gdXBncmFkZSB7e3NlcnZpY2VOYW1lfX0gLi97e2NoYXJ0UGF0aH19IC1mIHZhbHVlcy55YW1sIC1mIHZhbHVlcy5wcm9kdWN0aW9uLnlhbWwgLS1zZXQgaW1hZ2UudGFnPXYxLjIuMwoKcmVwbGljYUNvdW50OiA0CgppbWFnZToKICB0YWc6ICIiICAjIEFsd2F5cyBvdmVycmlkZSBhdCBkZXBsb3kgdGltZTogLS1zZXQgaW1hZ2UudGFnPTxzaGE+CgpyZXNvdXJjZXM6CiAgcmVxdWVzdHM6CiAgICBjcHU6IDI1MG0KICAgIG1lbW9yeTogMjU2TWkKICBsaW1pdHM6CiAgICBjcHU6IDEwMDBtCiAgICBtZW1vcnk6IDFHaQoKe3sjaWYgZW5hYmxlSFBBfX0KYXV0b3NjYWxpbmc6CiAgbWluUmVwbGljYXM6IDIKICBtYXhSZXBsaWNhczogMjAKICB0YXJnZXRDUFVVdGlsaXphdGlvblBlcmNlbnRhZ2U6IDYwCnt7L2lmfX0KCnt7I2lmIGVuYWJsZVBEQn19CnBvZERpc3J1cHRpb25CdWRnZXQ6CiAgbWluQXZhaWxhYmxlOiAyCnt7L2lmfX0K" },
              { "path": "{{chartPath}}/templates/_helpers.tpl",       "contentBase64": "e3svKgpFeHBhbmQgdGhlIG5hbWUgb2YgdGhlIGNoYXJ0LgoqL319Cnt7LSBkZWZpbmUgImNoYXJ0Lm5hbWUiIC19fQp7ey0gZGVmYXVsdCAuQ2hhcnQuTmFtZSAuVmFsdWVzLm5hbWVPdmVycmlkZSB8IHRydW5jIDYzIHwgdHJpbVN1ZmZpeCAiLSIgfX0Ke3stIGVuZCB9fQoKe3svKgpDcmVhdGUgYSBkZWZhdWx0IGZ1bGx5IHF1YWxpZmllZCBhcHAgbmFtZS4KKi99fQp7ey0gZGVmaW5lICJjaGFydC5mdWxsbmFtZSIgLX19Cnt7LSBpZiAuVmFsdWVzLmZ1bGxuYW1lT3ZlcnJpZGUgfX0Ke3stIC5WYWx1ZXMuZnVsbG5hbWVPdmVycmlkZSB8IHRydW5jIDYzIHwgdHJpbVN1ZmZpeCAiLSIgfX0Ke3stIGVsc2UgfX0Ke3stICRuYW1lIDo9IGRlZmF1bHQgLkNoYXJ0Lk5hbWUgLlZhbHVlcy5uYW1lT3ZlcnJpZGUgfX0Ke3stIGlmIGNvbnRhaW5zICRuYW1lIC5SZWxlYXNlLk5hbWUgfX0Ke3stIC5SZWxlYXNlLk5hbWUgfCB0cnVuYyA2MyB8IHRyaW1TdWZmaXggIi0iIH19Cnt7LSBlbHNlIH19Cnt7LSBwcmludGYgIiVzLSVzIiAuUmVsZWFzZS5OYW1lICRuYW1lIHwgdHJ1bmMgNjMgfCB0cmltU3VmZml4ICItIiB9fQp7ey0gZW5kIH19Cnt7LSBlbmQgfX0Ke3stIGVuZCB9fQoKe3svKgpDcmVhdGUgY2hhcnQgbGFiZWwuCiovfX0Ke3stIGRlZmluZSAiY2hhcnQuY2hhcnQiIC19fQp7ey0gcHJpbnRmICIlcy0lcyIgLkNoYXJ0Lk5hbWUgLkNoYXJ0LlZlcnNpb24gfCByZXBsYWNlICIrIiAiXyIgfCB0cnVuYyA2MyB8IHRyaW1TdWZmaXggIi0iIH19Cnt7LSBlbmQgfX0KCnt7LyoKQ29tbW9uIGxhYmVscy4KKi99fQp7ey0gZGVmaW5lICJjaGFydC5sYWJlbHMiIC19fQpoZWxtLnNoL2NoYXJ0OiB7eyBpbmNsdWRlICJjaGFydC5jaGFydCIgLiB9fQp7eyBpbmNsdWRlICJjaGFydC5zZWxlY3RvckxhYmVscyIgLiB9fQp7ey0gaWYgLkNoYXJ0LkFwcFZlcnNpb24gfX0KYXBwLmt1YmVybmV0ZXMuaW8vdmVyc2lvbjoge3sgLkNoYXJ0LkFwcFZlcnNpb24gfCBxdW90ZSB9fQp7ey0gZW5kIH19CmFwcC5rdWJlcm5ldGVzLmlvL21hbmFnZWQtYnk6IHt7IC5SZWxlYXNlLlNlcnZpY2UgfX0KYXBwLmt1YmVybmV0ZXMuaW8vcGFydC1vZjogZm9yZ2Vwb3J0YWwKe3stIGVuZCB9fQoKe3svKgpTZWxlY3RvciBsYWJlbHMuCiovfX0Ke3stIGRlZmluZSAiY2hhcnQuc2VsZWN0b3JMYWJlbHMiIC19fQphcHAua3ViZXJuZXRlcy5pby9uYW1lOiB7eyBpbmNsdWRlICJjaGFydC5uYW1lIiAuIH19CmFwcC5rdWJlcm5ldGVzLmlvL2luc3RhbmNlOiB7eyAuUmVsZWFzZS5OYW1lIH19Cnt7LSBlbmQgfX0K" },
              { "path": "{{chartPath}}/templates/deployment.yaml",    "contentBase64": "YXBpVmVyc2lvbjogYXBwcy92MQpraW5kOiBEZXBsb3ltZW50Cm1ldGFkYXRhOgogIG5hbWU6IHt7IGluY2x1ZGUgImNoYXJ0LmZ1bGxuYW1lIiAuIH19CiAgbGFiZWxzOgogICAge3stIGluY2x1ZGUgImNoYXJ0LmxhYmVscyIgLiB8IG5pbmRlbnQgNCB9fQpzcGVjOgogIHt7LSBpZiBub3QgLlZhbHVlcy5hdXRvc2NhbGluZy5lbmFibGVkIH19CiAgcmVwbGljYXM6IHt7IC5WYWx1ZXMucmVwbGljYUNvdW50IH19CiAge3stIGVuZCB9fQogIHNlbGVjdG9yOgogICAgbWF0Y2hMYWJlbHM6CiAgICAgIHt7LSBpbmNsdWRlICJjaGFydC5zZWxlY3RvckxhYmVscyIgLiB8IG5pbmRlbnQgNiB9fQogIHRlbXBsYXRlOgogICAgbWV0YWRhdGE6CiAgICAgIGFubm90YXRpb25zOgogICAgICAgIHt7LSB3aXRoIC5WYWx1ZXMucG9kQW5ub3RhdGlvbnMgfX0KICAgICAgICB7ey0gdG9ZYW1sIC4gfCBuaW5kZW50IDggfX0KICAgICAgICB7ey0gZW5kIH19CiAgICAgIGxhYmVsczoKICAgICAgICB7ey0gaW5jbHVkZSAiY2hhcnQuc2VsZWN0b3JMYWJlbHMiIC4gfCBuaW5kZW50IDggfX0KICAgIHNwZWM6CiAgICAgIHt7LSB3aXRoIC5WYWx1ZXMuaW1hZ2VQdWxsU2VjcmV0cyB9fQogICAgICBpbWFnZVB1bGxTZWNyZXRzOgogICAgICAgIHt7LSB0b1lhbWwgLiB8IG5pbmRlbnQgOCB9fQogICAgICB7ey0gZW5kIH19CiAgICAgIHNlY3VyaXR5Q29udGV4dDoKICAgICAgICB7ey0gdG9ZYW1sIC5WYWx1ZXMucG9kU2VjdXJpdHlDb250ZXh0IHwgbmluZGVudCA4IH19CiAgICAgIGNvbnRhaW5lcnM6CiAgICAgICAgLSBuYW1lOiB7eyAuQ2hhcnQuTmFtZSB9fQogICAgICAgICAgc2VjdXJpdHlDb250ZXh0OgogICAgICAgICAgICB7ey0gdG9ZYW1sIC5WYWx1ZXMuc2VjdXJpdHlDb250ZXh0IHwgbmluZGVudCAxMiB9fQogICAgICAgICAgaW1hZ2U6ICJ7eyAuVmFsdWVzLmltYWdlLnJlcG9zaXRvcnkgfX06e3sgLlZhbHVlcy5pbWFnZS50YWcgfCBkZWZhdWx0IC5DaGFydC5BcHBWZXJzaW9uIH19IgogICAgICAgICAgaW1hZ2VQdWxsUG9saWN5OiB7eyAuVmFsdWVzLmltYWdlLnB1bGxQb2xpY3kgfX0KICAgICAgICAgIHBvcnRzOgogICAgICAgICAgICAtIG5hbWU6IGh0dHAKICAgICAgICAgICAgICBjb250YWluZXJQb3J0OiB7eyAuVmFsdWVzLnNlcnZpY2UucG9ydCB9fQogICAgICAgICAgICAgIHByb3RvY29sOiBUQ1AKICAgICAgICAgIHt7LSBpZiAuVmFsdWVzLmxpdmVuZXNzUHJvYmUgfX0KICAgICAgICAgIGxpdmVuZXNzUHJvYmU6CiAgICAgICAgICAgIHt7LSB0b1lhbWwgLlZhbHVlcy5saXZlbmVzc1Byb2JlIHwgbmluZGVudCAxMiB9fQogICAgICAgICAge3stIGVuZCB9fQogICAgICAgICAge3stIGlmIC5WYWx1ZXMucmVhZGluZXNzUHJvYmUgfX0KICAgICAgICAgIHJlYWRpbmVzc1Byb2JlOgogICAgICAgICAgICB7ey0gdG9ZYW1sIC5WYWx1ZXMucmVhZGluZXNzUHJvYmUgfCBuaW5kZW50IDEyIH19CiAgICAgICAgICB7ey0gZW5kIH19CiAgICAgICAgICByZXNvdXJjZXM6CiAgICAgICAgICAgIHt7LSB0b1lhbWwgLlZhbHVlcy5yZXNvdXJjZXMgfCBuaW5kZW50IDEyIH19CiAgICAgICAgICB7ey0gaWYgLlZhbHVlcy5jb25maWcgfX0KICAgICAgICAgIGVudkZyb206CiAgICAgICAgICAgIC0gY29uZmlnTWFwUmVmOgogICAgICAgICAgICAgICAgbmFtZToge3sgaW5jbHVkZSAiY2hhcnQuZnVsbG5hbWUiIC4gfX0tY29uZmlnCiAgICAgICAgICB7ey0gZW5kIH19CiAgICAgIHt7LSB3aXRoIC5WYWx1ZXMubm9kZVNlbGVjdG9yIH19CiAgICAgIG5vZGVTZWxlY3RvcjoKICAgICAgICB7ey0gdG9ZYW1sIC4gfCBuaW5kZW50IDggfX0KICAgICAge3stIGVuZCB9fQogICAgICB7ey0gd2l0aCAuVmFsdWVzLmFmZmluaXR5IH19CiAgICAgIGFmZmluaXR5OgogICAgICAgIHt7LSB0b1lhbWwgLiB8IG5pbmRlbnQgOCB9fQogICAgICB7ey0gZW5kIH19CiAgICAgIHt7LSB3aXRoIC5WYWx1ZXMudG9sZXJhdGlvbnMgfX0KICAgICAgdG9sZXJhdGlvbnM6CiAgICAgICAge3stIHRvWWFtbCAuIHwgbmluZGVudCA4IH19CiAgICAgIHt7LSBlbmQgfX0K" },
              { "path": "{{chartPath}}/templates/service.yaml",       "contentBase64": "YXBpVmVyc2lvbjogdjEKa2luZDogU2VydmljZQptZXRhZGF0YToKICBuYW1lOiB7eyBpbmNsdWRlICJjaGFydC5mdWxsbmFtZSIgLiB9fQogIGxhYmVsczoKICAgIHt7LSBpbmNsdWRlICJjaGFydC5sYWJlbHMiIC4gfCBuaW5kZW50IDQgfX0Kc3BlYzoKICB0eXBlOiB7eyAuVmFsdWVzLnNlcnZpY2UudHlwZSB9fQogIHBvcnRzOgogICAgLSBwb3J0OiB7eyAuVmFsdWVzLnNlcnZpY2UucG9ydCB9fQogICAgICB0YXJnZXRQb3J0OiBodHRwCiAgICAgIHByb3RvY29sOiBUQ1AKICAgICAgbmFtZTogaHR0cAogIHNlbGVjdG9yOgogICAge3stIGluY2x1ZGUgImNoYXJ0LnNlbGVjdG9yTGFiZWxzIiAuIHwgbmluZGVudCA0IH19Cg==" },
              { "path": "{{chartPath}}/templates/ingress.yaml",       "contentBase64": "e3stIGlmIC5WYWx1ZXMuaW5ncmVzcy5lbmFibGVkIC19fQphcGlWZXJzaW9uOiBuZXR3b3JraW5nLms4cy5pby92MQpraW5kOiBJbmdyZXNzCm1ldGFkYXRhOgogIG5hbWU6IHt7IGluY2x1ZGUgImNoYXJ0LmZ1bGxuYW1lIiAuIH19CiAgbGFiZWxzOgogICAge3stIGluY2x1ZGUgImNoYXJ0LmxhYmVscyIgLiB8IG5pbmRlbnQgNCB9fQogIHt7LSB3aXRoIC5WYWx1ZXMuaW5ncmVzcy5hbm5vdGF0aW9ucyB9fQogIGFubm90YXRpb25zOgogICAge3stIHRvWWFtbCAuIHwgbmluZGVudCA0IH19CiAge3stIGVuZCB9fQpzcGVjOgogIHt7LSBpZiAuVmFsdWVzLmluZ3Jlc3MuY2xhc3NOYW1lIH19CiAgaW5ncmVzc0NsYXNzTmFtZToge3sgLlZhbHVlcy5pbmdyZXNzLmNsYXNzTmFtZSB9fQogIHt7LSBlbmQgfX0KICB7ey0gaWYgLlZhbHVlcy5pbmdyZXNzLnRscyB9fQogIHRsczoKICAgIHt7LSByYW5nZSAuVmFsdWVzLmluZ3Jlc3MudGxzIH19CiAgICAtIGhvc3RzOgogICAgICAgIHt7LSByYW5nZSAuaG9zdHMgfX0KICAgICAgICAtIHt7IC4gfCBxdW90ZSB9fQogICAgICAgIHt7LSBlbmQgfX0KICAgICAgc2VjcmV0TmFtZToge3sgLnNlY3JldE5hbWUgfX0KICAgIHt7LSBlbmQgfX0KICB7ey0gZW5kIH19CiAgcnVsZXM6CiAgICB7ey0gcmFuZ2UgLlZhbHVlcy5pbmdyZXNzLmhvc3RzIH19CiAgICAtIGhvc3Q6IHt7IC5ob3N0IHwgcXVvdGUgfX0KICAgICAgaHR0cDoKICAgICAgICBwYXRoczoKICAgICAgICAgIHt7LSByYW5nZSAucGF0aHMgfX0KICAgICAgICAgIC0gcGF0aDoge3sgLnBhdGggfX0KICAgICAgICAgICAgcGF0aFR5cGU6IHt7IC5wYXRoVHlwZSB9fQogICAgICAgICAgICBiYWNrZW5kOgogICAgICAgICAgICAgIHNlcnZpY2U6CiAgICAgICAgICAgICAgICBuYW1lOiB7eyBpbmNsdWRlICJjaGFydC5mdWxsbmFtZSIgJCB9fQogICAgICAgICAgICAgICAgcG9ydDoKICAgICAgICAgICAgICAgICAgbnVtYmVyOiB7eyAkLlZhbHVlcy5zZXJ2aWNlLnBvcnQgfX0KICAgICAgICAgIHt7LSBlbmQgfX0KICAgIHt7LSBlbmQgfX0Ke3stIGVuZCB9fQo=" },
              { "path": "{{chartPath}}/templates/hpa.yaml",           "contentBase64": "e3stIGlmIC5WYWx1ZXMuYXV0b3NjYWxpbmcuZW5hYmxlZCB9fQphcGlWZXJzaW9uOiBhdXRvc2NhbGluZy92MgpraW5kOiBIb3Jpem9udGFsUG9kQXV0b3NjYWxlcgptZXRhZGF0YToKICBuYW1lOiB7eyBpbmNsdWRlICJjaGFydC5mdWxsbmFtZSIgLiB9fQogIGxhYmVsczoKICAgIHt7LSBpbmNsdWRlICJjaGFydC5sYWJlbHMiIC4gfCBuaW5kZW50IDQgfX0Kc3BlYzoKICBzY2FsZVRhcmdldFJlZjoKICAgIGFwaVZlcnNpb246IGFwcHMvdjEKICAgIGtpbmQ6IERlcGxveW1lbnQKICAgIG5hbWU6IHt7IGluY2x1ZGUgImNoYXJ0LmZ1bGxuYW1lIiAuIH19CiAgbWluUmVwbGljYXM6IHt7IC5WYWx1ZXMuYXV0b3NjYWxpbmcubWluUmVwbGljYXMgfX0KICBtYXhSZXBsaWNhczoge3sgLlZhbHVlcy5hdXRvc2NhbGluZy5tYXhSZXBsaWNhcyB9fQogIG1ldHJpY3M6CiAgICB7ey0gaWYgLlZhbHVlcy5hdXRvc2NhbGluZy50YXJnZXRDUFVVdGlsaXphdGlvblBlcmNlbnRhZ2UgfX0KICAgIC0gdHlwZTogUmVzb3VyY2UKICAgICAgcmVzb3VyY2U6CiAgICAgICAgbmFtZTogY3B1CiAgICAgICAgdGFyZ2V0OgogICAgICAgICAgdHlwZTogVXRpbGl6YXRpb24KICAgICAgICAgIGF2ZXJhZ2VVdGlsaXphdGlvbjoge3sgLlZhbHVlcy5hdXRvc2NhbGluZy50YXJnZXRDUFVVdGlsaXphdGlvblBlcmNlbnRhZ2UgfX0KICAgIHt7LSBlbmQgfX0KICAgIHt7LSBpZiAuVmFsdWVzLmF1dG9zY2FsaW5nLnRhcmdldE1lbW9yeVV0aWxpemF0aW9uUGVyY2VudGFnZSB9fQogICAgLSB0eXBlOiBSZXNvdXJjZQogICAgICByZXNvdXJjZToKICAgICAgICBuYW1lOiBtZW1vcnkKICAgICAgICB0YXJnZXQ6CiAgICAgICAgICB0eXBlOiBVdGlsaXphdGlvbgogICAgICAgICAgYXZlcmFnZVV0aWxpemF0aW9uOiB7eyAuVmFsdWVzLmF1dG9zY2FsaW5nLnRhcmdldE1lbW9yeVV0aWxpemF0aW9uUGVyY2VudGFnZSB9fQogICAge3stIGVuZCB9fQp7ey0gZW5kIH19Cg==" },
              { "path": "{{chartPath}}/templates/pdb.yaml",           "contentBase64": "e3stIGlmIC5WYWx1ZXMucG9kRGlzcnVwdGlvbkJ1ZGdldCB9fQphcGlWZXJzaW9uOiBwb2xpY3kvdjEKa2luZDogUG9kRGlzcnVwdGlvbkJ1ZGdldAptZXRhZGF0YToKICBuYW1lOiB7eyBpbmNsdWRlICJjaGFydC5mdWxsbmFtZSIgLiB9fQogIGxhYmVsczoKICAgIHt7LSBpbmNsdWRlICJjaGFydC5sYWJlbHMiIC4gfCBuaW5kZW50IDQgfX0Kc3BlYzoKICBtaW5BdmFpbGFibGU6IHt7IC5WYWx1ZXMucG9kRGlzcnVwdGlvbkJ1ZGdldC5taW5BdmFpbGFibGUgfCBkZWZhdWx0IDEgfX0KICBzZWxlY3RvcjoKICAgIG1hdGNoTGFiZWxzOgogICAgICB7ey0gaW5jbHVkZSAiY2hhcnQuc2VsZWN0b3JMYWJlbHMiIC4gfCBuaW5kZW50IDYgfX0Ke3stIGVuZCB9fQo=" },
              { "path": "{{chartPath}}/templates/configmap.yaml",     "contentBase64": "e3stIGlmIC5WYWx1ZXMuY29uZmlnIH19CmFwaVZlcnNpb246IHYxCmtpbmQ6IENvbmZpZ01hcAptZXRhZGF0YToKICBuYW1lOiB7eyBpbmNsdWRlICJjaGFydC5mdWxsbmFtZSIgLiB9fS1jb25maWcKICBsYWJlbHM6CiAgICB7ey0gaW5jbHVkZSAiY2hhcnQubGFiZWxzIiAuIHwgbmluZGVudCA0IH19CmRhdGE6CiAge3stIHJhbmdlICRrZXksICR2YWx1ZSA6PSAuVmFsdWVzLmNvbmZpZyB9fQogIHt7ICRrZXkgfX06IHt7ICR2YWx1ZSB8IHF1b3RlIH19CiAge3stIGVuZCB9fQp7ey0gZW5kIH19Cg==" },
              { "path": "{{chartPath}}/README.md",                    "contentBase64": "IyB7e3NlcnZpY2VOYW1lfX0g4oCUIEhlbG0gQ2hhcnQKCj4gR2VuZXJhdGVkIGJ5IEZvcmdlUG9ydGFsIHRlbXBsYXRlIGBjcmVhdGUtaGVsbS1jaGFydGAgIAo+IE93bmVyOiAqKnt7b3duZXJ9fSoqICAKPiBJbWFnZTogYHt7aW1hZ2VSZXBvfX06e3tpbWFnZVRhZ319YAoKIyMgUXVpY2sgU3RhcnQKCmBgYGJhc2gKIyBEcnktcnVuIChkaWZmKQpoZWxtIGRpZmYgdXBncmFkZSB7e3NlcnZpY2VOYW1lfX0gLi97e2NoYXJ0UGF0aH19IC1mIHZhbHVlcy55YW1sCgojIERlcGxveSB0byBzdGFnaW5nCmhlbG0gdXBncmFkZSAtLWluc3RhbGwge3tzZXJ2aWNlTmFtZX19IC4ve3tjaGFydFBhdGh9fSBcCiAgLS1uYW1lc3BhY2Uge3tzZXJ2aWNlTmFtZX19IFwKICAtLWNyZWF0ZS1uYW1lc3BhY2UgXAogIC1mIHZhbHVlcy55YW1sCgojIERlcGxveSB0byBwcm9kdWN0aW9uCmhlbG0gdXBncmFkZSAtLWluc3RhbGwge3tzZXJ2aWNlTmFtZX19IC4ve3tjaGFydFBhdGh9fSBcCiAgLS1uYW1lc3BhY2Uge3tzZXJ2aWNlTmFtZX19LXByb2QgXAogIC0tY3JlYXRlLW5hbWVzcGFjZSBcCiAgLWYgdmFsdWVzLnlhbWwgLWYgdmFsdWVzLnByb2R1Y3Rpb24ueWFtbCBcCiAgLS1zZXQgaW1hZ2UudGFnPTxTSEE+CmBgYAoKIyMgQ2hhcnQgU3RydWN0dXJlCgpgYGAKe3tjaGFydFBhdGh9fS8KICBDaGFydC55YW1sICAgICAgICAgICAgICDihpAgY2hhcnQgbWV0YWRhdGEKICB2YWx1ZXMueWFtbCAgICAgICAgICAgICDihpAgZGVmYXVsdCB2YWx1ZXMKICB2YWx1ZXMucHJvZHVjdGlvbi55YW1sICDihpAgcHJvZHVjdGlvbiBvdmVycmlkZXMKICB0ZW1wbGF0ZXMvCiAgICBkZXBsb3ltZW50LnlhbWwgICAgICAgIOKGkCBtYWluIHdvcmtsb2FkCiAgICBzZXJ2aWNlLnlhbWwgICAgICAgICAgIOKGkCBDbHVzdGVySVAgc2VydmljZQogICAgaW5ncmVzcy55YW1sICAgICAgICAgICDihpAgbmdpbnggaW5ncmVzcyAoaWYgZW5hYmxlZCkKICAgIGhwYS55YW1sICAgICAgICAgICAgICDihpAgSG9yaXpvbnRhbFBvZEF1dG9zY2FsZXIgKGlmIGVuYWJsZWQpCiAgICBwZGIueWFtbCAgICAgICAgICAgICAgIOKGkCBQb2REaXNydXB0aW9uQnVkZ2V0IChpZiBlbmFibGVkKQogICAgY29uZmlnbWFwLnlhbWwgICAgICAgICDihpAgZW52aXJvbm1lbnQgdmFyaWFibGVzIChpZiBlbmFibGVkKQogICAgX2hlbHBlcnMudHBsICAgICAgICAgICDihpAgc2hhcmVkIHRlbXBsYXRlIGhlbHBlcnMKYGBgCgojIyBLZXkgVmFsdWVzCgp8IEtleSB8IERlZmF1bHQgfCBEZXNjcmlwdGlvbiB8CnwtLS0tLXwtLS0tLS0tLS18LS0tLS0tLS0tLS0tLXwKfCBgaW1hZ2UucmVwb3NpdG9yeWAgfCBge3tpbWFnZVJlcG99fWAgfCBDb250YWluZXIgaW1hZ2UgfAp8IGBpbWFnZS50YWdgIHwgYHt7aW1hZ2VUYWd9fWAgfCBJbWFnZSB0YWcg4oCUIG92ZXJyaWRlIHBlciBkZXBsb3kgfAp8IGByZXBsaWNhQ291bnRgIHwgYHt7cmVwbGljYUNvdW50fX1gIHwgTnVtYmVyIG9mIHJlcGxpY2FzIHwKfCBgc2VydmljZS5wb3J0YCB8IGB7e3BvcnR9fWAgfCBIVFRQIHBvcnQgfAp8IGBhdXRvc2NhbGluZy5lbmFibGVkYCB8IGB0cnVlYCB8IEhQQSBlbmFibGVkIHwKfCBgaW5ncmVzcy5lbmFibGVkYCB8IGB0cnVlYCB8IEluZ3Jlc3MgZW5hYmxlZCB8CgojIyBMaW50aW5nCgpgYGBiYXNoCmhlbG0gbGludCAuL3t7Y2hhcnRQYXRofX0KaGVsbSB0ZW1wbGF0ZSB7e3NlcnZpY2VOYW1lfX0gLi97e2NoYXJ0UGF0aH19IC1mIHZhbHVlcy55YW1sIHwga3ViZWN0bCBhcHBseSAtLWRyeS1ydW49Y2xpZW50IC1mIC0KYGBgCg==" }
            ]
          }
        },
        {
          "id": "register",
          "action": "catalog.registerEntity@v1",
          "input": {
            "entity": {
              "kind": "resource",
              "name": "{{serviceName}}-helm",
              "ownerRef": "{{owner}}",
              "lifecycle": "production",
              "tags": ["helm", "kubernetes", "chart", "{{serviceName}}"],
              "annotations": {
                "forgeportal.dev/helm-chart-path": "{{chartPath}}",
                "forgeportal.dev/managed-by": "forgeportal-template"
              },
              "scm": { "provider": "{{provider}}", "owner": "{{ownerGroup}}", "repo": "{{targetRepo}}", "defaultBranch": "main" },
              "spec": { "type": "helm-chart", "description": "Helm chart for {{serviceName}} — {{imageRepo}}:{{imageTag}}" }
            },
            "source": { "provider": "{{provider}}", "repoUrl": "https://github.com/{{ownerGroup}}/{{targetRepo}}", "path": "{{chartPath}}" }
          }
        }
      ],
      "outputs": {
        "chartPath":       "{{chartPath}}",
        "entityId":        "{{steps.register.outputs.entityId}}",
        "helmInstall":     "helm upgrade --install {{serviceName}} ./{{chartPath}} --namespace {{serviceName}} --create-namespace -f {{chartPath}}/values.yaml",
        "helmLint":        "helm lint ./{{chartPath}}"
      }
    }
  }'::jsonb,
  now()
)
ON CONFLICT (name, version) DO UPDATE SET schema = EXCLUDED.schema;

COMMIT;
