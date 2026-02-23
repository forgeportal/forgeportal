---
title: Plugin Development Overview
sidebar_position: 1
---

# Plugin Development Overview

ForgePortal plugins extend the portal with custom UI (entity tabs, cards, routes), backend logic (actions, API routes, catalog providers), or both. This page introduces the three plugin types, when to use each, and how to scaffold a new plugin with the CLI.

## Three plugin types

| Type | What you add | Entry point | Runs in |
|------|----------------|-------------|---------|
| **ui** | Entity tabs, entity cards, top-level routes | `registerPlugin(sdk: ForgePluginSDK)` | Browser (React app) |
| **backend** | Action providers, Fastify routes, catalog providers | `registerBackendPlugin(sdk: ForgeBackendPluginSDK)` | API server (Node) |
| **fullstack** | Both UI and backend capabilities | Two entry points (UI + backend) | UI in browser, backend in API |

- **Entity tab** — A tab on the entity detail page (e.g. "PagerDuty", "Deployments"). You get the current entity and can call APIs or show custom content.
- **Entity card** — A card on the entity **Overview** tab. Same entity context as a tab.
- **Route** — A standalone page (e.g. `/pagerduty`) with its own URL and optional nav label.
- **Action provider** — A new action (e.g. `myplugin.notify@v1`) that templates and the action runner can invoke. You receive an `ActionContext` (config, logger, SCM, DB, locks).
- **Backend route** — Fastify routes under `/api/v1/plugins/{pluginId}/...`. Useful for serving data to your UI or webhooks.
- **Catalog provider** — An async iterator that yields entity drafts; the worker can ingest them into the catalog periodically.

:::tip When to use which type
- **UI only** — You only need to display something on the entity page or a custom page (e.g. link to external dashboard). Use **ui**.
- **Backend only** — You add actions or API routes, no custom React. Use **backend**.
- **UI + backend** — Your tab/card calls your own API (e.g. `/api/v1/plugins/myplugin/data`). Use **fullstack**.
:::

## Scaffold with the CLI

The fastest way to start is the **create-forge-plugin** CLI. It generates a package with the correct structure, manifest, and dependencies.

```bash
npx create-forge-plugin my-plugin --type ui
```

- **Interactive mode** — Run `npx create-forge-plugin` with no arguments; the CLI will prompt for name, type, and optional org.
- **Non-interactive** — `--type ui | backend | fullstack`, and optionally `--org @myorg`, `--out-dir ./my-plugin`, `--yes` to skip prompts.

After generation you get a directory (e.g. `forge-plugin-my-plugin/`) with:

| File / dir | Purpose |
|------------|--------|
| `forgeportal-plugin.json` | Manifest: name, version, type, capabilities, config schema. |
| `package.json` | Dependencies (e.g. `@forgeportal/plugin-sdk` as peer), build script. |
| `tsconfig.json` | TypeScript config. |
| `src/index.ts` | Entry: calls `sdk.registerEntityTab` (ui), or `sdk.registerActionProvider` / `registerBackendRoute` (backend), or both (fullstack). |
| `src/MyPluginTab.tsx` (ui) | Sample entity tab component. |
| `src/actions/` (backend) | Sample action provider. |
| `src/routes.ts` (backend) | Sample Fastify route registration. |

Run `pnpm install` and `pnpm build` inside the generated folder to verify it compiles. Next steps: add your logic, then [register the plugin](/docs/plugin-development/create-ui-plugin#register-in-the-portal) in the ForgePortal repo (UI and/or config).

## Plugin ID

The **plugin ID** is derived from the package name: strip scope and the `forge-plugin-` prefix. Examples:

- `@myorg/forge-plugin-pagerduty` → **pagerduty**
- `forge-plugin-slack-notify` → **slack-notify**

Use this ID in `forgeportal.yaml` under `plugins.<id>` and in the UI registration (`registerPluginById('pagerduty', registerPagerDuty)`). It must match between API and UI so that config and capabilities line up.

## Next steps

- [Create a UI plugin](/docs/plugin-development/create-ui-plugin) — entity tab from scratch to visible in the portal.
- [Create a backend plugin](/docs/plugin-development/create-backend-plugin) — action provider and Fastify routes.
- [Create a fullstack plugin](/docs/plugin-development/create-fullstack-plugin) — UI card that fetches from your backend route.
- [SDK Reference](/docs/plugin-development/sdk-reference) — all types and hooks.
- [Plugin Manifest Reference](/docs/plugin-development/plugin-manifest) — every field of `forgeportal-plugin.json`.
