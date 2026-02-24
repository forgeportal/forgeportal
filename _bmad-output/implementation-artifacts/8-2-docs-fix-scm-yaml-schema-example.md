# Story 8-2: Fix SCM YAML Schema in Docs & forgeportal.example.yaml

**Epic:** 8 — Dogfooding & Adoption Validation  
**Status:** ready-for-dev  
**Priority:** P1  
**Estimate:** 2 points  
**Origin:** Dogfooding report finding [DOCS-001], [DOCS-003], [DOCS-005]

---

## User Story

As **Alex**, a new ForgePortal user, I want the YAML config examples in the docs to match the **actual schema** validated by the API, so I don't waste time debugging Zod validation errors when following the getting-started guide.

---

## Acceptance Criteria

- [ ] `forgeportal.example.yaml` — SCM/discovery section uses the canonical schema:
  ```yaml
  scm:
    github:
      token: ghp_xxxx          # or use appId / privateKeyPath
      webhookSecret: ""         # optional
    gitlab:
      token: ""
      baseUrl: https://gitlab.com

  discovery:
    orgs:
      - provider: github
        org: my-github-org      # replace with your org
    entityFilePath: entity.yaml
    intervalMinutes: 0
  ```
- [ ] `forgeportal.example.yaml` — add a commented `pluginPackages` section:
  ```yaml
  pluginPackages:
    packages: []
      # - "@myorg/forge-plugin-example"
  ```
- [ ] `apps/docs/docs/configuration/forgeportal-yaml.md` — SCM section references the same schema.
- [ ] `apps/docs/docs/configuration/scm-providers.md` — add an "env var → yaml key" mapping table for GitHub PAT, GitHub App, and GitLab token modes.
- [ ] `apps/docs/docs/plugin-development/overview.md` and `create-ui-plugin.md` — confirm `pluginPackages` registration example is consistent with the YAML schema.

---

## Notes

- Do **not** change the actual Zod schema — only update documentation and examples to match.
- The story guide in `8-1-e2e-dogfooding-simulation.md` (section "forgeportal.yaml starting point") also uses the wrong schema; update it as part of this story.
