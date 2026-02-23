---
title: Create a Fullstack Plugin
sidebar_position: 4
---

# Create a Fullstack Plugin

A **fullstack** plugin combines UI and backend: for example, an **entity card** that fetches data from a **backend route** you register. This tutorial walks you through scaffolding a fullstack plugin, implementing a card and a route, then wiring config and registration.

## 1. Scaffold the plugin

```bash
npx create-forge-plugin my-fullstack --type fullstack
cd forge-plugin-my-fullstack
pnpm install
pnpm build
```

The generated layout typically has `src/ui/` (tab or card + UI entry) and `src/backend/` (action and/or routes + backend entry). Adjust paths if your CLI uses a different structure; the ideas below still apply.

## 2. Backend: expose a data route

Register a route that returns JSON for the UI. The route will be mounted at `/api/v1/plugins/my-fullstack/...`. Example:

**`src/backend/routes.ts`**:

```typescript
import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { entityId: string } }>('/data/:entityId', async (request, reply) => {
    const { entityId } = request.params;
    // In production you might look up the entity, call an external API, etc.
    return reply.send({
      entityId,
      items: [],
      updatedAt: new Date().toISOString(),
    });
  });
}
```

**`src/backend/index.ts`** (backend entry for fullstack):

```typescript
import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import { registerRoutes } from './routes.js';

export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  sdk.registerBackendRoute({
    path:    '/',
    handler: registerRoutes,
  });
}
```

The API loader will load the backend entry when the package is listed in `pluginPackages.packages` and `type` is `fullstack` (or `backend`). Backend and UI can live in the same package with two entry points (e.g. `main` for UI, `forgeportal.backend` or a convention for backend).

## 3. UI: entity card that fetches from the backend

The entity card receives the current entity and can call your plugin route using the same origin and credentials. Use **useApi** from the SDK to fetch data.

**`src/ui/MyFullstackCard.tsx`** (or `src/MyFullstackCard.tsx` depending on scaffold):

```tsx
import { useEntity, useApi, useConfig } from '@forgeportal/plugin-sdk/react';

interface DataResponse {
  entityId: string;
  items: unknown[];
  updatedAt: string;
}

export function MyFullstackCard() {
  const { entity } = useEntity();
  const pluginId = 'my-fullstack'; // must match derivePluginId(packageName)
  const { data, isPending, error } = useApi<DataResponse>(
    `/api/v1/plugins/${pluginId}/data/${entity.id}`,
  );
  const title = useConfig<string>('cardTitle') ?? 'Plugin data';

  if (isPending) return <div className="text-sm text-gray-500">Loading…</div>;
  if (error) return <div className="text-sm text-red-600">{error.message}</div>;
  if (!data) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <p className="mt-1 text-xs text-gray-500">
        Entity: {data.entityId} · Updated {data.updatedAt}
      </p>
      <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs">
        {JSON.stringify(data.items, null, 2)}
      </pre>
    </div>
  );
}
```

**`src/ui/index.ts`** (UI entry — or `src/index.ts` if single entry):

```typescript
import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { MyFullstackCard } from './MyFullstackCard.js';

export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityCard({
    id:        'my-fullstack-card',
    title:     'Plugin Data',
    component: MyFullstackCard,
    appliesTo: { kinds: ['service', 'component'] },
  });
}
```

Fullstack packages often expose two exports: one for the UI (e.g. `registerPlugin`) and one for the backend (`registerBackendPlugin`). The API loads the backend export; the UI app imports and calls the UI export. Check your scaffold’s `package.json` exports and the API loader’s expectation for backend entry.

## 4. Manifest

**`forgeportal-plugin.json`**:

```json
{
  "name": "forge-plugin-my-fullstack",
  "version": "1.0.0",
  "forgeportal": {
    "engineVersion": "^1.0.0",
    "type": "fullstack",
    "capabilities": {
      "ui": {
        "entityCards": ["my-fullstack-card"]
      },
      "backend": {
        "routes": ["/"]
      }
    },
    "config": {
      "cardTitle": {
        "type": "string",
        "description": "Title of the entity card",
        "default": "Plugin data"
      }
    }
  }
}
```

## 5. Register in the portal

- **API** — Add the package to `forgeportal.yaml` under `pluginPackages.packages` and optional `plugins.my-fullstack.config`. Restart the API so the backend route is mounted.
- **UI** — In `apps/ui`, add the plugin dependency and in `apps/ui/src/plugins/index.ts` call `registerPluginById('my-fullstack', registerPlugin)`. Rebuild the UI.

Open an entity of kind `service` or `component`; the **Plugin Data** card should appear on the Overview tab and load data from `/api/v1/plugins/my-fullstack/data/:entityId`.

:::tip
`useApi` uses the browser’s credentials (cookies/session). The API route is protected by the same auth guard as other API routes, so only authenticated users will get data. For public or different auth, you would need a different strategy (e.g. API key in header from config).
:::

## Summary

| Step | Action |
|------|--------|
| 1 | Scaffold with `npx create-forge-plugin my-fullstack --type fullstack` |
| 2 | Backend: register a route (e.g. `/data/:entityId`) in `registerBackendPlugin` |
| 3 | UI: implement an entity card that calls `useApi('/api/v1/plugins/<id>/...')` and `useEntity()` |
| 4 | Manifest: `type: "fullstack"`, declare entity card and backend route in capabilities |
| 5 | Add package to API config and to UI `plugins/index.ts`; set config; restart API and rebuild UI |

You now have a fullstack plugin with compilable code: a card that displays data from your backend route.
