# Story 8-3: Document Dev-Bypass Login Mode & Add Local Docs Note

**Epic:** 8 — Dogfooding & Adoption Validation  
**Status:** ready-for-dev  
**Priority:** P1  
**Estimate:** 1 point  
**Origin:** Dogfooding report finding [DOCS-002], [DOCS-004]

---

## User Story

As **Alex**, a first-time ForgePortal user running the Docker Compose stack locally, I want the Quick Start guide to clearly tell me that I **don't need an OIDC provider** for local development, so I can explore the portal immediately without configuring Keycloak or any other IdP.

---

## Acceptance Criteria

- [ ] `apps/docs/docs/getting-started/quick-start-docker.md` — add a callout after the "Create your environment file" step:
  ```
  :::tip No OIDC required for local dev
  Leave all `OIDC_*` variables commented out (the defaults in `.env.example`).
  The portal starts in **dev-bypass mode**: you are automatically logged in as
  an admin user. No Keycloak or external IdP needed.

  To connect a real identity provider, see [OIDC Setup](/docs/configuration/oidc-setup).
  :::
  ```
- [ ] `README.md` Quick Start section — add one sentence below the "Open http://localhost:3000" line:
  > By default the portal runs in **dev mode** (no login required). Add `OIDC_*` variables to enable SSO.
- [ ] `apps/docs/docs/getting-started/quick-start-docker.md` — add a note at the bottom:
  > **Docs site:** Browse the full documentation at [docs.forgeportal.dev](https://docs.forgeportal.dev), or run it locally:
  > ```bash
  > pnpm --filter @forgeportal/docs-site dev   # → http://localhost:3001
  > ```

---

## Notes

- This is a docs-only change — no code modifications required.
- The dev-bypass behaviour is already implemented in `packages/auth`; this story only documents it.
