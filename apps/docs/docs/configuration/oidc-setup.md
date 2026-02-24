---
title: OIDC Setup
sidebar_position: 2
---

# OIDC Setup

ForgePortal uses **OpenID Connect (OIDC)** for single sign-on. You configure one IdP and map its groups/roles to ForgePortal roles via `auth.oidc` and `auth.roleMapping` in [forgeportal.yaml](/docs/configuration/forgeportal-yaml#auth). This page gives step-by-step guides for five common providers.

:::tip No OIDC required for local dev
Leave all `OIDC_*` variables unset (or commented out). The portal starts in **dev-bypass mode**: you are automatically logged in as a platform admin. No IdP needed.

Set `OIDC_ISSUER` (+ client ID and secret) only when you want real SSO login.
:::

---

## Local Keycloak (Docker Compose)

The fastest way to get a working OIDC setup locally is the **bundled Keycloak overlay**. It spins up a pre-configured Keycloak instance alongside ForgePortal in one command — no manual realm creation needed.

### What's included

| | Value |
|---|---|
| Keycloak admin console | `http://localhost:8080` — `admin` / `admin` |
| Realm | `forgeportal` |
| Client ID | `forgeportal` |
| Client secret | `forgeportal-dev-secret` |
| Test user | `alex@acmecorp.com` / `demo1234` |
| Test user role | `platform-admin` (via group `forge-admins`) |

### Start the stack with Keycloak

```bash
docker compose \
  -f deployments/docker-compose/docker-compose.yml \
  -f deployments/docker-compose/docker-compose.keycloak.yml \
  up
```

### Configure ForgePortal

In `deployments/docker-compose/.env`, uncomment the Keycloak block:

```bash
OIDC_ISSUER=http://keycloak:8080/realms/forgeportal
OIDC_CLIENT_ID=forgeportal
OIDC_CLIENT_SECRET=forgeportal-dev-secret
```

:::caution Inter-container hostname
Use `http://keycloak:8080` (the Docker service name), **not** `http://localhost:8080`. The API container resolves `keycloak` inside the Docker network; `localhost` would point to the API container itself.

When accessing Keycloak from your **browser** (e.g. for the admin console or to debug tokens), use `http://localhost:8080`.
:::

### Configure ForgePortal YAML

In `forgeportal.yaml` (or the file you mount into the container):

```yaml
auth:
  sessionSecret: "change-me-in-production"
  oidc:
    issuer: "http://keycloak:8080/realms/forgeportal"
    clientId: "forgeportal"
    # clientSecret: set via OIDC_CLIENT_SECRET env var
    scopes: openid email profile groups
    groupsClaim: groups
  roleMapping:
    platform-admin: ["forge-admins"]
    developer: ["developers"]
```

### Add more users

1. Open `http://localhost:8080` → log in as `admin` / `admin`.
2. Select realm **forgeportal** → **Users** → **Add user**.
3. Fill email, set a password under **Credentials**, and assign to group `forge-admins` or `developers`.

---

## Common steps (all IdPs)

1. **Create an OAuth2 / OIDC application** in your IdP (confidential client).
2. **Set redirect URI** to:  
   `https://<your-forgeportal-host>/api/v1/auth/callback`  
   (or `http://localhost:4000/api/v1/auth/callback` for local dev).
3. **Note** client ID and client secret; put the secret in env as `OIDC_CLIENT_SECRET`, never in YAML.
4. **Configure scopes** so the IdP returns identity and (if needed) groups/roles.
5. **Configure ForgePortal** with issuer, clientId, scopes, and optionally `groupsClaim` and `roleMapping`.

---

## 1. Keycloak

### IdP setup

1. Realm: create or use an existing realm (e.g. `forgeportal`).
2. **Clients** → Create client:
   - Client type: **OpenID Connect**
   - Client ID: e.g. `forgeportal`
   - Access type: **confidential**
   - Valid redirect URIs: `https://<forge-host>/api/v1/auth/callback`
   - Web origins: same origin or `*` for dev
3. **Credentials** tab: copy the **Secret** → set as `OIDC_CLIENT_SECRET`.
4. **Client scopes**: ensure the client has scopes that include `openid`, `email`, `profile`, and a scope that exposes **groups** (e.g. add the built-in `groups` scope to the client, or create a mapper that adds groups to the token).

### ForgePortal config

```yaml
auth:
  oidc:
    issuer: https://<keycloak-host>/realms/<realm-name>
    clientId: forgeportal
    # clientSecret: OIDC_CLIENT_SECRET
    scopes: openid email profile groups
    groupsClaim: groups
  roleMapping:
    platform-admin: ["forge-admins", "admin"]
    developer: ["developers"]
    viewer: ["viewers"]
```

- **Issuer**: `https://<keycloak-host>/realms/<realm>` (no trailing slash).
- **groupsClaim**: Keycloak often uses `groups`; if you use a custom claim (e.g. `realm_access.roles`), set it here.

---

## 2. Okta

### IdP setup

1. **Applications** → Create App Integration → **OIDC**, **Web Application**.
2. **Sign-in redirect URIs**: `https://<forge-host>/api/v1/auth/callback`.
3. **Sign-out redirect URI** (optional): your app URL.
4. **Assignments**: All users or specific groups.
5. After creation: copy **Client ID** and **Client secret**; set secret as `OIDC_CLIENT_SECRET`.
6. **Assignments** → add groups if you use group-based access. Okta can expose groups in the token via **Authorization Server** → **Claims** (add a groups claim to the access or ID token).

### ForgePortal config

```yaml
auth:
  oidc:
    issuer: https://<your-domain>.okta.com/oauth2/default
    clientId: <client-id>
    scopes: openid email profile groups
    groupsClaim: groups
  roleMapping:
    platform-admin: ["Admins", "SRE"]
    developer: ["Developers"]
```

- **Issuer**: use your authorization server URL, e.g. `https://<your-domain>.okta.com/oauth2/default` or a custom server.
- If your Okta server uses a different claim for groups (e.g. `organization.groups`), set `groupsClaim` accordingly.

---

## 3. Auth0

### IdP setup

1. **Applications** → Create Application → **Regular Web Application**.
2. **Settings**:
   - **Allowed Callback URLs**: `https://<forge-host>/api/v1/auth/callback`
   - **Allowed Logout URLs**: optional
3. Copy **Client ID** and **Client Secret**; set secret as `OIDC_CLIENT_SECRET`.
4. **Rules** or **Actions** (optional): add a rule/action to include `groups` or `roles` in the token (Auth0 does not add groups by default; you can add a custom claim from app_metadata or authorization extension).

### ForgePortal config

```yaml
auth:
  oidc:
    issuer: https://<tenant>.auth0.com/
    clientId: <client-id>
    scopes: openid email profile
    groupsClaim: groups   # or https://your-namespace/roles if using Auth0 roles
  roleMapping:
    platform-admin: ["admin"]
    developer: ["developer"]
```

- **Issuer**: `https://<tenant>.auth0.com/` (trailing slash is common).
- If you use Auth0’s RBAC, the roles claim is often namespaced; set `groupsClaim` to that claim (e.g. `https://your-app/roles`).

---

## 4. Azure AD (Entra ID)

### IdP setup

1. **App registrations** → New registration:
   - Name: e.g. `ForgePortal`
   - Supported account types: as needed (single tenant / multitenant)
   - Redirect URI: **Web** → `https://<forge-host>/api/v1/auth/callback`
2. **Certificates & secrets** → New client secret → copy value → `OIDC_CLIENT_SECRET`.
3. **API permissions**: Add Microsoft Graph (or OpenID) → **OpenId permissions**: `openid`, `email`, `profile`. For groups: **Delegated** → **GroupMember.Read.All** or use **Groups** claim in token.
4. **Token configuration**: Add optional claim **groups** (or **roles** for app roles) so the ID token includes them.

### ForgePortal config

```yaml
auth:
  oidc:
    issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
    clientId: <application-client-id>
    scopes: openid email profile
    groupsClaim: groups
  roleMapping:
    platform-admin: ["<object-id-of-admin-group>"]
    developer: ["<object-id-of-dev-group>"]
```

- **Issuer**: `https://login.microsoftonline.com/<tenant-id>/v2.0` (replace `<tenant-id>`).
- Azure often returns **groups** as object IDs (GUIDs); map those in `roleMapping`, or use app roles and set `groupsClaim: roles`.

---

## 5. AWS Cognito

### IdP setup

1. **User pool** → App integration → **App client** (or create one):
   - Type: **Confidential client**
   - Auth flows: **ALLOW_USER_PASSWORD_AUTH**, **ALLOW_REFRESH_TOKEN_AUTH**, and **ALLOW_USER_SRP_AUTH** are optional; for OIDC code flow you need **Authorization code grant** and **openid**.
   - Callback URL(s): `https://<forge-host>/api/v1/auth/callback`
   - Sign out URL: optional
2. Note **Client ID** and **Client secret**; set secret as `OIDC_CLIENT_SECRET`.
3. **App client** → **Hosted UI**: ensure OIDC scope includes `openid`, `email`, `profile`. For groups: add custom scope or use **Pre token generation** trigger to add `cognito:groups` to the token.

### ForgePortal config

```yaml
auth:
  oidc:
    issuer: https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
    clientId: <app-client-id>
    scopes: openid email profile
    groupsClaim: cognito:groups
  roleMapping:
    platform-admin: ["admins", "PlatformAdmins"]
    developer: ["developers"]
```

- **Issuer**: `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>` (no trailing slash).
- Cognito puts groups in `cognito:groups`; set `groupsClaim: cognito:groups` and map group names in `roleMapping`.

---

## ForgePortal roles (reminder)

| Role | Purpose |
|------|--------|
| `platform-admin` | Full platform and template management. |
| `template-admin` | Manage templates and related config. |
| `team-admin` | Manage teams and members. |
| `developer` | Create/edit entities, run actions. |
| `viewer` | Read-only access. |

Users get the **highest** role they match in `roleMapping`. If no group matches, they are treated as `viewer` (or denied if your IdP does not issue a token). Set `roleMapping` so each IdP group name (or role) maps to exactly one ForgePortal role.

For full config options, see [forgeportal.yaml — auth](/docs/configuration/forgeportal-yaml#auth) and [Environment Variables](/docs/configuration/env-vars).
