# Story 8-4: Add Optional Keycloak Service to Docker Compose

**Epic:** 8 — Dogfooding & Adoption Validation  
**Status:** ready-for-dev  
**Priority:** P1  
**Estimate:** 3 points  
**Origin:** Dogfooding report finding [DX-002]

---

## User Story

As **Alex**, a platform engineer evaluating ForgePortal with a real OIDC provider, I want a one-command way to spin up **Keycloak** alongside the portal stack, so I can test the full SSO login flow without manually installing and configuring Keycloak.

---

## Acceptance Criteria

- [ ] A new file `deployments/docker-compose/docker-compose.keycloak.yml` provides a Keycloak service:
  ```yaml
  services:
    keycloak:
      image: quay.io/keycloak/keycloak:24
      command: start-dev
      ports:
        - "8080:8080"
      environment:
        KEYCLOAK_ADMIN: admin
        KEYCLOAK_ADMIN_PASSWORD: admin
      healthcheck:
        test: ["CMD-SHELL", "curl -sf http://localhost:8080/realms/master || exit 1"]
        interval: 10s
        timeout: 5s
        retries: 10
  ```
- [ ] A new file `deployments/docker-compose/keycloak-realm-export.json` contains a pre-configured `forgeportal` realm with:
  - Client `forgeportal` (confidential, redirect URI `http://localhost:3000/auth/callback` and `http://localhost:4000/api/v1/auth/callback`)
  - Test user `alex@acmecorp.com` / `demo1234` with role `platform-admin`
  - Groups claim mapper
- [ ] `deployments/docker-compose/.env.example` — add a commented block showing the OIDC values to use when running with Keycloak:
  ```bash
  # === OIDC with bundled Keycloak (docker-compose.keycloak.yml) ===
  # OIDC_ISSUER=http://keycloak:8080/realms/forgeportal
  # OIDC_CLIENT_ID=forgeportal
  # OIDC_CLIENT_SECRET=<copy from Keycloak Clients → Credentials>
  ```
- [ ] `apps/docs/docs/configuration/oidc-setup.md` — add a "Local Keycloak (Docker Compose)" section at the top with the startup command:
  ```bash
  docker compose \
    -f deployments/docker-compose/docker-compose.yml \
    -f deployments/docker-compose/docker-compose.keycloak.yml \
    up
  ```
- [ ] The Keycloak service is **opt-in** — the main `docker-compose.yml` does not include Keycloak by default.

---

## Notes

- The realm export JSON can be auto-imported at startup via `--import-realm` and mounting the file as a volume.
- Keycloak 24+ requires `start-dev` for development mode (no TLS, in-memory H2 by default).
- The inter-container OIDC issuer should use the Docker service name `keycloak`, not `localhost`, so the API container can reach it.
