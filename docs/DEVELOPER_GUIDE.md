# ForgePortal — Developer Guide

Practical reference for contributors and maintainers working inside the monorepo.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Repository Setup](#repository-setup)
- [Monorepo Structure](#monorepo-structure)
- [Turborepo & Scripts](#turborepo--scripts)
- [Running Services Locally](#running-services-locally)
- [Environment Variables](#environment-variables)
- [Code Conventions](#code-conventions)
- [Database Migrations](#database-migrations)
- [Testing](#testing)
- [Adding a Package](#adding-a-package)

---

## Prerequisites

| Tool | Minimum version | Install |
|------|----------------|---------|
| Node.js | 20.19 | [nodejs.org](https://nodejs.org) or `nvm use` |
| pnpm | 10 | `npm i -g pnpm@10` |
| Docker | 24 | [docker.com](https://www.docker.com) |
| Git | 2.38 | system package manager |

The `.node-version` file at the root pins the exact Node version. If you use `nvm` or `fnm`, running `nvm use` / `fnm use` in the root will pick it up automatically.

---

## Repository Setup

```bash
# 1. Clone
git clone https://github.com/forgeportal/forgeportal
cd forgeportal

# 2. Install all workspace dependencies (hoisted via pnpm)
pnpm install

# 3. Copy env file
cp deployments/docker-compose/.env.example deployments/docker-compose/.env

# 4. Start PostgreSQL
docker compose -f deployments/docker-compose/docker-compose.yml up postgres -d

# 5. Start everything in watch mode
pnpm dev
```

Services will be available at:

| Service | URL |
|---------|-----|
| UI | http://localhost:3000 |
| API | http://localhost:4000 |
| Docs site | http://localhost:3001 |
| PostgreSQL | localhost:5433 |

---

## Monorepo Structure

```
forgeportal/
├── apps/
│   ├── api/          # Fastify HTTP server (entry point: src/index.ts)
│   ├── worker/       # Background job processor (polls jobs table)
│   ├── ui/           # React 19 + Vite frontend
│   └── docs/         # Docusaurus 3 documentation site
├── packages/
│   ├── core/         # Config loader (Zod), logger (pino), errors, shared types
│   ├── auth/         # OIDC session, RBAC middleware, permission checks
│   ├── catalog/      # Entity CRUD, repo scanner, webhook ingestion, FTS
│   ├── scaffolder/   # Template runner, action executor, audit log
│   ├── scorecards/   # Rule engine, evaluation queue, fix-action PRs
│   ├── docs/         # Markdown renderer (rehype-sanitize), FTS indexer
│   ├── scm/          # GitHub & GitLab provider adapters
│   ├── search/       # Unified search across entities + docs
│   ├── db/           # pg pool, migration runner, job queue primitives
│   └── plugin-sdk/   # Plugin types, hooks, PluginRegistry
├── tools/
│   ├── migration/    # Numbered SQL migration files (run by packages/db)
│   ├── seed/         # Dev seed data
│   └── create-forge-plugin/  # Plugin scaffold CLI (npx create-forge-plugin)
├── deployments/
│   ├── docker-compose/       # Production-grade compose stack
│   └── helm/                 # Helm chart for Kubernetes
└── docs/                     # Internal design specs (PRD, architecture, threat model)
```

### Dependency graph (simplified)

```
apps/api   ──►  packages/catalog
           ──►  packages/auth
           ──►  packages/scaffolder
           ──►  packages/scorecards
           ──►  packages/search
           ──►  packages/core
           ──►  packages/db

apps/worker ──► packages/catalog
            ──► packages/scaffolder
            ──► packages/scorecards
            ──► packages/docs
            ──► packages/db

apps/ui    ──►  packages/plugin-sdk (types only)
```

All cross-package imports use the workspace protocol: `"@forgeportal/core": "workspace:*"`.

---

## Turborepo & Scripts

[Turborepo](https://turbo.build) orchestrates tasks with dependency awareness and caching.

### Root scripts (`pnpm <script>`)

| Script | What it does |
|--------|-------------|
| `pnpm dev` | Starts all apps in watch/dev mode in parallel |
| `pnpm build` | Builds all packages in topological order (`^build` dependency) |
| `pnpm test` | Runs tests across all packages (after build) |
| `pnpm lint` | Runs ESLint across all packages |
| `pnpm clean` | Removes all `dist/` and `.turbo/` caches |

### Filter to a single package

```bash
# Run dev for just the API
pnpm --filter @forgeportal/api dev

# Build just the catalog package and its dependencies
pnpm --filter @forgeportal/catalog... build

# Test a single package
pnpm --filter @forgeportal/scaffolder test
```

### Turborepo cache

Turbo caches task outputs locally in `.turbo/`. Remote caching (Turbo Remote Cache or self-hosted) can be enabled via `turbo login` — useful in CI.

---

## Running Services Locally

### API only

```bash
docker compose -f deployments/docker-compose/docker-compose.yml up postgres -d
pnpm --filter @forgeportal/api dev
# API available at http://localhost:4000
```

### Worker only

```bash
pnpm --filter @forgeportal/worker dev
# Polls the jobs table every few seconds
```

### UI only (needs API running)

```bash
pnpm --filter @forgeportal/ui dev
# Vite dev server at http://localhost:3000
# Proxies /api/* to http://localhost:4000
```

### Docs site

```bash
pnpm --filter @forgeportal/docs-site dev
# Docusaurus at http://localhost:3001
```

### OIDC bypass (development)

Leave `OIDC_ISSUER` empty in `.env`. The API will run in dev-bypass mode: all requests are authenticated as a synthetic admin user. **Never use this in production.**

---

## Environment Variables

All runtime config flows through `forgeportal.yaml` (validated by Zod in `packages/core/src/config.schema.ts`). Environment variables override YAML fields using two conventions:

1. **Legacy map** — explicit mappings defined in `packages/core/src/config.loader.ts` (e.g. `DB_HOST`, `OIDC_ISSUER`, `SCM_GITHUB_TOKEN`).
2. **Generic override** — any `FORGEPORTAL_<SECTION>_<FIELD>` env var overrides the corresponding YAML path (e.g. `FORGEPORTAL_SERVER_PORT=4001`).

Copy `.env.example` for local dev:

```bash
cp deployments/docker-compose/.env.example deployments/docker-compose/.env
```

See [`apps/docs/docs/configuration/env-vars.md`](../apps/docs/docs/configuration/env-vars.md) for the full reference.

---

## Code Conventions

### TypeScript

- **Strict mode** everywhere (`"strict": true` in `tsconfig.base.json`).
- No `any` — use `unknown` + type guards.
- Prefer `type` over `interface` for plain data shapes; use `interface` for extensible contracts.
- All public API surfaces must be explicitly typed (no inferred return types on exported functions).

### Imports

- Use workspace package names (`@forgeportal/core`), never relative paths across package boundaries.
- Keep barrel exports (`index.ts`) minimal — only export what external packages need.

### Formatting & Linting

```bash
# Format (Prettier)
pnpm --filter <pkg> exec prettier --write src/

# Lint (ESLint flat config)
pnpm lint

# Both via lint-staged on commit (if configured)
```

Configuration files: `.prettierrc` (root), `eslint.config.mts` (root).

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

feat(catalog):    add entity relation endpoint
fix(auth):        handle expired OIDC tokens gracefully
refactor(db):     extract job queue into separate module
docs(readme):     update quick-start steps
chore(deps):      upgrade fastify to 5.x
test(scaffolder): add integration test for template run
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.

---

## Seed Data

The monorepo ships several seed scripts for local development and demos.
All scripts read DB credentials from environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) with sensible defaults matching the `docker-compose` dev setup.

| Script | Description |
|---|---|
| `pnpm seed:demo` | Insert 12 realistic demo entities (idempotent) |
| `pnpm seed:docs` | Insert `docs_bindings` + 3 `docs_pages` per entity — enables the Docs tab without a live SCM connection (idempotent) |
| `pnpm seed:all` | Run `seed:demo` then `seed:docs` in sequence |
| `pnpm seed:reset` | `TRUNCATE entities CASCADE` then re-run `seed:demo` (dev only) |

**Quick start for local development:**

```bash
# 1. Start Postgres (docker-compose dev stack)
docker compose -f deployments/docker-compose/docker-compose.yml up -d postgres

# 2. Populate catalog + docs
pnpm seed:all
# → Seeded 12 entities.
# → Seeded 12 docs bindings, 36 pages (3 per entity).

# 3. Full reset
pnpm seed:reset && pnpm seed:docs
```

Scripts live in `tools/seed/`:

```
tools/seed/
├── seed_v1.sql      # Core reference data (templates, actions) — runs on API boot
├── seed_demo.ts     # Demo catalog entities (pnpm seed:demo)
└── seed_docs.ts     # Demo docs pages (pnpm seed:docs)
```

---

## Database Migrations

Migrations live in `tools/migration/` as numbered SQL files:

```
tools/migration/
├── 001_init.sql
├── 002_triggers.sql
├── 003_v1_1_additions.sql
├── 004_entity_sources_upsert.sql
├── 005_template_runs.sql
├── 006_fix_legacy_templates.sql
├── 007_scorecard_eval_composite_index.sql
├── 008_jobs_payload_index.sql
├── 009_plugin_overrides.sql
└── 010_scm_integrations.sql
```

### How migrations run

The migration runner in `packages/db` applies files in numeric order and tracks applied migrations in a `schema_migrations` table. Migrations run automatically on API startup.

### Writing a new migration

1. Create `tools/migration/NNN_description.sql` (next sequential number).
2. Write idempotent SQL — use `IF NOT EXISTS`, `DO $$ ... $$` guards where needed.
3. Never modify an already-applied migration — always add a new file.

```sql
-- tools/migration/011_example.sql
ALTER TABLE entities ADD COLUMN IF NOT EXISTS display_name text;

CREATE INDEX IF NOT EXISTS entities_display_name_idx
  ON entities (display_name);
```

4. Test locally by restarting the API:
```bash
pnpm --filter @forgeportal/api dev
# Migration NNN_example.sql applied — logged on startup
```

---

## Testing

Tests use **Vitest** (co-located with source files as `*.test.ts`).

### Run all tests

```bash
pnpm test
```

Turbo ensures packages are built before tests run (`"dependsOn": ["build"]` in `turbo.json`).

### Run tests for one package

```bash
pnpm --filter @forgeportal/catalog test
pnpm --filter @forgeportal/scaffolder test --watch   # watch mode
```

### Integration tests (need a database)

Some packages (e.g. `packages/catalog`, `packages/db`) have integration tests that require a live PostgreSQL instance. Set the following in your environment before running:

```bash
export DB_HOST=localhost
export DB_PORT=5433
export DB_NAME=forgeportal_test
export DB_USER=forgeportal
export DB_PASSWORD=forgeportal
```

Or pass them inline:
```bash
DB_HOST=localhost DB_PORT=5433 pnpm --filter @forgeportal/catalog test
```

These variables are listed as `passThroughEnv` in `turbo.json` so Turbo forwards them to the test process.

### Test conventions

- Unit tests: pure logic, no I/O, mock database/external calls.
- Integration tests: suffix file with `.integration.test.ts`, require real DB.
- Name test files alongside the source: `catalog.service.ts` → `catalog.service.test.ts`.

---

## Adding a Package

```bash
# 1. Create the package directory
mkdir packages/my-feature
cd packages/my-feature

# 2. Init package.json
pnpm init
# Set name to "@forgeportal/my-feature"

# 3. Add tsconfig.json extending the base
cat > tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
EOF

# 4. Add to pnpm-workspace.yaml (already includes packages/* glob)

# 5. Reference from another package
# In apps/api/package.json:
#   "@forgeportal/my-feature": "workspace:*"

pnpm install
```

---

## CI/CD & GitHub Secrets

### GitHub Actions workflows

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | PR + push to `master` | Install, lint, build, test (with PostgreSQL service) |
| `release.yml` | `v*.*.*` tag | CI guard → Docker → npm publish → GitHub Release |
| `docs-deploy.yml` | push to `master` (docs paths) | Waits for CI, then rsync to VPS |
| `codeql.yml` | PR + push + weekly | CodeQL static analysis (JS/TS) |

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Purpose | How to obtain |
|--------|---------|---------------|
| `NPM_TOKEN` | Publish `@forgeportal/plugin-sdk` and `create-forge-plugin` to npm | npmjs.com → Access Tokens → Automation token |
| `VPS_HOST` | IP of the docs VPS | `161.97.75.44` |
| `VPS_SSH_KEY` | Private SSH key for rsync deploy | Generated on VPS, see deployment setup |
| `TURBO_TOKEN` | Vercel Remote Cache token *(optional)* | vercel.com → Account Settings → Tokens |
| `TURBO_TEAM` | Vercel team slug *(optional)* | Your Vercel team URL slug |

`GITHUB_TOKEN` is provided automatically by GitHub Actions — no setup needed (used for GHCR push and GitHub Release creation).

### Creating a release

```bash
git tag -a v1.0.0 -m "ForgePortal v1.0.0"
git push origin v1.0.0
```

This triggers `release.yml` which:
1. Re-runs full CI as a guard
2. Builds and pushes Docker images to `ghcr.io/forgeportal/forgeportal-{api,worker,ui}:1.0.0`
3. Publishes `@forgeportal/plugin-sdk` and `create-forge-plugin` to npm with provenance
4. Creates a GitHub Release with auto-generated notes and the Helm chart `.tgz`

---

## Further Reading

- [Configuration Reference](../apps/docs/docs/configuration/forgeportal-yaml.md)
- [Plugin Development Guide](../apps/docs/docs/plugin-development/overview.md)
- [API Reference](../apps/docs/docs/api/overview.md)
- [Deployment Guide](../apps/docs/docs/deployment/docker-compose.md)
