---
title: Provision a Database
sidebar_position: 4
---

# Provision a Database

The **create-database** template provisions a PostgreSQL or MySQL database with a single wizard, across four destinations: local Docker, Docker Compose, Kubernetes (via Bitnami Helm), or AWS RDS (via Terraform). The database is registered in the ForgePortal catalog as a `kind: resource` entity, making it discoverable and referenceable by services.

## Prerequisites

- ForgePortal is running — see [Quick Start](/docs/getting-started/quick-start-docker)
- Your role is `developer` or higher — see [Role Guide](/docs/user-guide/role-guide)
- For **Kubernetes**: a cluster is reachable and `kubectl` is configured on the machine that will apply the Helm values
- For **AWS RDS**: an infra repo is configured with Terraform backend, and the GitHub token has `repo` write scope

---

## Step 1 — Open the Template

1. Click **Templates** in the navigation.
2. Find the **Create Database** card.
3. Click **"Create →"**.

---

## Step 2 — Fill the Wizard

### Common fields (all destinations)

| Field | Example | Notes |
|-------|---------|-------|
| **Database name** | `orders-db` | Becomes the entity name and the Helm release / Docker container name |
| **Engine** | `postgresql` | `postgresql` or `mysql` |
| **Destination** | `kubernetes` | See options below |
| **Owner** | `team-platform` | Registered in the catalog |

### Destination: `local-docker`

No extra fields needed. Generates a `docker-run.sh` script.

### Destination: `docker-compose`

| Field | Example |
|-------|---------|
| **Service name in Compose** | `orders-db` |
| **Port** | `5432` |
| **Data volume name** | `orders-db-data` |

Generates a `docker-compose.yml` service block to paste into your existing Compose file.

### Destination: `kubernetes`

| Field | Example |
|-------|---------|
| **Namespace** | `databases` |
| **Storage size** | `10Gi` |
| **Replica count** | `1` (dev) / `2` (prod) |
| **Infra repo** | `my-org/infra` |

Generates a `helm-values.yaml` for the [Bitnami PostgreSQL](https://github.com/bitnami/charts/tree/main/bitnami/postgresql) chart and opens a PR.

### Destination: `aws-rds`

| Field | Example |
|-------|---------|
| **AWS Region** | `us-east-1` |
| **Instance class** | `db.t3.medium` |
| **Storage (GB)** | `20` |
| **Multi-AZ** | `false` (dev) / `true` (prod) |
| **Infra repo** | `my-org/infra` |

Generates a Terraform module under `infra/databases/orders-db/` and opens a PR.

---

## Step 3 — Watch the Run

| Step | What happens |
|------|-------------|
| `template.render` | Files are generated from the Handlebars templates |
| `scm.openPullRequest` | PR opened in your infra repo (Kubernetes / AWS RDS destinations) |
| `catalog.registerEntity` | `resource:orders-db` entity registered in the catalog |

:::tip Local Docker and Docker Compose
For these destinations, no PR is opened. The generated script / YAML snippet is shown as a **step output** in the run page — copy it directly from there.
:::

---

## Step 4 — Apply the Configuration

### Local Docker

Copy the `docker run` command from the run outputs:

```bash
docker run -d \
  --name orders-db \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=orders \
  -p 5432:5432 \
  -v orders-db-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

### Docker Compose

Paste the generated service block into your `docker-compose.yml`:

```yaml
services:
  orders-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: orders
    ports:
      - "5432:5432"
    volumes:
      - orders-db-data:/var/lib/postgresql/data

volumes:
  orders-db-data:
```

### Kubernetes (Helm)

Merge the PR opened in your infra repo, then install:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm upgrade --install orders-db bitnami/postgresql \
  --namespace databases --create-namespace \
  -f infra/databases/orders-db/helm-values.yaml
```

Or if you use **ArgoCD** or **Flux**, the PR merge triggers automatic sync — no manual command needed.

### AWS RDS (Terraform)

Merge the PR, then apply:

```bash
cd infra/databases/orders-db
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

---

## Step 5 — See the Entity in the Catalog

1. Go to **Catalog** → search for `orders-db`.
2. The entity is of `kind: resource` — you see its description, owner, and lifecycle.
3. Reference it from a service by adding to that service's `entity.yaml`:

```yaml
spec:
  dependsOn:
    - resource:orders-db
```

After the next catalog scan, the relation appears in both entity detail pages.

---

## Next Steps

- **Provision a cache** — Run the [Create Cache](/docs/guides/create-cache) template for Redis
- **Provision a queue** — Run the Create Message Queue template for RabbitMQ/Kafka
- **Full SRE flow** — See [Golden Paths Overview](/docs/guides/golden-path-overview)
