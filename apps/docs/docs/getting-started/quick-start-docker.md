---
title: Quick Start (Docker)
sidebar_position: 2
---

# Quick Start (Docker)

Run ForgePortal with **Docker** and **Docker Compose** in under 5 minutes. You'll get the API, Worker, UI, and PostgreSQL without installing Node or pnpm.

## Prerequisites

- **Docker** (Desktop or Engine) — [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** v2 (included with Docker Desktop, or `docker compose` plugin)

Check versions:

```bash
docker --version
docker compose version
```

## Steps

### 1. Clone the repository

```bash
git clone https://github.com/forgeportal/forgeportal.git
cd forgeportal
```

### 2. Go to the Compose directory

```bash
cd deployments/docker-compose
```

### 3. Create your environment file

Copy the example env file and adjust if needed (defaults work for local eval):

```bash
cp .env.example .env
```

Main variables (from `.env.example`):

```bash
# === Database ===
DB_HOST=postgres
DB_PORT=5432
DB_NAME=forgeportal
DB_USER=forge
DB_PASSWORD=forge_local_dev

# === Migrations / Seed ===
MIGRATIONS_DIR=/app/tools/migration
SEED_FILE=/app/tools/seed/seed_v1.sql

# === API Server ===
PORT=4000
NODE_ENV=development
LOG_LEVEL=debug

# === OIDC ===
# Leave all OIDC_* commented out for local dev (dev-bypass mode — no login required).
# Set these to connect a real identity provider (Keycloak, Okta, Auth0, Azure AD, Cognito).
# OIDC_ISSUER=http://localhost:8080/realms/forgeportal
# OIDC_CLIENT_ID=forgeportal
# OIDC_CLIENT_SECRET=change-me-in-production

# === Encryption ===
ENCRYPTION_KEY=local-dev-key-change-in-prod-32chars!
```

:::tip No OIDC required for local dev
Leave all `OIDC_*` variables commented out (the defaults in `.env.example`).
The portal starts in **dev-bypass mode**: you are automatically logged in as an admin user. No Keycloak or external IdP needed.

To connect a real identity provider, see [OIDC Setup](/docs/configuration/oidc-setup).
:::

:::caution Applying .env changes
`docker compose restart` reuses the existing container's environment.
After editing `.env`, run:

```bash
docker compose up -d --force-recreate api worker
```

This recreates the containers and picks up the new variables.
:::

### 3b. (Optional) Create your ForgePortal config

For basic evaluation the defaults are fine. To configure SCM discovery, plugins, or scorecards, create `forgeportal.yaml` at the **project root** (`forgeportal/`):

```bash
cp forgeportal.example.yaml forgeportal.yaml
# Edit forgeportal.yaml to add your SCM org, discovery settings, etc.
```

This file is automatically mounted into the API and Worker containers.
See the [forgeportal.yaml reference](/docs/configuration/forgeportal-yaml) for all options.

### 4. Start the stack

From `deployments/docker-compose`:

```bash
docker compose up -d
```

This starts:

- **postgres** — PostgreSQL 16 (port `5433` on host by default via `DB_PORT_HOST`)
- **api** — ForgePortal API (port `4000`)
- **worker** — Job runner (no exposed port)
- **ui** — React UI (port `3000`)

Containers wait for Postgres to be healthy, then the API, then the UI.

### 5. Open the portal

- **UI:** [http://localhost:3000](http://localhost:3000)
- **API health:** [http://localhost:4000/healthz](http://localhost:4000/healthz)
- **API liveness:** [http://localhost:4000/livez](http://localhost:4000/livez)

You should see the ForgePortal UI. In dev-bypass mode (no `OIDC_ISSUER` set) you are automatically logged in as a platform admin — no credentials required.

### 6. Optional: view logs

```bash
docker compose logs -f
```

Stop with `Ctrl+C`, then:

```bash
docker compose down
```

## Docker Compose overview

The Compose file (simplified) looks like this:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "${DB_PORT_HOST:-5433}:5432"
    environment:
      POSTGRES_DB: ${DB_NAME:-forgeportal}
      POSTGRES_USER: ${DB_USER:-forge}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-forge_local_dev}
    # ... healthcheck, volumes

  api:
    build:
      context: ../../
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    # ... healthcheck, command

  worker:
    build:
      context: ../../
      dockerfile: Dockerfile
    env_file: .env
    depends_on:
      api:
        condition: service_healthy
    # ... command

  ui:
    build:
      context: ../../
      dockerfile: deployments/docker-compose/Dockerfile.ui.dev
    ports:
      - "3000:3000"
    depends_on:
      api:
        condition: service_healthy
```

All app services use the same root `Dockerfile` and read `.env` for configuration.

## Troubleshooting

| Problem | What to do |
|--------|------------|
| **Port already in use** | Change `DB_PORT_HOST` in `.env` (e.g. `5434`) if 5433 is taken. Ports 3000 and 4000 must be free or change UI/API port mapping in `docker-compose.yml`. |
| **DB not ready** | Wait 10–15 s after `docker compose up`; healthchecks delay API/worker until Postgres is ready. Run `docker compose logs postgres` to confirm. |
| **API 503 on /healthz** | API cannot reach Postgres. Check `DB_HOST=postgres`, `DB_USER`, `DB_PASSWORD`, and that the `postgres` container is healthy. |
| **UI blank or connection refused** | Ensure the API is up (`curl http://localhost:4000/livez`) and that the UI is configured to call `http://localhost:4000` (or the correct API URL in your setup). |

Next: [Local dev setup](/docs/getting-started/local-dev-setup) to run the stack with `pnpm dev` for development.

---

## Docs site

Browse the full documentation at **[docs.forgeportal.dev](https://docs.forgeportal.dev)**, or run it locally alongside the stack:

```bash
pnpm --filter @forgeportal/docs-site dev   # → http://localhost:3001
```
