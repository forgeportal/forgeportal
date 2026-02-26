---
title: Grafana Plugin
sidebar_position: 4
---

# @forgeportal/plugin-grafana

The **Grafana plugin** is a **UI-only** plugin that embeds Grafana dashboards directly into entity pages via an `<iframe>`. It requires no backend — the browser connects to Grafana directly.

:::info UI-only plugin
This plugin registers **no backend routes** and performs **no proxying**. The iframe points directly at your Grafana instance URL. ForgePortal only stores the annotation value.
:::

## Features

| Feature | Description |
|---------|-------------|
| **Dashboard embed** | Full Grafana dashboard rendered in a 16:9 iframe on the entity page |
| **Time range controls** | Switch between 1h / 6h / 24h / 7d with a single click |
| **Variable injection** | Automatically injects an entity-scoped Grafana variable (e.g. `var-service=payments-api`) |
| **Multi-dashboard** | Comma-separated URLs show multiple dashboard tabs |
| **Open in Grafana** | One-click link to open the dashboard in a new tab |
| **Config-free** | No `forgeportal.yaml` plugin config required — just add the annotation |

---

## Prerequisites

- A Grafana instance **accessible from the user's browser** (not the ForgePortal API container)
- Grafana configured to **allow embedding** (see [Grafana configuration](#grafana-configuration) below)
- Dashboard URLs must be reachable without re-authentication — use anonymous auth or signed embed URLs for public dashboards

---

## Installation

### 1. Add the plugin package

```yaml
# forgeportal.yaml
pluginPackages:
  packages:
    - "@forgeportal/plugin-grafana"
```

### 2. Sync dependencies

```bash
pnpm forge:sync
```

### 3. Configure (optional)

```yaml
plugins:
  grafana:
    enabled: true
    config:
      url: "https://grafana.example.com"   # optional — informational only
      defaultTimeRange: "now-6h"            # optional
```

The `url` field is **not used for embedding** — the plugin uses the full URL from the annotation. It is stored for informational purposes only.

---

## Grafana Configuration

For the iframe to load, Grafana must allow embedding. Edit `grafana.ini` (or the equivalent Helm values):

```ini
[security]
allow_embedding = true
```

For anonymous/public dashboards:

```ini
[auth.anonymous]
enabled = true
org_name = Main Org.
org_role = Viewer
```

:::caution Security
Enabling `allow_embedding = true` makes all dashboards embeddable by any website.
For production environments, consider using Grafana's [signed embed URLs](https://grafana.com/docs/grafana/latest/developers/http_api/dashboard/#get-dashboard-by-uid) or restricting access by origin via a reverse proxy.
:::

---

## Annotating entities

```yaml
apiVersion: forgeportal.dev/v1alpha1
kind: Service
metadata:
  name: payments-api
  annotations:
    # Required — full Grafana dashboard URL
    forgeportal.dev/grafana-dashboard-url: "https://grafana.example.com/d/abc123/payments-api-overview"

    # Optional — inject a Grafana template variable with the entity name
    # Result: ?var-service=payments-api
    forgeportal.dev/grafana-variable-name: "service"

    # Optional — multiple dashboards (comma-separated)
    # forgeportal.dev/grafana-dashboard-url: "https://grafana.example.com/d/abc/overview,https://grafana.example.com/d/def/logs"
spec:
  owner: team:platform
  lifecycle: production
```

### Supported annotations

| Annotation | Required | Description |
|-----------|----------|-------------|
| `forgeportal.dev/grafana-dashboard-url` | **Yes** | Full URL of the Grafana dashboard. Supports multiple URLs separated by commas or newlines. |
| `forgeportal.dev/grafana-variable-name` | No | Name of a Grafana template variable. The entity `name` is injected as the value (e.g. `var-service=payments-api`). |

---

## UI Walkthrough

When an entity has the `forgeportal.dev/grafana-dashboard-url` annotation, a **Grafana** tab appears on the entity detail page.

The tab contains:

1. **Dashboard tab strip** (if multiple URLs) — switch between named dashboards
2. **Time range selector** — `1h` / `6h` / `24h` / `7d` buttons that reload the iframe with updated `from`/`to` parameters
3. **"Open in Grafana" button** — opens the dashboard in a new tab without kiosk mode
4. **Embedded iframe** — the dashboard rendered in `kiosk` mode (no Grafana header/sidebar) at 16:9 aspect ratio
5. **Variable badge** — shows the injected variable when `grafana-variable-name` is set

If the annotation is missing, the tab shows a setup guide with a copy-paste YAML example.

---

## Troubleshooting

### Blank iframe / "Refused to display in a frame"

Grafana is sending `X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors 'none'`.

**Fix:** Set `allow_embedding = true` in `grafana.ini` and restart Grafana.

### Dashboard requires login (redirects to `/login`)

Grafana's session cookie is not present or anonymous access is disabled.

**Fix options:**
1. Enable anonymous access in `grafana.ini` (`[auth.anonymous]`)
2. Use Grafana's embed token / public dashboard feature
3. Set up SSO with the same identity provider as ForgePortal so users are already authenticated

### Dashboard loads but shows wrong data (variable not applied)

The `forgeportal.dev/grafana-variable-name` annotation value doesn't match the Grafana variable name.

**Fix:** In Grafana, open the dashboard settings → Variables, and copy the exact variable name. Use that value in the annotation.

### Multiple dashboards not showing tabs

Ensure the URLs are separated by a **comma** (`,`) or **newline** within the annotation value. Extra spaces around commas are trimmed automatically.
