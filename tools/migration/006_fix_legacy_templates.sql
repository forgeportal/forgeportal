-- 006_fix_legacy_templates.sql
-- Migrate spring-boot-service and go-service from the old flat format
-- to the forgeportal/v1 format expected by TemplateOrchestrator.
BEGIN;

-- ── spring-boot-service ─────────────────────────────────────────────────────
UPDATE templates
SET schema = '{
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
      { "id": "name",        "title": "Service Name",  "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$", "description": "Lowercase name used for repo and entity" },
      { "id": "owner",       "title": "Owning Team",   "type": "string",  "required": true,  "description": "e.g. team:payments" },
      { "id": "provider",    "title": "SCM Provider",  "type": "string",  "required": true,  "enum": ["github", "gitlab"] },
      { "id": "ownerGroup",  "title": "Org / Group",   "type": "string",  "required": true,  "description": "GitHub org or GitLab group" },
      { "id": "description", "title": "Description",   "type": "string",  "required": false, "default": "" }
    ],
    "steps": [
      {
        "id": "create-repo",
        "action": "scm.createRepo@v1",
        "input": {
          "provider": "{{provider}}",
          "owner": "{{ownerGroup}}",
          "repo": "{{name}}",
          "visibility": "private",
          "description": "{{description}}"
        }
      },
      {
        "id": "push-skeleton",
        "action": "scm.pushSkeleton@v1",
        "input": {
          "provider": "{{provider}}",
          "owner": "{{ownerGroup}}",
          "repo": "{{name}}",
          "branch": "main",
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
          "provider": "{{provider}}",
          "owner": "{{ownerGroup}}",
          "repo": "{{name}}",
          "type": "{{#if (eq provider \"github\")}}github-actions{{else}}gitlab-ci{{/if}}",
          "language": "java"
        }
      },
      {
        "id": "register",
        "action": "catalog.registerEntity@v1",
        "input": {
          "entity": {
            "kind": "service",
            "name": "{{name}}",
            "ownerRef": "{{owner}}",
            "lifecycle": "experimental",
            "tags": ["java", "spring-boot"],
            "scm": {
              "provider": "{{provider}}",
              "owner": "{{ownerGroup}}",
              "repo": "{{name}}",
              "defaultBranch": "main"
            }
          },
          "source": {
            "provider": "{{provider}}",
            "repoUrl": "{{steps.create-repo.outputs.repoUrl}}",
            "path": "/"
          }
        }
      }
    ],
    "outputs": {
      "repoUrl":  "{{steps.create-repo.outputs.repoUrl}}",
      "entityId": "{{steps.register.outputs.entityId}}"
    }
  }
}'::jsonb
WHERE name = 'spring-boot-service' AND version = 'v1';

-- ── go-service ───────────────────────────────────────────────────────────────
UPDATE templates
SET schema = '{
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
      { "id": "name",        "title": "Service Name",  "type": "string",  "required": true,  "pattern": "^[a-z][a-z0-9-]{2,30}$", "description": "Lowercase name used for repo and entity" },
      { "id": "owner",       "title": "Owning Team",   "type": "string",  "required": true,  "description": "e.g. team:platform" },
      { "id": "provider",    "title": "SCM Provider",  "type": "string",  "required": true,  "enum": ["github", "gitlab"] },
      { "id": "ownerGroup",  "title": "Org / Group",   "type": "string",  "required": true,  "description": "GitHub org or GitLab group" },
      { "id": "description", "title": "Description",   "type": "string",  "required": false, "default": "" }
    ],
    "steps": [
      {
        "id": "create-repo",
        "action": "scm.createRepo@v1",
        "input": {
          "provider": "{{provider}}",
          "owner": "{{ownerGroup}}",
          "repo": "{{name}}",
          "visibility": "private",
          "description": "{{description}}"
        }
      },
      {
        "id": "push-skeleton",
        "action": "scm.pushSkeleton@v1",
        "input": {
          "provider": "{{provider}}",
          "owner": "{{ownerGroup}}",
          "repo": "{{name}}",
          "branch": "main",
          "message": "feat: bootstrap {{name}}",
          "files": [
            { "path": "README.md",               "contentBase64": "IyB7e25hbWV9fQoKPiB7e2Rlc2NyaXB0aW9ufX0KCiMjIEdldHRpbmcgU3RhcnRlZAoKYGBgYmFzaApnbyBydW4gLi9jbWQve3tuYW1lfX0KYGBgCg==" },
            { "path": "cmd/{{name}}/main.go",    "contentBase64": "cGFja2FnZSBtYWluCgppbXBvcnQgImZtdCIKCmZ1bmMgbWFpbigpIHsKCWZtdC5QcmludGxuKCJIZWxsbyBmcm9tIHt7bmFtZX19IikKfQo=" },
            { "path": "docs/index.md",           "contentBase64": "IyB7e25hbWV9fSBEb2N1bWVudGF0aW9uCgojIyBPdmVydmlldwoKe3tkZXNjcmlwdGlvbn19Cg==" },
            { "path": "entity.yaml",             "contentBase64": "YXBpVmVyc2lvbjogZm9yZ2Vwb3J0YWwvdjEKa2luZDogc2VydmljZQptZXRhZGF0YToKICBuYW1lOiB7e25hbWV9fQogIG5hbWVzcGFjZTogZGVmYXVsdApzcGVjOgogIG93bmVyOiB7e293bmVyfX0KICBsaWZlY3ljbGU6IGV4cGVyaW1lbnRhbAo=" }
          ]
        }
      },
      {
        "id": "bootstrap-ci",
        "action": "ci.bootstrap@v1",
        "input": {
          "provider": "{{provider}}",
          "owner": "{{ownerGroup}}",
          "repo": "{{name}}",
          "type": "{{#if (eq provider \"github\")}}github-actions{{else}}gitlab-ci{{/if}}",
          "language": "go"
        }
      },
      {
        "id": "register",
        "action": "catalog.registerEntity@v1",
        "input": {
          "entity": {
            "kind": "service",
            "name": "{{name}}",
            "ownerRef": "{{owner}}",
            "lifecycle": "experimental",
            "tags": ["go"],
            "scm": {
              "provider": "{{provider}}",
              "owner": "{{ownerGroup}}",
              "repo": "{{name}}",
              "defaultBranch": "main"
            }
          },
          "source": {
            "provider": "{{provider}}",
            "repoUrl": "{{steps.create-repo.outputs.repoUrl}}",
            "path": "/"
          }
        }
      }
    ],
    "outputs": {
      "repoUrl":  "{{steps.create-repo.outputs.repoUrl}}",
      "entityId": "{{steps.register.outputs.entityId}}"
    }
  }
}'::jsonb
WHERE name = 'go-service' AND version = 'v1';

COMMIT;
