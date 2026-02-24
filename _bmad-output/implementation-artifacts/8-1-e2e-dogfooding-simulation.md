# Story 8-1: End-to-End Dogfooding Simulation

**Epic:** 8 — Dogfooding & Adoption Validation  
**Status:** ready-for-dev  
**Priority:** High  
**Estimate:** 8 points

---

## User Story

As **Alex**, a platform engineer at **AcmeCorp** who has never seen ForgePortal before, I want to:

1. Discover ForgePortal on GitHub.
2. Follow the README and docs site to get a working IDP running on my laptop.
3. Configure it against my real GitHub organisation.
4. Create a new service using a template.
5. Install an existing plugin and create my own using the CLI.
6. See scorecards evaluated for my team's repositories.
7. Walk away with a fully working portal — and file a report on every friction point I hit.

> **Rule:** Alex has no access to the internal source code, Slack, or prior context. He follows only what is publicly available: the `README.md`, the `docs/` site, and the `forgeportal.example.yaml`.

---

## Persona

| Field | Value |
|-------|-------|
| Name | Alex Chen |
| Role | Platform Engineer |
| Company | AcmeCorp (fictional) |
| SCM | GitHub (github.com/acmecorp-demo org — use a real personal org or a throwaway org) |
| Machine | macOS or Linux laptop, Node 20, Docker Desktop, pnpm installed |
| OIDC provider | Keycloak (included in the dev Docker Compose) |

---

## Acceptance Criteria

### AC-1: Cold Clone & First Start
- [ ] Alex clones ForgePortal into a **new, empty folder** (`~/projects/acmecorp-portal`) — not inside the monorepo.
  ```bash
  git clone https://github.com/bendaamerahmed/ForgePortal ~/projects/acmecorp-portal
  cd ~/projects/acmecorp-portal
  ```
- [ ] He follows only the `README.md` "Quick Start" section.
- [ ] `docker compose -f deployments/docker-compose/docker-compose.yml up` starts without errors.
- [ ] The UI is reachable at `http://localhost:3000` within 90 seconds of first `up`.

### AC-2: Environment & Configuration
- [ ] Alex copies `.env.example` → `.env` and fills in only the values described in the docs.
- [ ] He creates a `forgeportal.yaml` from `forgeportal.example.yaml`, following the [Configuration Reference](../apps/docs/docs/configuration/forgeportal-yaml.md).
- [ ] He configures:
  - A PostgreSQL connection (default Docker Compose values).
  - OIDC using Keycloak (following [OIDC Setup guide](../apps/docs/docs/configuration/oidc-setup.md)).
  - At least one SCM provider — GitHub PAT for `github.com/acmecorp-demo` (following [SCM Providers guide](../apps/docs/docs/configuration/scm-providers.md)).
- [ ] The API `/healthz` returns `200 OK`.
- [ ] Alex can log in via the OIDC login button in the UI.

### AC-3: Catalog Discovery
- [ ] Alex triggers a repository discovery scan from the Admin UI (or via API).
- [ ] At least **5 repositories** from `github.com/acmecorp-demo` appear in the Catalog within 2 minutes.
- [ ] Each entity shows: name, type, owner, SCM link, last updated.
- [ ] Alex can search for an entity by name using the search bar.
- [ ] Alex can filter the catalog by `type` and `owner`.

### AC-4: Template Run (Scaffold a New Service)
- [ ] Alex navigates to the Templates page and selects a built-in template (e.g., "New Node.js Service").
- [ ] He fills in the template form: service name, owner team, description.
- [ ] He submits the form.
- [ ] An action run appears in the action log with status `running` → `succeeded`.
- [ ] A new branch / PR is opened in the target GitHub repository.
- [ ] The new entity appears in the Catalog after the next scan (or webhook trigger).

