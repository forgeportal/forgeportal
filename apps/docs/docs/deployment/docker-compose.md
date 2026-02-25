---
title: Docker Compose
sidebar_position: 1
---

# Docker Compose (production)

This guide describes a **production-oriented** Docker Compose setup: pre-built images, named volumes, restart policy, secrets management, Nginx reverse proxy, and TLS. For local development, use the dev compose in `deployments/docker-compose/` (build from source).

---

## Production Compose file

Use **pre-built images** (from your registry), **named volumes**, and **restart policy**. Do not use `build:` in production.

```yaml
# docker-compose.prod.yml (example)
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_HOST_AUTH_METHOD: scram-sha-256
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - forgeportal

  api:
    image: ghcr.io/forgeportal/forgeportal:1.0.0
    restart: unless-stopped
    env_file: .env.production
    environment:
      NODE_ENV: production
      PORT: 4000
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:4000/livez').then(r=>{if(!r.ok)throw r.status;process.exit(0)}).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 5
    command: ["node", "api/dist/server.js"]
    networks:
      - forgeportal

  worker:
    image: ghcr.io/forgeportal/forgeportal:1.0.0
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      api:
        condition: service_healthy
    command: ["node", "worker/dist/worker.js"]
    networks:
      - forgeportal

  ui:
    image: ghcr.io/forgeportal/forgeportal-ui:1.0.0
    restart: unless-stopped
    env_file: .env.production
    depends_on:
      api:
        condition: service_healthy
    networks:
      - forgeportal

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - api
      - ui
    networks:
      - forgeportal

volumes:
  pgdata:

networks:
  forgeportal:
    driver: bridge
```

---

## Configuration file (`forgeportal.yaml`)

The `api` and `worker` services mount `../../forgeportal.yaml` (relative to the Compose file) into `/app/forgeportal.yaml` inside the container. Place your `forgeportal.yaml` at the **project root** — it is picked up automatically. If the file does not exist the containers start with schema defaults.

```bash
# At the repository root:
cp forgeportal.example.yaml forgeportal.yaml
# Edit to add SCM org, discovery settings, scorecards, etc.
```

---

## Updating environment variables

:::caution Updating environment variables
`docker compose restart` does **not** reload `.env`. After changing any environment variable, force container recreation:

```bash
docker compose up -d --force-recreate api worker
```
:::

---

## Secrets

**Never** commit `.env.production` or files containing passwords.

- **Option A — env file**: Create `.env.production` on the server (or in a secrets store), with `DB_PASSWORD`, `OIDC_CLIENT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`, SCM tokens, etc. Set permissions `chmod 600 .env.production` and restrict access.
- **Option B — Docker secrets** (Docker Swarm): Use `secrets:` in the service and mount or inject secret files. For standalone Compose, env file is the usual approach; you can also use `env_file` pointing to a file populated from a vault.

Example minimal production env (values from vault or CI):

```bash
# .env.production (do not commit)
DB_HOST=postgres
DB_PORT=5432
DB_NAME=forgeportal
DB_USER=forge
DB_PASSWORD=<strong-password>

PORT=4000
NODE_ENV=production
LOG_LEVEL=info

OIDC_ISSUER=https://keycloak.example.com/realms/forgeportal
OIDC_CLIENT_ID=forgeportal
OIDC_CLIENT_SECRET=<from-idp>

SESSION_SECRET=<min-16-chars-random>
ENCRYPTION_KEY=<min-16-chars-random>

# SCM / plugins as needed
# FORGEPORTAL_SCM__GITHUB__TOKEN=...
```

---

## Nginx reverse proxy

Place Nginx in front of the API and UI so a single host/port serves the app and TLS is terminated at Nginx.

Example snippet (include in your `nginx.conf` or `conf.d/forgeportal.conf`):

```nginx
upstream forgeportal_api {
    server api:4000;
}

upstream forgeportal_ui {
    server ui:3000;
}

server {
    listen 80;
    server_name forgeportal.example.com;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name forgeportal.example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    location /api {
        proxy_pass http://forgeportal_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://forgeportal_ui;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Adjust `server_name` and paths to match your domain and UI (e.g. if the UI is served at `/` and the API at `/api`).

---

## TLS (SSL/TLS)

- **Let's Encrypt**: Use certbot to obtain certificates, then point Nginx to the cert paths (e.g. `/etc/letsencrypt/live/forgeportal.example.com/fullchain.pem` and `privkey.pem`). Mount these into the Nginx container. Renew with a cron job or systemd timer.
- **Own certificate**: Place your `fullchain.pem` and `privkey.pem` in a directory (e.g. `./certs`) and mount it into the Nginx container as in the compose snippet above.

Ensure `X-Forwarded-Proto` is set to `https` so the API generates correct callback and redirect URLs.

---

## Observability & Metrics

ForgePortal exposes Prometheus metrics on two endpoints:

| Service | Default port | Path | Auth required |
|---------|-------------|------|---------------|
| API | 4000 | `/metrics` | **No** (intentional) |
| Worker | 9090 | `/metrics` | **No** (intentional) |

Both endpoints are **unauthenticated by design** — the Prometheus pull model does not support request-level auth in the default scrape configuration. The Worker metrics port (9090) is **not** published to the host in the default `docker-compose.yml`; it is accessible only within the Docker network.

> **⚠ Production security:** Restrict both endpoints to your internal network. Do **not** expose them publicly. Use a Kubernetes `NetworkPolicy`, an nginx `allow` directive, or a firewall/security group rule to limit access to your Prometheus instance.

**Prometheus scrape config example:**

```yaml
scrape_configs:
  - job_name: forgeportal-api
    static_configs:
      - targets: ['forgeportal-api:4000']
  - job_name: forgeportal-worker
    static_configs:
      - targets: ['forgeportal-worker:9090']
```

**Kubernetes NetworkPolicy example** (restrict API metrics to the `monitoring` namespace):

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-metrics
spec:
  podSelector:
    matchLabels:
      app: forgeportal-api
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - port: 4000
```

**nginx `allow` example** (block `/metrics` except from localhost/internal):

```nginx
location /metrics {
    allow 10.0.0.0/8;   # your Prometheus server CIDR
    allow 127.0.0.1;
    deny  all;
    proxy_pass http://forgeportal_api;
}
```

---

## Health checks

- **Postgres**: `pg_isready` in the compose healthcheck ensures the DB is up before the API starts.
- **API**: The compose healthcheck calls `http://127.0.0.1:4000/livez`. The API exposes:
  - `GET /livez` — liveness (no DB check)
  - `GET /healthz` — readiness (can include DB ping if implemented)

Use these endpoints for orchestration or monitoring; Nginx can use them for `health_check` if needed.

---

## Running

1. Build and push images to your registry (CI or manual).
2. On the server, create `.env.production` and (if using Nginx) `nginx.conf` and certs.
3. Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

4. Check health: `curl -k https://forgeportal.example.com/api/v1/...` or `curl http://localhost:4000/livez` if the API port is exposed for debugging.
