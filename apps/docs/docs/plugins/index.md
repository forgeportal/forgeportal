---
id: plugins-overview
title: Available Plugins
sidebar_position: 1
---

# Available Plugins

ForgePortal ships with **first-party plugins** that extend the portal with integrations for Kubernetes, CI/CD, observability, and more. All plugins follow the same SDK contract and can be enabled with a single line in `forgeportal.yaml`.

---

## Stable Plugins (v1.0)

| Plugin | Type | Description | Docs |
|--------|------|-------------|------|
| `@forgeportal/plugin-kubernetes` | Fullstack | Kubernetes workloads, pod logs, restart, scale | [→ Docs](/docs/plugins/kubernetes) |
| `@forgeportal/plugin-argocd` | Fullstack | ArgoCD sync status, history, sync & rollback actions | [→ Docs](/docs/plugins/argocd) |
| `@forgeportal/plugin-github-insights` | Fullstack | PRs, commits, contributors, CI workflow runs | [→ Docs](/docs/plugins/github-insights) |
| `@forgeportal/plugin-grafana` | UI only | Embed Grafana dashboards via iframe | [→ Docs](/docs/plugins/grafana) |

---

## Upcoming Plugins (In Development)

| Plugin | Type | Description |
|--------|------|-------------|
| `@forgeportal/plugin-pagerduty` | Fullstack | On-call schedules, open incidents, trigger incident |
| `@forgeportal/plugin-datadog` | Fullstack | APM metrics, monitors, SLOs |
| `@forgeportal/plugin-flux` | Fullstack | Flux CD GitOps sync status and history |
| `@forgeportal/plugin-sonarcloud` | Fullstack | Code quality, coverage, and code smells |
| `@forgeportal/plugin-snyk` | Fullstack | Vulnerability scanning for dependencies and containers |
| `@forgeportal/plugin-github-actions` | Fullstack | Workflow runs, re-run, manual dispatch |
| `@forgeportal/plugin-jira` | Fullstack | Issues, sprint progress, linked tickets |
| `@forgeportal/plugin-openapi-spec-viewer` | UI only | Interactive OpenAPI/Swagger viewer |
| `@forgeportal/plugin-vault` | Backend only | HashiCorp Vault secret injection for templates |
| `@forgeportal/plugin-dora-metrics` | Fullstack | Deployment frequency, lead time, MTTR, change failure rate |
| `@forgeportal/plugin-cost-insights` | Fullstack | Cloud cost estimates per service |
| `@forgeportal/plugin-aws` | Fullstack | ECS tasks, Lambda functions, RDS instances, ALB targets |
| `@forgeportal/plugin-slack-notify` | Backend only | Template and scorecard Slack notifications |
| `@forgeportal/plugin-renovate` | Fullstack | Dependency update status from Renovate Bot |
| `@forgeportal/plugin-prometheus` | UI only | Inline PromQL charts without leaving the catalog |
| `@forgeportal/plugin-statuspage` | Fullstack | Statuspage.io component status and active incidents |

Want a plugin not listed here? [Open a GitHub Discussion](https://github.com/forgeportal/forgeportal/discussions) or contribute via the [Plugin Developer Guide](/docs/plugin-development/overview).

---

## Installing a Plugin

All plugins follow the same three-step installation process:

```bash
# 1. Add the package to forgeportal.yaml
#    pluginPackages:
#      packages:
#        - "@forgeportal/plugin-<name>"

# 2. Sync dependencies (installs the npm package and updates lockfile)
pnpm forge:sync

# 3. Restart the API and UI containers
docker compose restart api ui
```

Then annotate your entities to activate the plugin on specific services:

```yaml
# entity.yaml
metadata:
  annotations:
    forgeportal.dev/<plugin-key>: "<value>"
```

Refer to each plugin's documentation page for the specific annotations required.

---

## Plugin Types

| Type | Backend routes | UI tabs/cards | npm package |
|------|---------------|---------------|-------------|
| **Fullstack** | ✅ | ✅ | Single package with `/ui` and `/` exports |
| **UI only** | ❌ | ✅ | Package with `/ui` export only |
| **Backend only** | ✅ | ❌ | Package with `/` export only |

---

## Build Your Own Plugin

ForgePortal's plugin SDK makes it easy to create custom integrations.

```bash
npx @forgeportal/cli create-plugin my-plugin
```

→ See the [Plugin Developer Guide](/docs/plugin-development/overview) for a complete walkthrough.
