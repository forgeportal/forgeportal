---
title: Kubernetes / Helm
sidebar_position: 2
---

# Kubernetes / Helm

ForgePortal provides a **Helm chart** for deploying the API, worker, UI, optional in-cluster Postgres, CronJob (repo scan), and Ingress. This page covers install, main `values.yaml` keys, external database, Ingress with TLS (e.g. cert-manager), scaling, and Prometheus annotations.

---

## Install

From the repository root:

```bash
helm install forgeportal ./deployments/helm --namespace forgeportal --create-namespace
```

With a custom values file:

```bash
helm install forgeportal ./deployments/helm -f my-values.yaml --namespace forgeportal --create-namespace
```

Upgrade:

```bash
helm upgrade forgeportal ./deployments/helm -f my-values.yaml --namespace forgeportal
```

---

## Reference: main keys in `values.yaml`

| Section | Key | Description |
|--------|-----|-------------|
| **Global** | `nameOverride` / `fullnameOverride` | Override release or full resource names. |
| **Images** | `image.registry`, `image.repository`, `image.tag` | Image for API/Worker/UI (same image by default). `tag` defaults to Chart `appVersion`. |
| **API** | `api.replicaCount` | Number of API replicas (default `1`). |
| | `api.resources` | CPU/memory limits and requests. |
| | `api.env` / `api.envFrom` | Extra env vars or ConfigMap/Secret refs. |
| | `api.livenessProbe` / `api.readinessProbe` | Probe for `/livez` on port 4000. |
| **Worker** | `worker.replicaCount`, `worker.resources`, `worker.env`, `worker.envFrom` | Worker deployment. |
| **UI** | `ui.replicaCount`, `ui.resources`, `ui.env`, `ui.envFrom` | UI deployment. |
| **Postgres** | `postgres.enabled` | If `true`, deploy in-cluster Postgres (default). Set `false` when using external DB. |
| | `postgres.auth` | `username`, `database`, `existingSecret` (password), or `password` (dev). |
| | `postgres.persistence` | `enabled`, `size`, `storageClass`. |
| **External DB** | `externalDatabase.enabled` | Set `true` to use external PostgreSQL. |
| | `externalDatabase.host`, `port`, `database`, `username` | Connection parameters. |
| | `externalDatabase.existingSecret` | Secret name for DB password (key e.g. `db-password`). |
| **Ingress** | `ingress.enabled` | Enable Ingress. |
| | `ingress.className` | Ingress class (e.g. `nginx`). |
| | `ingress.annotations` | Annotations (e.g. cert-manager, rate limit). |
| | `ingress.hosts` | Hosts and paths (UI on `/`, API on `/api`). |
| | `ingress.tls` | TLS secret and hosts. |
| **CronJob** | `cronjob.repoScan.enabled`, `cronjob.repoScan.schedule` | Repo scan job (default hourly). |
| **Secrets** | `secrets.createDefaultSecret` | If `true`, create a generic Secret (dev only). |
| | `secrets.existingSecret` | Name of existing Secret for OIDC, encryption, session, SCM (keys: `oidc-client-secret`, `encryption-key`, `session-secret`, etc.). |

---

## External database (RDS, Cloud SQL, etc.)

Use the provided example values:

```bash
helm install forgeportal ./deployments/helm -f deployments/helm/values-external-db.yaml --namespace forgeportal --create-namespace
```

Create a Secret with the DB password:

```bash
kubectl create secret generic forgeportal-db-credentials --from-literal=db-password='<password>' -n forgeportal
```

In `values-external-db.yaml` (or your override):

```yaml
postgres:
  enabled: false

externalDatabase:
  enabled: true
  host: "my-postgres.xxxx.us-east-1.rds.amazonaws.com"   # or Cloud SQL / any host
  port: 5432
  database: forgeportal
  username: forge
  existingSecret: "forgeportal-db-credentials"
```

Ensure the DB is reachable from the cluster (security groups, VPC, or public access with TLS if required).

---

## Ingress and TLS (cert-manager)

Enable Ingress and TLS; use **cert-manager** to issue certificates automatically.

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    # Optional: nginx.ingress.kubernetes.io/proxy-body-size: "10m"
  hosts:
    - host: forgeportal.example.com
      paths:
        - path: /
          pathType: Prefix
          service: ui
          port: 3000
        - path: /api
          pathType: Prefix
          service: api
          port: 4000
  tls:
    - secretName: forgeportal-tls
      hosts: [forgeportal.example.com]
```

cert-manager will create the Secret `forgeportal-tls` when a Certificate resource is present (many Ingress controllers create it automatically when the annotation is set).

---

## Scaling

- **API**: Increase `api.replicaCount` (e.g. `2` or `3`) for high availability. Use a single Postgres and ensure session affinity or stateless design (session in cookie or external store).
- **Worker**: Increase `worker.replicaCount` to process more jobs in parallel. The worker consumes from the same queue (e.g. Postgres-based); multiple replicas are safe.
- **UI**: Increase `ui.replicaCount` for redundancy; UI is stateless.

Example:

```yaml
api:
  replicaCount: 2
worker:
  replicaCount: 2
```

---

## Prometheus annotations

To scrape the API (and worker if they expose metrics), add standard Prometheus annotations to the pod template. The chart does not add them by default; you can set them via `api.env` or by patching. Example for the API deployment (if your Prometheus uses pod annotations):

```yaml
api:
  # If the chart supports podAnnotations:
  # podAnnotations:
  #   prometheus.io/scrape: "true"
  #   prometheus.io/port: "4000"
  #   prometheus.io/path: "/metrics"
```

If the chart exposes these in `deployment-api.yaml` under `template.metadata.annotations`, set `api.podAnnotations` in values. Otherwise, add the annotations in a custom values file or post-render. The API exposes Prometheus metrics on `/metrics` when implemented (see story 6-5).

---

## Summary

| Task | Command / config |
|------|------------------|
| Install | `helm install forgeportal ./deployments/helm -n forgeportal --create-namespace` |
| External DB | `-f deployments/helm/values-external-db.yaml` + Secret with `db-password` |
| Ingress + TLS | `ingress.enabled: true`, `ingress.tls`, cert-manager annotation |
| Scale API/Worker | `api.replicaCount`, `worker.replicaCount` |
| Secrets | `secrets.existingSecret` with keys: `oidc-client-secret`, `encryption-key`, `session-secret`, etc. |

For full options, see `deployments/helm/values.yaml` and `deployments/helm/values-external-db.yaml`.
