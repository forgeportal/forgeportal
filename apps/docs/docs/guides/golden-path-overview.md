---
title: Golden Paths Overview
sidebar_position: 1
---

# Golden Paths Overview

A **golden path** is a pre-built, opinionated workflow that takes you from a blank slate to a fully functional, registered, and monitored resource — in minutes, not days.

ForgePortal ships three golden paths out of the box:

| Journey | What you get |
|---------|-------------|
| **[Create a Service](#journey-1--create-a-new-service)** | New Git repo · scaffolded code · CI · Dockerfile · entity registered in catalog |
| **[Provision Infrastructure](#journey-2--provision-infrastructure)** | Cloud or local resource · Terraform or Helm · entity registered as `kind: resource` |
| **[Enforce Quality](#journey-3--enforce-quality-with-scorecards)** | Automatic maturity evaluation · actionable fix PRs via scorecard rules |

These journeys compose: you create a service, provision a database for it, and then enforce it meets a Gold scorecard — all within ForgePortal.

---

## Journey 1 — Create a New Service

**Use case:** A developer needs a new Node.js (or Spring Boot / Go) microservice with everything wired up from day one.

### What happens, step by step

```
Developer → Templates → create-nodejs-service → fill form
    ↓
ForgePortal runs actions:
  1. scm.createRepo         → new repo on GitHub/GitLab
  2. scm.pushFiles          → scaffolds package.json, Dockerfile, CI, README
  3. scm.openPullRequest    → opens "chore: initial scaffold" PR
  4. catalog.registerEntity → entity.yaml committed, entity visible in catalog
    ↓
Developer → reviews PR → merges → service is live
```

### Walk-through

1. Go to **Templates** in the top navigation.
2. Click **"Create →"** on the **Node.js Service** card.
3. Fill the wizard:
   - **Service name** — e.g. `payment-service`
   - **Owner** — e.g. `team-platform`
   - **Description** — short sentence
   - **Lifecycle** — `experimental` (promote to `production` later)
   - **GitHub Org** — your target org
   - **Visibility** — `private` or `public`
4. Click **"Create Service"**.
5. Watch the run page — each step completes in sequence. Links to the new repo and PR appear.
6. Open the PR, review the scaffolded files, merge it.
7. Go to **Catalog** — your new service is already there, with its description, owner, and lifecycle.

### What is generated

| File | Purpose |
|------|---------|
| `package.json` | Node.js project with recommended scripts |
| `src/index.ts` | Minimal HTTP server (Fastify) |
| `Dockerfile` | Multi-stage production image |
| `.github/workflows/ci.yml` | Lint + test on every push/PR |
| `README.md` | Service documentation stub |
| `entity.yaml` | ForgePortal catalog entry |

:::tip Next step
Run the **Kubernetes** plugin on this service to see its pods, or the **GitHub Insights** plugin to see PR activity and code frequency.
:::

---

## Journey 2 — Provision Infrastructure

**Use case:** A developer or SRE needs a database, cache, message queue, or Kubernetes cluster — provisioned consistently, tracked in the catalog, and ready for other services to reference.

### Available infrastructure templates

| Template | Destinations | What it creates |
|----------|-------------|----------------|
| **create-database** | Local Docker · Docker Compose · Kubernetes (Bitnami Helm) · AWS RDS (Terraform) | PostgreSQL or MySQL database |
| **create-cache** | Local Docker · Docker Compose · Kubernetes (Bitnami Helm) · AWS ElastiCache (Terraform) | Redis cache |
| **create-message-queue** | Local Docker · Docker Compose · Kubernetes (Bitnami Helm) | RabbitMQ or Kafka |
| **create-k8s-cluster** | kind (local) · k3d (local) · EKS · GKE · AKS (Terraform) | Kubernetes cluster |
| **create-monitoring-stack** | Kubernetes (Helm) · Docker Compose | Prometheus + Grafana |
| **create-helm-chart** | Push to SCM repo | Helm chart for an existing service |

### Walk-through: create-database (Kubernetes destination)

1. Go to **Templates** → click **"Create →"** on the **Create Database** card.
2. Fill the wizard:
   - **Database name** — e.g. `orders-db`
   - **Engine** — `postgresql`
   - **Destination** — `kubernetes`
   - **Kubernetes namespace** — e.g. `databases`
   - **Storage size** — e.g. `10Gi`
   - **Owner** — `team-platform`
3. Click **"Create Database"**.
4. ForgePortal runs actions:
   - Generates a Helm values file for the Bitnami PostgreSQL chart
   - Opens a PR to your infra repo with the Helm values
   - Registers a `kind: resource` entity in the catalog (`resource:orders-db`)
5. Merge the PR → apply with `helm upgrade --install` (or your GitOps tool picks it up automatically).

:::tip GitOps integration
When using the ArgoCD or Flux plugin, your provisioning PR is picked up automatically — no manual `helm` command needed. See [ArgoCD Plugin](/docs/plugins/argocd) and [Flux Plugin](/docs/plugins/flux).
:::

### Walk-through: create-k8s-cluster (kind — local)

1. Go to **Templates** → click **"Create →"** on the **Create Kubernetes Cluster** card.
2. Fill the wizard:
   - **Cluster name** — e.g. `dev-cluster`
   - **Destination** — `kind (local)`
   - **Node count** — `1` (for a local dev cluster)
   - **Kubernetes version** — `1.29`
3. Click **"Create Cluster"**.
4. ForgePortal generates a `kind-config.yaml` and a `setup.sh` script, commits them to your infra repo, and registers a `kind: resource` entity.
5. Run `bash setup.sh` locally → your cluster is up in ~2 minutes.

---

## Journey 3 — Enforce Quality with Scorecards

**Use case:** An SRE team wants every service to meet a minimum quality standard (Bronze: owner + README; Gold: CI + Dockerfile + security scanning).

### How it works

1. **Scorecards are evaluated automatically** when an entity is discovered or updated.
2. Each rule maps to a **level** (Bronze → Silver → Gold). The entity achieves the highest level where **all** rules pass.
3. Failing rules that have a **fix action** show a **"Fix →"** button — clicking it opens a PR in your repo that resolves the issue automatically.

### Walk-through

1. Open any entity from the **Catalog**.
2. Click the **Scorecards** tab.
3. Read the current level (Bronze / Silver / Gold / pending).
4. For any failing rule with a fix button:
   - Click **"Fix →"**.
   - A template run starts — watch it complete.
   - A PR is opened in your repo with the fix (e.g. adds a `README.md`, or adds the CI workflow file).
5. Merge the PR → the next scorecard evaluation (triggered on push) moves the rule to **pass**.

:::tip Enforce at org level
Combine scorecards with the [GitHub Actions Plugin](/docs/plugins/github-actions) or your CI pipeline to **block merges** to main if the Bronze level is not achieved.
:::

---

## Putting It All Together

Here is the full SRE golden path for onboarding a new microservice end-to-end:

```
1. pnpm run create-service     → Node.js service · repo · CI · entity registered
2. pnpm run create-database    → PostgreSQL on Kubernetes · resource entity registered
3. View entity in Catalog      → See service + relations + annotations
4. Check Scorecards tab        → Bronze: pass  Silver: README missing
5. Click "Fix →" on README     → PR opened → merge
6. Check Scorecards tab again  → Silver: pass  Gold: security scan missing
7. Configure Snyk/SonarCloud   → re-evaluate → Gold: pass
8. View Kubernetes plugin      → pods running, CPU/mem usage
9. View GitHub Insights plugin → PRs, commit frequency, contributors
```

In under 30 minutes, a new service goes from nothing to **Gold scorecard · running in K8s · fully observable**.

---

## Next Steps

- [Create a Service →](/docs/guides/create-service)
- [Provision a Database →](/docs/guides/create-database)
- [Provision a Kubernetes Cluster →](/docs/guides/create-k8s-cluster)
- [Available Templates Reference →](/docs/guides/available-templates)
- [Scorecards & Fix Actions →](/docs/user-guide/scorecards-and-fixes)
