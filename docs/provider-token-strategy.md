# provider-token-strategy.md — GitHub + GitLab Auth & Token Strategy (ForgePortal V1)

This document defines the **recommended authentication modes**, **minimum permissions**, **secret storage**, and **rotation rules** for ForgePortal when integrating with **both GitHub and GitLab**. It applies regardless of backend language (V1 uses Node/TypeScript).

---

## 1) Principles (V1)

1) **Least privilege**  
   Grant only what an action needs (read vs write; workflows write only if you modify CI files).

2) **Short-lived where possible**  
   Prefer installation/OAuth tokens that expire and can be rotated automatically.

3) **Never use human personal tokens in production**  
   Use machine identities (GitHub App / GitLab project access token / bot user) and enforce expirations.

4) **No secrets in logs**  
   Redact tokens from request logs, action logs, error payloads.

---

## 2) GitHub strategy

### 2.1 Recommended (production): GitHub App (installation tokens)
**Why**: GitHub recommends considering more secure methods than classic PATs; fine-grained/App-based permissions are more controlled and can be limited to selected repos. :contentReference[oaicite:0]{index=0}

**Usage**
- Install the App on org(s)
- Grant repository access (all or selected repos)
- Use **installation access tokens** in ForgePortal backend for API calls (short-lived)

**Minimum permissions (typical V1)**
- **Contents: Read/Write** → for writing `README.md`, `docs/*`, `entity.yaml`, K8s manifests, etc.
- **Pull requests: Read/Write** → to create PRs for “Fix” actions
- **Webhooks: Read/Write** → to ensure webhook exists
- **Metadata: Read** → needed by many endpoints

> Mapping of required permissions can be verified per endpoint via GitHub’s `X-Accepted-GitHub-Permissions` header guidance for fine-grained tokens (same model as GitHub Apps). :contentReference[oaicite:1]{index=1}

**Special case: writing GitHub Actions workflows**
- If ForgePortal writes `.github/workflows/*`, you must grant the **Workflows write** permission (equivalent to classic PAT `workflow` scope). :contentReference[oaicite:2]{index=2}

### 2.2 Allowed fallback (PoC / limited org constraints): Fine-grained PAT
Fine-grained PATs:
- can be **scoped to specific repositories**
- have an **expiration**
- use the **same permission model as GitHub Apps** :contentReference[oaicite:3]{index=3}

**Minimum repository permissions (V1)**
- Contents: **write**
- Pull requests: **write**
- Webhooks: **write** (if ForgePortal manages hooks)
- Metadata: **read**
- Workflows: **write** only if you touch `.github/workflows/*` :contentReference[oaicite:4]{index=4}

### 2.3 Last resort (avoid in production): Classic PAT
GitHub warns classic PATs are “like passwords” and can grant broad access; use expirations and prefer more secure methods when possible. :contentReference[oaicite:5]{index=5}

If you must:
- `repo` scope for repo content access (private repos)
- `workflow` scope if you modify `.github/workflows/*` :contentReference[oaicite:6]{index=6}

---

## 3) GitLab strategy

### 3.1 Recommended (production): Project Access Tokens (per project) or bot user tokens
Project access tokens provide repo read/write scopes at **project level**, which is ideal for least privilege. :contentReference[oaicite:7]{index=7}

**Minimum scopes (V1)**
- `read_repository` for discovery + checks
- `write_repository` for file writes (push/update)  
- Optional: `api` only if you need broad API features; it’s powerful, so avoid unless required. :contentReference[oaicite:8]{index=8}

### 3.2 Allowed fallback: Personal Access Token (PAT) for a dedicated bot user
GitLab PAT scopes:
- `api` gives broad read/write API access
- `read_repository` allows reading private repos (and Repo Files API access)
- `write_repository` provides read-write via Git-over-HTTP (not via API), while Repo Files API write typically needs `api` depending on your approach. :contentReference[oaicite:9]{index=9}

**Recommended for ForgePortal V1**
- If you implement file ops using **Repository Files API**, GitLab documents that PAT scope `api` grants read-write access for repository files endpoints. :contentReference[oaicite:10]{index=10}
- Keep expiration short and rotate regularly. :contentReference[oaicite:11]{index=11}

### 3.3 OAuth (optional V1, more common in V2)
If you choose OAuth for user-delegated actions, GitLab OAuth applications support scopes like `api`, `read_repository`, `write_repository`. :contentReference[oaicite:12]{index=12}

---

## 4) What ForgePortal should store (and how)

### 4.1 What to store
- **Integration records** in DB (`integrations` table): non-secret config (provider URL, org/group, mode)
- **Secret reference** only (e.g., `secret_ref` → points to K8s Secret name/path or Vault path)
- Never store raw tokens unencrypted in DB

GitHub & GitLab both emphasize secure handling and expirations for tokens. :contentReference[oaicite:13]{index=13}

### 4.2 Docker Compose (local/dev)
- Use `.env` files or Docker secrets (preferred)
- Keep tokens scoped to a test org/group
- Never commit `.env`

### 4.3 Kubernetes (prod)
- Store secrets in **Kubernetes Secrets** (baseline) or external secret manager (V2)
- Reference secrets from deployments via envFrom / mounted files
- Rotate secrets without redeploying code where possible

---

## 5) Rotation & auditing rules (V1)

### 5.1 Rotation
- Set expirations on all PATs (GitHub recommends expirations; GitLab defaults to expirations and documents usage tracking). :contentReference[oaicite:14]{index=14}
- Rotate at least every **60–90 days** (policy recommendation)
- Rotate immediately if:
  - a token leaks
  - a maintainer with access leaves
  - scope creep is detected

### 5.2 Audit
- Every action run that writes to SCM must log (without secrets):
  - actor
  - repo
  - files changed
  - PR/MR URL or commit SHA
- Use GitLab token usage info (“last used”, “IP addresses”) as an operational check where available. :contentReference[oaicite:15]{index=15}

---

## 6) Permission mapping cheat sheet (ForgePortal V1 actions)

### GitHub
- **File writes** (`README.md`, `docs/*`, `entity.yaml`, `k8s/*`): Contents write :contentReference[oaicite:16]{index=16}
- **PR creation**: Pull requests write (fine-grained/App permission model) :contentReference[oaicite:17]{index=17}
- **Workflow file writes** (`.github/workflows/*`): Workflows write / classic `workflow` scope :contentReference[oaicite:18]{index=18}

### GitLab
- **Repository files API read/write**: PAT scope `api` (read-write) / `read_api` (read) for repo files endpoints :contentReference[oaicite:19]{index=19}
- **Project creation**: Projects API `POST /projects` (needs appropriate rights via token/app) :contentReference[oaicite:20]{index=20}

---

## 7) Recommended defaults for V1

### Default GitHub mode
- **GitHub App**
- Permissions: Contents write, PR write, Webhooks write, Metadata read
- Enable Workflows write only if you support `ci.bootstrap` into `.github/workflows/*`

### Default GitLab mode
- **Project access tokens** per project for strongest least privilege :contentReference[oaicite:21]{index=21}
- If you need org-wide scanning in V1: bot user PAT with **minimal scopes** and expirations :contentReference[oaicite:22]{index=22}