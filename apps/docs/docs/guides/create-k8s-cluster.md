---
title: Provision a Kubernetes Cluster
sidebar_position: 5
---

# Provision a Kubernetes Cluster

The **create-k8s-cluster** template provisions a Kubernetes cluster via a wizard — locally using [kind](https://kind.sigs.k8s.io/) or [k3d](https://k3d.io/), or on a cloud provider (AWS EKS, GCP GKE, Azure AKS) via Terraform. The cluster is registered in the ForgePortal catalog as a `kind: resource` entity.

## Prerequisites

- ForgePortal is running — see [Quick Start](/docs/getting-started/quick-start-docker)
- Your role is `developer` or higher
- For **local clusters**: Docker is installed; `kind` or `k3d` CLI is installed on the machine where you will run `setup.sh`
- For **cloud clusters**: An infra repo exists with Terraform backend configured; cloud credentials are available (`AWS_PROFILE`, `GOOGLE_CREDENTIALS`, `ARM_*`)

---

## Step 1 — Open the Template

1. Click **Templates** in the navigation.
2. Find the **Create Kubernetes Cluster** card.
3. Click **"Create →"**.

---

## Step 2 — Fill the Wizard

### Common fields

| Field | Example | Notes |
|-------|---------|-------|
| **Cluster name** | `dev-cluster` | Used for the kind/k3d cluster name or Terraform resource name |
| **Destination** | `kind` | See options below |
| **Kubernetes version** | `1.29` | Used by kind/k3d config and Terraform provider |
| **Owner** | `team-platform` | Registered in the catalog |

### Destination: `kind` (local)

| Field | Default | Notes |
|-------|---------|-------|
| **Worker nodes** | `1` | Add more for testing multi-node scenarios |
| **API server port** | `6443` | Host port mapping for the API server |

### Destination: `k3d` (local)

| Field | Default | Notes |
|-------|---------|-------|
| **Agents (worker nodes)** | `1` | k3d agents count |
| **API server port** | `6443` | |
| **Load balancer port** | `8080` | Host port for the k3d load balancer |

### Destination: `eks` (AWS)

| Field | Example | Notes |
|-------|---------|-------|
| **AWS Region** | `us-east-1` | |
| **Node count** | `3` | Managed node group size |
| **Node instance type** | `t3.medium` | |
| **Infra repo** | `my-org/infra` | Terraform module pushed here |

### Destination: `gke` (Google Cloud)

| Field | Example |
|-------|---------|
| **GCP Project** | `my-gcp-project` |
| **Region** | `europe-west1` |
| **Node count** | `3` |
| **Machine type** | `e2-standard-2` |
| **Infra repo** | `my-org/infra` |

### Destination: `aks` (Azure)

| Field | Example |
|-------|---------|
| **Resource Group** | `rg-platform` |
| **Location** | `westeurope` |
| **Node count** | `3` |
| **VM size** | `Standard_D2s_v3` |
| **Infra repo** | `my-org/infra` |

---

## Step 3 — Watch the Run

| Step | What happens |
|------|-------------|
| `template.render` | Config files generated |
| `scm.openPullRequest` | PR opened in infra repo (cloud destinations only) |
| `catalog.registerEntity` | `resource:dev-cluster` registered in the catalog |

For local destinations (kind / k3d), a `setup.sh` script and a config YAML are shown as step outputs — no PR is opened.

---

## Step 4 — Create the Cluster

### kind (local)

Copy `setup.sh` from the run outputs and run it:

```bash
bash setup.sh
# or manually:
kind create cluster --name dev-cluster --config kind-config.yaml
```

The generated `kind-config.yaml` looks like:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: dev-cluster
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            node-labels: "ingress-ready=true"
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
      - containerPort: 443
        hostPort: 443
  - role: worker
```

Verify:

```bash
kubectl cluster-info --context kind-dev-cluster
kubectl get nodes
```

### k3d (local)

```bash
bash setup.sh
# or manually:
k3d cluster create dev-cluster --config k3d-config.yaml
```

Verify:

```bash
kubectl cluster-info
kubectl get nodes
```

### EKS (AWS)

Merge the PR in your infra repo, then:

```bash
cd infra/clusters/dev-cluster
terraform init
terraform plan -out=tfplan
terraform apply tfplan

# Update your kubeconfig
aws eks update-kubeconfig --name dev-cluster --region us-east-1
kubectl get nodes
```

### GKE (Google Cloud)

```bash
cd infra/clusters/dev-cluster
terraform init && terraform apply -auto-approve

gcloud container clusters get-credentials dev-cluster --region europe-west1
kubectl get nodes
```

### AKS (Azure)

```bash
cd infra/clusters/dev-cluster
terraform init && terraform apply -auto-approve

az aks get-credentials --resource-group rg-platform --name dev-cluster
kubectl get nodes
```

---

## Step 5 — Deploy the Monitoring Stack (Recommended)

Once your cluster is running, use the **create-monitoring-stack** template to deploy Prometheus + Grafana in minutes. This gives you instant visibility into cluster and workload metrics.

See [Create Monitoring Stack](/docs/guides/create-monitoring-stack).

---

## Step 6 — See the Entity in the Catalog

Go to **Catalog** → search for `dev-cluster`. The `kind: resource` entity shows:
- Owner and lifecycle
- `spec.type: kubernetes-cluster`
- Annotations added by the Kubernetes plugin (if configured)

Services can declare they run on this cluster by adding to their `entity.yaml`:

```yaml
spec:
  dependsOn:
    - resource:dev-cluster
```

---

## Next Steps

- **Deploy a database** → [Provision a Database](/docs/guides/create-database)
- **Set up monitoring** → [Create Monitoring Stack](/docs/guides/create-monitoring-stack)
- **Install ArgoCD** → configure the [ArgoCD Plugin](/docs/plugins/argocd) and point it at this cluster
- **Full SRE flow** → [Golden Paths Overview](/docs/guides/golden-path-overview)
