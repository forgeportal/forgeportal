---
title: Available Templates
sidebar_position: 2
---

# Available Templates

This page lists all built-in templates shipped with ForgePortal. Each template is a multi-step wizard that scaffolds files, opens PRs, and registers entities in the catalog.

:::info
Templates are seeded automatically on first start. You can view and run them under **Templates** in the UI. Administrators can add custom templates — see [Writing Templates](/docs/configuration/writing-templates).
:::

---

## Service Templates

### `node-service` — Node.js Microservice

Creates a production-ready Node.js (TypeScript) microservice.

**Type:** `template` · **Kind output:** `service`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Service name (e.g. `payment-service`) |
| `description` | string | No | Short description of the service |
| `owner` | string | Yes | Team or user owning the service |
| `lifecycle` | enum | No | `experimental` \| `production` \| `deprecated` (default: `experimental`) |
| `githubOrg` | string | Yes | GitHub/GitLab org or user to create the repo in |
| `repoVisibility` | enum | No | `private` \| `public` (default: `private`) |

**Generated files:**
- `package.json` — Node.js project (TypeScript, Fastify)
- `src/index.ts` — Minimal Fastify HTTP server
- `Dockerfile` — Multi-stage production image
- `.github/workflows/ci.yml` — Lint + test CI pipeline
- `README.md` — Documentation stub
- `entity.yaml` — ForgePortal catalog registration

**Steps:**
1. Create repository in SCM
2. Push scaffolded files
3. Open initial PR (`chore: scaffold service`)
4. Register entity in catalog

---

### `spring-boot-service` — Spring Boot Service

Creates a Spring Boot (Java) microservice skeleton.

**Type:** `template` · **Kind output:** `service`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Service name |
| `groupId` | string | Yes | Maven group ID (e.g. `com.acme`) |
| `artifactId` | string | Yes | Maven artifact ID |
| `owner` | string | Yes | Team or user owning the service |
| `githubOrg` | string | Yes | Target GitHub/GitLab org |

**Generated files:** `pom.xml`, `src/main/java/…/Application.java`, `Dockerfile`, `.github/workflows/ci.yml`, `entity.yaml`

---

### `go-service` — Go Microservice

Creates a Go microservice with a standard project layout.

**Type:** `template` · **Kind output:** `service`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Service name |
| `module` | string | Yes | Go module path (e.g. `github.com/acme/my-service`) |
| `owner` | string | Yes | Team or user |
| `githubOrg` | string | Yes | Target org |

**Generated files:** `go.mod`, `main.go`, `Dockerfile`, `.github/workflows/ci.yml`, `entity.yaml`

---

## Infrastructure Templates

### `create-database` — Provision a Database

Creates a PostgreSQL or MySQL database with multi-destination support.

**Type:** `template` · **Kind output:** `resource`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Database name (e.g. `orders-db`) |
| `engine` | enum | Yes | `postgresql` \| `mysql` |
| `destination` | enum | Yes | `local-docker` \| `docker-compose` \| `kubernetes` \| `aws-rds` |
| `owner` | string | Yes | Owning team |
| `namespace` | string | Kubernetes only | Target Kubernetes namespace |
| `storageSize` | string | Kubernetes only | e.g. `10Gi` |
| `instanceClass` | string | AWS RDS only | e.g. `db.t3.medium` |
| `region` | string | AWS RDS only | AWS region |

**Generated output per destination:**

| Destination | Generated |
|-------------|-----------|
| `local-docker` | `docker-run.sh` with `docker run` command |
| `docker-compose` | `docker-compose.yml` service block |
| `kubernetes` | `helm-values.yaml` (Bitnami chart) + install instructions |
| `aws-rds` | Terraform module in `infra/databases/` + PR |

See full guide → [Provision a Database](/docs/guides/create-database)

---

### `create-cache` — Provision a Redis Cache

Creates a Redis cache with multi-destination support.

**Type:** `template` · **Kind output:** `resource`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Cache name (e.g. `session-cache`) |
| `destination` | enum | Yes | `local-docker` \| `docker-compose` \| `kubernetes` \| `aws-elasticache` |
| `owner` | string | Yes | Owning team |
| `namespace` | string | Kubernetes only | Target namespace |
| `nodeCount` | number | AWS only | Number of cache nodes |
| `region` | string | AWS only | AWS region |

---

### `create-message-queue` — Provision a Message Queue

Creates a RabbitMQ or Kafka instance.

**Type:** `template` · **Kind output:** `resource`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Queue name (e.g. `events-queue`) |
| `engine` | enum | Yes | `rabbitmq` \| `kafka` |
| `destination` | enum | Yes | `local-docker` \| `docker-compose` \| `kubernetes` |
| `owner` | string | Yes | Owning team |
| `namespace` | string | Kubernetes only | Target namespace |

---

### `create-k8s-cluster` — Provision a Kubernetes Cluster

Creates a Kubernetes cluster locally (kind, k3d) or on a cloud provider (EKS, GKE, AKS).

**Type:** `template` · **Kind output:** `resource`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Cluster name (e.g. `dev-cluster`) |
| `destination` | enum | Yes | `kind` \| `k3d` \| `eks` \| `gke` \| `aks` |
| `kubernetesVersion` | string | No | e.g. `1.29` |
| `nodeCount` | number | No | Worker nodes (default: `1` for local, `3` for cloud) |
| `region` | string | Cloud only | e.g. `us-east-1` (EKS), `europe-west1` (GKE) |
| `owner` | string | Yes | Owning team |

**Generated output per destination:**

| Destination | Generated |
|-------------|-----------|
| `kind` | `kind-config.yaml` + `setup.sh` |
| `k3d` | `k3d-config.yaml` + `setup.sh` |
| `eks` / `gke` / `aks` | Terraform module in `infra/clusters/` + PR |

See full guide → [Provision a Kubernetes Cluster](/docs/guides/create-k8s-cluster)

---

### `create-monitoring-stack` — Prometheus + Grafana

Deploys a full observability stack (Prometheus, Grafana, Alertmanager).

**Type:** `template` · **Kind output:** `resource`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Stack name (e.g. `prod-monitoring`) |
| `destination` | enum | Yes | `kubernetes` \| `docker-compose` |
| `namespace` | string | Kubernetes only | e.g. `monitoring` |
| `grafanaAdminPassword` | string | Yes | Initial Grafana admin password |
| `owner` | string | Yes | Owning team |

**Generated output:** `helm-values.yaml` (kube-prometheus-stack) or `docker-compose.monitoring.yml` + pre-configured dashboards

---

### `create-helm-chart` — Scaffold a Helm Chart

Generates a complete Helm chart for an existing service and pushes it to your infra repo.

**Type:** `template` · **Kind output:** `resource`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceName` | string | Yes | Name of the service to chart |
| `imageRepo` | string | Yes | Container image (e.g. `ghcr.io/acme/my-service`) |
| `port` | number | No | Container port (default: `3000`) |
| `ingressEnabled` | boolean | No | Generate ingress resource (default: `false`) |
| `owner` | string | Yes | Owning team |
| `infraRepo` | string | Yes | Infra repo to push the chart into |

---

## Internal Templates

The following templates are used internally by ForgePortal fix actions and are **not visible** in the Templates UI:

| Template | Used by |
|----------|---------|
| `forge-fix-file` | Scorecard fix actions — creates a PR to add a missing file |

---

## Writing Your Own Templates

See [Writing Templates](/docs/configuration/writing-templates) for the full reference on template parameters, action steps, Handlebars variables, and how to register a custom template via `forgeportal.yaml`.
