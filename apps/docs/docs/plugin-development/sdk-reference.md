---
title: SDK Reference
sidebar_position: 5
---

# SDK Reference

This page lists the public exports of **@forgeportal/plugin-sdk** and **@forgeportal/plugin-sdk/react**: types, interfaces, hooks, and the main SDK objects. Use it as a quick reference while writing plugins.

## Package entry points

- **`@forgeportal/plugin-sdk`** — Types, `PluginRegistry`, `BackendPluginRegistry`, `SDK_VERSION`, and backend types.
- **`@forgeportal/plugin-sdk/react`** — React context providers, hooks `useEntity`, `useConfig`, `useApi`.

---

## Types (main package)

### Entity and drafts

| Type | Description |
|------|-------------|
| `Entity` | Subset of a catalog entity: `id`, `kind`, `namespace`, `name`, `title?`, `description?`, `tags?`, `links?`, `owner_ref?`, `lifecycle?`, `spec?`. |
| `EntityDraft` | Used by catalog providers: same as Entity but without `id`; may include `relations?`, `sources?`. |

### UI capabilities

| Type | Description |
|------|-------------|
| `EntityTabAppliesTo` | `{ kinds?: string[]; lifecycle?: string[] }`. Optional filter for which entities show the tab. |
| `EntityTab` | `id`, `title`, `component` (React component receiving `entity`), `appliesTo?`. |
| `EntityCard` | `id`, `title`, `component` (React component receiving `entity`), `appliesTo?.kinds?`. |
| `Route` | `path`, `component`, `navLabel?`, `icon?`. |

### Action provider and context

| Type | Description |
|------|-------------|
| `JsonSchema` | Minimal JSON Schema: `type`, `title?`, `description?`, `properties?`, `required?`, `items?`, `enum?`, `default?`, `x-secret?`. |
| `JsonSchemaType` | `'string' | 'number' | 'boolean' | 'object' | 'array'`. |
| `ActionResult` | `status: 'success' | 'failed'`, `outputs`, `links?`, `warnings?`, `error?`. |
| `ActionLogger` | `info`, `warn`, `error` (message + optional meta). |
| `ActionScmAccessor` | `getFile(repoUrl, path, ref?)`, `listFiles(repoUrl, prefix?)`. |
| `ActionDbAccessor` | `query(sql, params?)` (read-only, returns array of rows). |
| `ActionConfigAccessor` | `get(key)` returns `T | undefined`. |
| `ActionContext` | `config`, `logger`, `scm`, `db`, `acquireRepoLock(repoUrl)`, `log(level, message)`. |
| `ActionProvider` | `id`, `version`, `schema: { input, output? }`, `handler(ctx, input)`. |

### Catalog provider

| Type | Description |
|------|-------------|
| `CatalogProviderContext` | `logger`, `config`. |
| `CatalogProvider` | `id`, `ingest(ctx): AsyncIterable<EntityDraft>`. |

### SDK interfaces

| Type | Description |
|------|-------------|
| `ForgePluginSDK` | UI SDK: `registerEntityTab`, `registerEntityCard`, `registerRoute`, `registerActionProvider`, `registerCatalogProvider`. |
| `BackendRoute` | `path`, `handler: (fastify: FastifyInstance) => Promise<void>`. |
| `ForgeBackendPluginSDK` | `config`, `logger`, `registerActionProvider`, `registerCatalogProvider`, `registerBackendRoute`. |

### Manifest

| Type | Description |
|------|-------------|
| `PluginConfigFieldSchema` | `type`, `description?`, `required?`, `secret?`, `default?`. |
| `PluginCapabilities` | `ui?: { entityTabs?, entityCards?, routes? }`, `backend?: { routes?, actionProviders?, catalogProviders? }`. |
| `PluginManifest` | `name`, `version`, `forgeportal: { engineVersion, type, capabilities, permissions?, config? }`. |

---

## Exports (main package)

| Export | Description |
|--------|-------------|
| `PluginRegistry` | Class implementing `ForgePluginSDK`; in-memory registry for UI plugins. |
| `globalRegistry` | Singleton `PluginRegistry` used by the app shell. |
| `BackendPluginRegistry` | Class implementing `ForgeBackendPluginSDK`; used by the API plugin loader. |
| `SDK_VERSION` | String (e.g. `'1.0.0'`) for engine version checks. |

---

## React package (`@forgeportal/plugin-sdk/react`)

### Context providers (for app shell)

| Export | Description |
|--------|-------------|
| `EntityProvider` | Provides the current entity to children. Used by the entity detail page when rendering tabs/cards. |
| `EntityContext` | React context for the entity. |
| `PluginConfigProvider` | Provides plugin config (key → value) to children. |
| `PluginConfigContext` | React context for plugin config. |

### Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `useEntity()` | `(): { entity: Entity }` | Returns the current entity. Must be used inside a component rendered as an EntityTab or EntityCard (inside `EntityProvider`). Throws if used outside. |
| `useConfig` (generic) | `(key: string): T \| undefined` | Returns the plugin-scoped config value for `key`. Config comes from `forgeportal.yaml` under `plugins.[pluginId].config`. |
| `useApi` (generic) | `(path, options?)` → `UseQueryResult<T, Error>` | Fetches `path` (same origin, credentials included) and returns a TanStack Query result. Use for calling your plugin’s backend routes or other API endpoints. |

---

## Example: UI tab using hooks

```tsx
import { useEntity, useConfig, useApi } from '@forgeportal/plugin-sdk/react';

function MyTab() {
  const { entity } = useEntity();
  const apiUrl = useConfig<string>('apiEndpoint');
  const { data, isPending, error } = useApi<{ items: unknown[] }>(
    `/api/v1/plugins/myplugin/data/${entity.id}`,
  );
  if (isPending) return <span>Loading…</span>;
  if (error) return <span>Error: {error.message}</span>;
  return <pre>{JSON.stringify(data?.items ?? [], null, 2)}</pre>;
}
```

## Example: action handler using context

```typescript
import type { ActionProvider } from '@forgeportal/plugin-sdk';

const myAction: ActionProvider = {
  id:      'myplugin.doIt',
  version: 'v1',
  schema:  { input: { type: 'object', properties: {}, required: [] } },
  async handler(ctx, input) {
    const endpoint = ctx.config.get<string>('apiEndpoint');
    await ctx.log('info', 'Starting…');
    ctx.logger.info('Running', { endpoint });
    return { status: 'success', outputs: {} };
  },
};
```

For full manifest field reference, see [Plugin Manifest](/docs/plugin-development/plugin-manifest).
