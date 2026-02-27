---
title: Create a Monitoring Stack
sidebar_position: 6
---

# Create a Monitoring Stack

The **create-monitoring-stack** template deploys a full observability stack — Prometheus, Grafana, and Alertmanager — in a Kubernetes cluster or via Docker Compose. The stack is registered as a `kind: resource` entity in the catalog, and the [Grafana Plugin](/docs/plugins/grafana) can embed its dashboards directly in entity pages.

## Prerequisites

- ForgePortal is running — see [Quick Start](/docs/getting-started/quick-start-docker)
- Your role is `developer` or higher
- For **Kubernetes**: cluster is running and accessible; Helm 3 is installed
- For **Docker Compose**: Docker is installed locally

---

## Step 1 — Open the Template

1. Click **Templates** in the navigation.
2. Find the **Create Monitoring Stack** card.
3. Click **"Create →"**.

---

## Step 2 — Fill the Wizard

| Field | Example | Notes |
|-------|---------|-------|
| **Stack name** | `prod-monitoring` | Becomes the Helm release name / compose service prefix |
| **Destination** | `kubernetes` | `kubernetes` or `docker-compose` |
| **Namespace** | `monitoring` | Kubernetes only; created if it doesn't exist |
| **Grafana admin password** | `changeme-in-prod` | Initial Grafana password — change after first login |
| **Prometheus retention** | `15d` | How long metrics are kept |
| **Owner** | `team-sre` | Registered in the catalog |

---

## Step 3 — Watch the Run

| Step | What happens |
|------|-------------|
| `template.render` | Helm values or Compose file generated |
| `scm.openPullRequest` | PR opened in infra repo (Kubernetes only) |
| `catalog.registerEntity` | `resource:prod-monitoring` registered in catalog |

For Docker Compose, the `docker-compose.monitoring.yml` is shown as a step output — copy it directly.

---

## Step 4 — Deploy the Stack

### Kubernetes

Merge the PR in your infra repo, then install using the [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) chart:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install prod-monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f infra/monitoring/prod-monitoring/helm-values.yaml
```

Verify:

```bash
kubectl get pods -n monitoring
# prometheus-prod-monitoring-...   1/1   Running
# grafana-prod-monitoring-...      1/1   Running
# alertmanager-prod-monitoring-... 1/1   Running
```

Access Grafana:

```bash
kubectl port-forward -n monitoring svc/prod-monitoring-grafana 3030:80
# Open http://localhost:3030 — login: admin / <your password>
```

### Docker Compose

Paste the generated block into your existing `docker-compose.yml` or run it standalone:

```bash
docker compose -f docker-compose.monitoring.yml up -d
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

---

## Step 5 — Connect the Grafana Plugin

Once Grafana is running, configure the Grafana plugin so dashboards appear on entity pages.

Add to your `forgeportal.yaml`:

```yaml
plugins:
  - name: grafana
    config:
      baseUrl: http://localhost:3030   # or your Grafana URL
      # orgId: 1   # optional, default 1
```

Then add the annotation to any entity's `entity.yaml` to show a dashboard panel:

```yaml
metadata:
  annotations:
    forgeportal.dev/grafana-dashboard-url: "http://localhost:3030/d/abc123/my-dashboard"
```

The **Grafana tab** appears automatically on that entity's detail page.

See [Grafana Plugin](/docs/plugins/grafana) for the full reference.

---

## Step 6 — See the Entity in the Catalog

Go to **Catalog** → search for `prod-monitoring`. The `kind: resource` entity shows the stack details.

Services can declare they send metrics to this stack:

```yaml
spec:
  dependsOn:
    - resource:prod-monitoring
```

---

## Pre-configured Dashboards

The generated Helm values include the following Grafana dashboards out of the box:

| Dashboard | ID | What it shows |
|-----------|----|--------------|
| Kubernetes / Compute Resources / Cluster | `315` | CPU, memory, pod count |
| Kubernetes / Networking | `12124` | Network I/O |
| Node Exporter Full | `1860` | Host CPU, disk, memory |
| NGINX Ingress | `9614` | Request rate, latency |

---

## Next Steps

- **Use the Grafana plugin** on your service entities — [Grafana Plugin](/docs/plugins/grafana)
- **Set up alerts** — edit the generated Alertmanager config in the infra repo
- **Full SRE flow** — [Golden Paths Overview](/docs/guides/golden-path-overview)