### AC-5: Plugin Installation (Existing Plugin from npm)
- [ ] Alex follows the [Plugin Developer Guide](../apps/docs/docs/plugin-development/overview.md) to install `@forgeportal/plugin-sdk`.
- [ ] He adds a plugin package to `forgeportal.yaml`:
  ```yaml
  pluginPackages:
    packages:
      - "@acmecorp/my-first-plugin"
  ```
- [ ] After restarting the portal, the Admin UI → Plugins page shows the plugin as **enabled**.
- [ ] The plugin's registered capability (e.g., an entity tab or a backend route) is visible in the UI or callable via the API.

### AC-6: Plugin Creation with CLI
- [ ] Alex runs the `create-forge-plugin` CLI from scratch in a **separate folder**:
  ```bash
  pnpm create forge-plugin
  # → interactive prompts: name, type (fullstack), description
  ```
- [ ] The CLI scaffolds a plugin package with:
  - `forgeportal-plugin.json` manifest.
  - A backend entry point with one custom action (`acmecorp.notify@v1`).
  - A UI component (Entity Tab).
- [ ] Alex follows the plugin dev guide to register and run it locally.
- [ ] The custom action appears in the template action picker.
- [ ] The Entity Tab renders on the entity detail page.

### AC-7: Scorecards
- [ ] At least one scorecard rule is configured (e.g., "has README", "has CODEOWNERS", "CI passing").
- [ ] Alex triggers scorecard evaluation from the Admin UI.
- [ ] Scorecard results appear on the Entity page with Bronze / Silver / Gold level and individual rule pass/fail.
- [ ] A "Fix" button is visible for at least one failing rule that has a fix action.
- [ ] Alex clicks "Fix", and a PR is opened in the target repo.

### AC-8: Docs Experience
- [ ] Alex reads the docs site at `http://localhost:3001` (or deployed URL).
- [ ] He validates that the following pages exist and are accurate against the running instance:
  - Quick Start
  - OIDC Setup
  - SCM Providers
  - Plugin Developer Guide (create backend, UI, fullstack)
  - Configuration Reference (`forgeportal.yaml`)
  - API Reference (at least catalog + templates endpoints)
- [ ] He notes every page where the doc is incorrect, incomplete, or confusing.

### AC-9: Validation Report
- [ ] Alex produces `_bmad-output/validation/dogfooding-report.md` (see template below).
- [ ] The report categorises findings by severity (P0 / P1 / P2) and area (Docs, UX, Bug, Performance, DX).
- [ ] Every P0 and P1 finding has a corresponding follow-up story filed in `_bmad-output/implementation-artifacts/`.

---

## Dogfooding Report Template

```markdown
# ForgePortal Dogfooding Report

**Date:** YYYY-MM-DD  
**Tester:** Alex Chen (simulated)  
**Version tested:** v1.0.0  
**Environment:** macOS / Docker Desktop / Node 20  

---

## Summary

| Area | P0 | P1 | P2 | Total |
|------|----|----|----|-------|
| Docs | | | | |
| UX | | | | |
| Bug | | | | |
| Performance | | | | |
| DX (Developer Experience) | | | | |

---

## Findings

### [AREA-001] <Title>
- **Severity:** P0 / P1 / P2
- **Area:** Docs / UX / Bug / Performance / DX
- **Step where found:** AC-X, step Y
- **Expected:** ...
- **Actual:** ...
- **Suggested fix:** ...
- **Follow-up story:** (link or ID)

---

## What Worked Well

(Bullet list of positive observations)

---

## Time-to-Value Metrics

| Milestone | Target | Actual | Delta |
|-----------|--------|--------|-------|
| First `docker compose up` success | < 5 min | | |
| UI reachable | < 90 sec after up | | |
| First login | < 2 min | | |
| First entity in catalog | < 5 min after scan | | |
| First template run | < 10 min | | |
| First plugin created with CLI | < 15 min | | |
| First scorecard evaluated | < 5 min | | |

---

## Recommendations

(Top 3-5 things to fix before public launch)
```

---

