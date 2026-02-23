---
title: Plugin Manifest Reference
sidebar_position: 6
---

# Plugin Manifest Reference

Every ForgePortal plugin must ship a **manifest** file so the loader can validate the package, check SDK compatibility, and know what capabilities the plugin registers. By convention the file is named **`forgeportal-plugin.json`** and lives at the package root (or at a path configured in the loader). This page documents every top-level field and nested field under `forgeportal`.

## Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | npm package name. Examples: `@myorg/forge-plugin-pagerduty`, `forge-plugin-slack-notify`. Used to derive the **plugin ID** (e.g. `pagerduty`, `slack-notify`) for config and registration. |
| `version` | string | Yes | Package version (semver). Used for display and compatibility checks. |
| `forgeportal` | object | Yes | ForgePortal-specific metadata and capabilities. See below. |

---

## `forgeportal` object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `engineVersion` | string | Yes | Semver range against **@forgeportal/plugin-sdk** (e.g. `^1.0.0`). The loader checks that the installed SDK version satisfies this range. If not, the plugin may be skipped or marked with an error. |
| `type` | string | Yes | One of: `ui`, `backend`, `fullstack`. Determines which entry point the loader expects and where the plugin runs. |
| `capabilities` | object | Yes | Declares what the plugin registers (tabs, cards, routes, actions, catalog providers). See **Capabilities** below. |
| `permissions` | string[] | No | List of RBAC permissions required to use the plugin (e.g. `["action:run"]`). Used for enforcement or UI visibility. |
| `config` | object | No | Map of **config key** → **field schema**. Each value is a `PluginConfigFieldSchema` (type, description, required, secret, default). Used for validation and for resolving config/secret values at runtime. |

---

## Capabilities

`forgeportal.capabilities` has two optional keys: `ui` and `backend`. Omit a key if the plugin does not provide that side.

### `capabilities.ui`

| Field | Type | Description |
|-------|------|-------------|
| `entityTabs` | string[] | List of entity tab **ids** the plugin registers (e.g. `["pagerduty-tab"]`). Used for validation and display. |
| `entityCards` | string[] | List of entity card **ids** (e.g. `["deployments-card"]`). |
| `routes` | string[] | List of top-level route **paths** (e.g. `["/pagerduty"]`). |

### `capabilities.backend`

| Field | Type | Description |
|-------|------|-------------|
| `routes` | string[] | Path prefixes for backend routes (e.g. `["/"]` or `["/alerts"]`). Mounted under `/api/v1/plugins/{pluginId}/...`. |
| `actionProviders` | string[] | Full action ids with version (e.g. `["myplugin.echo@v1"]`). |
| `catalogProviders` | string[] | Catalog provider **ids** (e.g. `["pagerduty-catalog"]`). |

---

## Config field schema (`forgeportal.config`)

Each key in `config` is a config name (e.g. `apiEndpoint`, `apiToken`). The value must be an object with:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | One of: `string`, `number`, `boolean`. |
| `description` | string | No | Short description for docs or admin UI. |
| `required` | boolean | No | If true, validation may fail if the value is missing (depending on loader/validator). |
| `secret` | boolean | No | If true, the value must be supplied via environment variable (e.g. `FORGEPORTAL_PLUGIN_<ID>_<KEY>`). Never logged or returned by the config API. |
| `default` | string \| number \| boolean | No | Default value when not set. |

Example:

```json
"config": {
  "apiEndpoint": {
    "type": "string",
    "description": "Base URL of the external API",
    "required": true
  },
  "apiToken": {
    "type": "string",
    "description": "API key; set via FORGEPORTAL_PLUGIN_MYPLUGIN_APITOKEN",
    "secret": true
  },
  "enabled": {
    "type": "boolean",
    "default": true
  }
}
```

---

## Full example

```json
{
  "name": "@myorg/forge-plugin-pagerduty",
  "version": "1.0.0",
  "forgeportal": {
    "engineVersion": "^1.0.0",
    "type": "fullstack",
    "capabilities": {
      "ui": {
        "entityTabs": ["pagerduty-tab"],
        "entityCards": ["pagerduty-card"]
      },
      "backend": {
        "routes": ["/"],
        "actionProviders": ["pagerduty.createIncident@v1"]
      }
    },
    "permissions": ["action:run"],
    "config": {
      "apiEndpoint": {
        "type": "string",
        "description": "PagerDuty API base URL",
        "default": "https://api.pagerduty.com"
      },
      "apiToken": {
        "type": "string",
        "secret": true,
        "description": "Set via FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN"
      }
    }
  }
}
```

Plugin ID for this package: **pagerduty** (from `@myorg/forge-plugin-pagerduty`). Config in `forgeportal.yaml` would be under `plugins.pagerduty.config`, and the token env var would be `FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN`.

---

## Where the manifest is read

- **API** — When loading plugins from `pluginPackages.packages`, the loader resolves each package, looks for `forgeportal-plugin.json` (or the configured path), parses it, and validates `engineVersion`, `type`, and capabilities. Config and secrets are resolved via `resolvePluginConfig` and env.
- **UI** — The UI does not load plugins from config; it uses static registration in code. The manifest is still useful for documentation and for consistency with the API (same plugin ID, same config keys).

For a minimal plugin, you only need `name`, `version`, and `forgeportal` with `engineVersion`, `type`, and `capabilities` matching what your plugin actually registers.
