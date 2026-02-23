# @forgeportal/plugin-sdk

The official SDK for building ForgePortal plugins.

## Installation

```bash
pnpm add @forgeportal/plugin-sdk
# For UI plugins also install peer deps:
pnpm add react @tanstack/react-query
```

## Plugin Types

| Type        | What it provides                                    |
|-------------|-----------------------------------------------------|
| `ui`        | Entity tabs, entity cards, top-level routes         |
| `backend`   | Fastify routes, action providers, catalog providers |
| `fullstack` | Both UI and backend capabilities                    |

## Quick Start — UI Plugin

```typescript
// src/index.ts
import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { MyEntityTab } from './MyEntityTab.js';

export function registerPlugin(sdk: ForgePluginSDK) {
  sdk.registerEntityTab({
    id:        'my-plugin-tab',
    title:     'My Plugin',
    component: MyEntityTab,
    appliesTo: { kinds: ['service'] },
  });
}
```

```typescript
// src/MyEntityTab.tsx
import { useEntity } from '@forgeportal/plugin-sdk/react';

export function MyEntityTab() {
  const { entity } = useEntity();
  return <div>Entity: {entity.name}</div>;
}
```

## Quick Start — Backend Plugin (Action Provider)

```typescript
// src/actions/myAction.ts
import type { ActionProvider } from '@forgeportal/plugin-sdk';

export const myAction: ActionProvider = {
  id:      'myplugin.doSomething',
  version: 'v1',
  schema: {
    input: {
      type: 'object',
      properties: { message: { type: 'string', title: 'Message' } },
      required: ['message'],
    },
  },
  async handler(ctx, input) {
    ctx.logger.info('Running action', { input });
    await ctx.log('info', `Processing: ${input['message']}`);
    return { status: 'success', outputs: { done: true } };
  },
};
```

## Quick Start — Fullstack Plugin (Catalog Provider)

```typescript
// src/index.ts
import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { myAction }         from './actions/myAction.js';
import { MyCatalogTab }     from './MyCatalogTab.js';
import { myCatalogProvider } from './catalog.js';

export function registerPlugin(sdk: ForgePluginSDK) {
  // Backend: action provider
  sdk.registerActionProvider(myAction);
  // Backend: catalog ingest provider
  sdk.registerCatalogProvider(myCatalogProvider);
  // UI: custom entity tab
  sdk.registerEntityTab({
    id:        'my-catalog-tab',
    title:     'My Catalog',
    component: MyCatalogTab,
  });
}
```

## React Hooks

| Hook              | Description                                                            |
|-------------------|------------------------------------------------------------------------|
| `useEntity()`     | Returns `{ entity }` — the current catalog entity. Use inside EntityTab/EntityCard. |
| `useConfig<T>(key)` | Returns plugin config value from `forgeportal.yaml`.               |
| `useApi<T>(path)` | TanStack Query wrapper for ForgePortal API calls.                      |

```typescript
import { useEntity, useConfig, useApi } from '@forgeportal/plugin-sdk/react';

function MyTab() {
  const { entity }   = useEntity();
  const apiUrl       = useConfig<string>('apiEndpoint');
  const { data }     = useApi<{ incidents: unknown[] }>(`/api/v1/my-plugin/${entity.id}/incidents`);
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

## Plugin Manifest (`forgeportal-plugin.json`)

```json
{
  "name": "@myorg/forge-plugin-my-plugin",
  "version": "1.0.0",
  "forgeportal": {
    "engineVersion": "^1.0.0",
    "type": "ui",
    "capabilities": {
      "ui": {
        "entityTabs": ["my-plugin-tab"]
      }
    },
    "config": {
      "apiEndpoint": {
        "type": "string",
        "description": "External service URL",
        "required": true
      }
    }
  }
}
```

## ActionContext Services

| Property           | Type                    | Description                                         |
|--------------------|-------------------------|-----------------------------------------------------|
| `config`           | `ActionConfigAccessor`  | Plugin config from `forgeportal.yaml`               |
| `logger`           | `ActionLogger`          | Structured logger (info/warn/error)                 |
| `scm`              | `ActionScmAccessor`     | SCM file reads (getFile, listFiles)                 |
| `db`               | `ActionDbAccessor`      | Read-only SQL query access                          |
| `acquireRepoLock`  | `(repoUrl) => Promise`  | Advisory lock to prevent concurrent SCM writes      |
| `log`              | `(level, msg) => Promise` | Persisted action run log line                     |

## Versioning

The SDK follows semantic versioning:

- **Patch** — bug fixes, no interface changes
- **Minor** — new capabilities (backward-compatible)
- **Major** — breaking contract changes

Plugins declare `engineVersion: "^1.0.0"` to stay compatible with any 1.x SDK release.

The current SDK version is exported as `SDK_VERSION`:

```typescript
import { SDK_VERSION } from '@forgeportal/plugin-sdk';
console.log(SDK_VERSION); // "1.0.0"
```
