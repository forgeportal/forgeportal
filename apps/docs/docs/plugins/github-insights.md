---
title: GitHub Insights Plugin
sidebar_position: 3
---

# @forgeportal/plugin-github-insights

The **GitHub Insights plugin** is a fullstack plugin that adds a **GitHub** tab to catalog entities, surfacing live repository data — open pull requests, recent commits, top contributors, and CI workflow runs — directly in ForgePortal.

## Features

| Feature | Description |
|---------|-------------|
| **Open PRs** | List of open pull requests with author, title, labels, and age |
| **Recent commits** | Last 20 commits with SHA, author, message, and timestamp |
| **Top contributors** | Ranked contributor list with commit counts |
| **Workflow runs** | Latest GitHub Actions workflow runs with status and duration |
| **Repo overview** | Stars, forks, open issues, default branch, language |

---

## Prerequisites

- ForgePortal API running
- A GitHub **Personal Access Token** (PAT) or **GitHub App** token with the following scopes:
  - `repo` — read access to repository contents and metadata
  - `read:org` — read access to organisation membership (for org repositories)
- The API container must have network access to `api.github.com`

:::tip Token reuse
If you have already configured `scm.github.token` in `forgeportal.yaml` for catalog discovery, the GitHub Insights plugin **automatically reuses that token**. No separate configuration is required.
:::

---

## Installation

### 1. Add the plugin package

```yaml
# forgeportal.yaml
pluginPackages:
  packages:
    - "@forgeportal/plugin-github-insights"
```

### 2. Sync dependencies

```bash
pnpm forge:sync
```

### 3. Configure (optional)

The plugin works out of the box when `scm.github.token` is set. For an explicit token or custom cache TTL:

```yaml
plugins:
  github-insights:
    enabled: true
    config:
      # Optional: override cache TTL (seconds). Default: 300
      cacheTTLSeconds: 300
```

Set the token as an environment variable:

```bash
# Reuses SCM token by default — or set a dedicated one:
FORGEPORTAL_PLUGIN_GITHUB_INSIGHTS_TOKEN=ghp_...
# Falls back to:
SCM_GITHUB_TOKEN=ghp_...
```

---

## Configuration reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cacheTTLSeconds` | `number` | `300` | In-memory cache TTL for GitHub API responses (seconds). Helps avoid rate limiting. |

The plugin token is resolved in this order:

1. `FORGEPORTAL_PLUGIN_GITHUB_INSIGHTS_TOKEN` environment variable
2. `SCM_GITHUB_TOKEN` environment variable (shared with catalog discovery)
3. Unauthenticated requests (60 req/hour rate limit — not recommended)

---

## Annotating entities

The plugin automatically resolves the GitHub repository from the entity's SCM data when catalog discovery is configured. You can also override it explicitly:

```yaml
apiVersion: forgeportal.dev/v1alpha1
kind: Service
metadata:
  name: payments-api
  annotations:
    # Override — useful when entity name ≠ repo name, or for cross-org repos
    forgeportal.dev/github-repo: "my-org/payments-api"
spec:
  owner: team:platform
  lifecycle: production
```

### Supported annotations

| Annotation | Required | Description |
|-----------|----------|-------------|
| `forgeportal.dev/github-repo` | No | GitHub repository in `owner/repo` format. Falls back to SCM discovery data if not set. |

---

## UI Walkthrough

When a repository is resolved, a **GitHub** tab appears on the entity detail page with four sections:

### Overview
Repository stats card: stars ⭐, forks 🍴, open issues, default branch, primary language, last pushed.

### Pull Requests
Table of open PRs with: title (linked to GitHub), author avatar + name, age, and label badges. Sorted by most recently updated.

### Commits
Timeline of the last 20 commits: shortened SHA, author, commit message (truncated to 72 chars), and relative timestamp.

### Contributors
Ranked list of top contributors by commit count over the repository's lifetime.

### Workflow Runs
Latest GitHub Actions run per workflow: name, branch, conclusion (✅ success, ❌ failure, 🔄 in-progress), and duration.

---

## API Routes

The plugin registers the following backend routes under `/api/v1/plugins/github-insights`:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/entities/:entityId/overview` | Repo stats (stars, forks, issues, language) |
| `GET` | `/entities/:entityId/prs` | Open pull requests |
| `GET` | `/entities/:entityId/commits` | Recent commits (last 20) |
| `GET` | `/entities/:entityId/contributors` | Top contributors by commit count |

All routes require a valid ForgePortal session.

---

## Rate Limiting

The GitHub REST API enforces rate limits:

| Authentication | Limit |
|----------------|-------|
| Authenticated (token) | **5,000 requests/hour** per token |
| Unauthenticated | **60 requests/hour** per IP |

The plugin uses an in-memory TTL cache (default: 5 minutes) to minimise API calls. For large teams with many entity pages, consider:

- Increasing `cacheTTLSeconds` to `600` or more
- Using a GitHub App (higher rate limits than PATs)
- Monitoring rate limit headers in API logs

---

## Troubleshooting

### "Repository not found" in the GitHub tab

The plugin cannot resolve a GitHub repository for the entity.

**Fix:**
1. Check that the entity has `forgeportal.dev/github-repo: "owner/repo"` annotation, **or**
2. Verify that the entity was discovered from a GitHub repository (check the Sources section in the Overview tab)
3. Ensure the token has `repo` scope for private repositories

### "Rate limit exceeded"

The API has hit the GitHub rate limit (visible in API container logs as `HTTP 403` or `HTTP 429` from `api.github.com`).

**Fix:**
1. Increase `cacheTTLSeconds` in the plugin config
2. Verify `FORGEPORTAL_PLUGIN_GITHUB_INSIGHTS_TOKEN` is set (authenticated requests have 5000 req/h vs 60 req/h unauthenticated)
3. Consider a GitHub App token with higher rate limits

### "403 Forbidden" for private repositories

The token lacks the `repo` scope.

**Fix:** Generate a new PAT with `repo` and `read:org` scopes, or update the GitHub App permissions.
