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

COMMIT;