## Scenario Setup Guide (for the person running this story)

### 1. Prepare a throwaway GitHub organisation

Create a free GitHub org (e.g., `forgeportal-demo-acmecorp`) and push 5-10 sample repos into it:

```bash
# scaffold sample repos
for name in auth-service payments-api frontend-app data-pipeline infra-terraform; do
  gh repo create forgeportal-demo-acmecorp/$name --public --add-readme
done
```

### 2. Clone into a clean folder

```bash
git clone https://github.com/bendaamerahmed/ForgePortal ~/projects/dogfood-test
cd ~/projects/dogfood-test
```

> Do NOT use the development monorepo. The isolation is the point.

### 3. Generate a GitHub PAT

Create a classic PAT with scopes: `repo`, `read:org`, `read:user` for `forgeportal-demo-acmecorp`.

### 4. Set Keycloak as OIDC provider

The default `docker-compose.yml` includes Keycloak. Follow the [OIDC Setup guide](../apps/docs/docs/configuration/oidc-setup.md) to:
- Create realm `forgeportal`
- Create client `forgeportal` (Confidential, redirect URI `http://localhost:3000/auth/callback`)
- Create test user `alex@acmecorp.com` with password `demo1234`

### 5. forgeportal.yaml (starting point)

```yaml
# ~/projects/dogfood-test/forgeportal.yaml
db:
  host: localhost
  port: 5432
  database: forgeportal
  user: forge

server:
  port: 4000

auth:
  sessionSecret: "dogfood-session-secret-change-me"
  oidc:
    issuer: "http://keycloak:8080/realms/forgeportal"  # use "keycloak" (container name) when running with docker-compose.keycloak.yml
    clientId: "forgeportal"
    # clientSecret: set via OIDC_CLIENT_SECRET env var
    scopes: openid email profile groups
    groupsClaim: groups
  roleMapping:
    platform-admin: ["forge-admins", "admin"]
    developer: ["developers"]

scm:
  github:
    # token: set via FORGEPORTAL_SCM__GITHUB__TOKEN env var
    # webhookSecret: set via FORGEPORTAL_SCM__GITHUB__WEBHOOK_SECRET env var

discovery:
  orgs:
    - provider: github
      org: forgeportal-demo-acmecorp   # replace with your throwaway org
  entityFilePath: entity.yaml
  intervalMinutes: 0                   # 0 = manual scan only

pluginPackages:
  packages: []
  # - "@myorg/forge-plugin-example"
```

---

## Development Tasks

1. **Set up the throwaway GitHub org** with 5-10 sample repos (mix of services, libraries, frontends).
2. **Perform cold clone** into `~/projects/dogfood-test` — do not use the dev monorepo.
3. **Run AC-1 through AC-8** sequentially, documenting every friction point in real time.
4. **Create plugins:**
   - One installed from npm (use the real `@forgeportal/plugin-sdk` after first npm release, or a local `npm link` equivalent).
   - One created from scratch with `create-forge-plugin` CLI.
5. **Complete the dogfooding report** (`_bmad-output/validation/dogfooding-report.md`).
6. **File follow-up stories** for all P0 and P1 findings (prefix: `8-2-`, `8-3-`, etc.).
7. **Update docs** inline for any P2 doc gaps found during the run (can be done in the same PR as the report).

---

## Definition of Done

- [ ] All AC-1 through AC-8 have been attempted and results recorded.
- [ ] `_bmad-output/validation/dogfooding-report.md` exists and is complete.
- [ ] Time-to-value metrics table is filled.
- [ ] All P0 findings have a follow-up story created and linked.
- [ ] All P1 findings have a follow-up story created or a doc fix PR.
- [ ] At least one successful template run opened a real PR in the demo GitHub org.
- [ ] At least one custom plugin (created via CLI) is loaded and functional in the running portal.
- [ ] Scorecard results are visible for at least 3 entities.
- [ ] The running instance is left intact (not deleted) for a demo session.
