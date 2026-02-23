---
title: Create a Backend Plugin
sidebar_position: 3
---

# Create a Backend Plugin

This tutorial walks you through building a **backend** plugin that adds an **action provider** and a **Fastify route**. The action can be used in templates or triggered via the API; the route serves data under `/api/v1/plugins/{pluginId}/...`. Configuration and secrets are read from `forgeportal.yaml` and environment variables.

## 1. Scaffold the plugin

```bash
npx create-forge-plugin my-backend --type backend
cd forge-plugin-my-backend
pnpm install
pnpm build
```

You should get `forgeportal-plugin.json`, `src/index.ts`, an action file (e.g. `src/actions/myBackendAction.ts`), and a routes file (e.g. `src/routes.ts`).

## 2. Implement an action provider

An action provider implements the `ActionProvider` interface: `id`, `version`, `schema` (input/output JSON Schema), and `handler(ctx, input)`.

**`src/actions/echoAction.ts`** (compilable example):

```typescript
import type { ActionProvider } from '@forgeportal/plugin-sdk';

export const echoAction: ActionProvider = {
  id:      'mybackend.echo',
  version: 'v1',
  schema: {
    input: {
      type:       'object',
      properties: {
        message: { type: 'string', title: 'Message' },
      },
      required: ['message'],
    },
  },
  async handler(ctx, input) {
    const message = String(input['message'] ?? '');
    ctx.logger.info('Echo action running', { message });
    await ctx.log('info', `Echo: ${message}`);
    return {
      status:  'success',
      outputs: { echoed: message },
    };
  },
};
```

**ActionContext** (`ctx`) provides:

- `config` — plugin config from `forgeportal.yaml` (e.g. `ctx.config.get('apiEndpoint')`).
- `logger` — structured logger (info, warn, error).
- `scm` — `getFile(repoUrl, path, ref?)`, `listFiles(repoUrl, prefix?)`.
- `db` — read-only `query(sql, params?)`.
- `acquireRepoLock(repoUrl)` — advisory lock for SCM writes.
- `log(level, message)` — append a line to the action run log (visible in the UI).

For **secrets**, do not put values in `forgeportal.yaml`. Declare them in the manifest with `secret: true` and pass them via environment variables (e.g. `FORGEPORTAL_PLUGIN_MYBACKEND_APITOKEN`). The config accessor will resolve them. See [Plugin Manifest](/docs/plugin-development/plugin-manifest).

## 3. Register a Fastify route

Backend routes are mounted under `/api/v1/plugins/{pluginId}/{path}`. The Fastify instance passed to your handler is already scoped to that prefix; do not call `fastify.listen()`.

**`src/routes.ts`**:

```typescript
import type { FastifyInstance } from 'fastify';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', plugin: 'my-backend' });
  });

  fastify.get('/data', async (request, reply) => {
    // Auth is already applied by the API; request may have user/session.
    return reply.send({ data: [], timestamp: new Date().toISOString() });
  });
}
```

**`src/index.ts`** — register action and routes with the **backend** SDK:

```typescript
import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import { echoAction } from './actions/echoAction.js';
import { registerRoutes } from './routes.js';

export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  sdk.registerActionProvider(echoAction);
  sdk.registerBackendRoute({
    path:    '/',
    handler: registerRoutes,
  });
}
```

The backend loader expects **`registerBackendPlugin`** as the default or named export for backend/fullstack packages. The manifest must declare `type: "backend"` and list capabilities (e.g. `backend.actionProviders`, `backend.routes`).

## 4. Manifest and config

**`forgeportal-plugin.json`**:

```json
{
  "name": "forge-plugin-my-backend",
  "version": "1.0.0",
  "forgeportal": {
    "engineVersion": "^1.0.0",
    "type": "backend",
    "capabilities": {
      "backend": {
        "actionProviders": ["mybackend.echo@v1"],
        "routes": ["/"]
      }
    },
    "config": {
      "apiEndpoint": {
        "type": "string",
        "description": "Optional API base URL"
      },
      "apiToken": {
        "type": "string",
        "secret": true,
        "description": "Set via FORGEPORTAL_PLUGIN_MYBACKEND_APITOKEN"
      }
    }
  }
}
```

Secrets are never logged or returned by the config API; they are resolved at runtime from env.

## 5. Register in the portal (API config)

Backend plugins are **loaded by the API** from config. No UI registration is needed for a backend-only plugin.

1. **Publish or link** the package so the API can resolve it (e.g. `pnpm add ../path/to/forge-plugin-my-backend` in the monorepo, or publish to npm).

2. **Add to `forgeportal.yaml`** (root of ForgePortal):
   ```yaml
   pluginPackages:
     packages:
       - forge-plugin-my-backend
   plugins:
     my-backend:
       enabled: true
       config:
         apiEndpoint: "https://api.example.com"
   ```
   Do **not** put `apiToken` in config; set `FORGEPORTAL_PLUGIN_MYBACKEND_APITOKEN` in the environment.

3. **Restart the API**. The plugin loader will load the package, read the manifest, validate config, and register the action and routes. Routes are then available at e.g. `GET /api/v1/plugins/my-backend/health` and `GET /api/v1/plugins/my-backend/data`.

## 6. Test the action

Use a template that invokes `mybackend.echo@v1`, or call the action run API with the action id. Check the action run log in the UI to see `ctx.log()` output and the returned outputs.

## Summary

| Step | Action |
|------|--------|
| 1 | Scaffold with `npx create-forge-plugin my-backend --type backend` |
| 2 | Implement `ActionProvider` (handler uses `ctx.logger`, `ctx.config`, `ctx.log`) |
| 3 | Implement `registerBackendRoute` with a Fastify async plugin |
| 4 | Export `registerBackendPlugin(sdk)` and register action + route |
| 5 | Add package to `pluginPackages.packages` and config to `plugins.<id>.config`; set secrets via env |
| 6 | Restart API and test the route and action |

You now have a backend plugin with an action and routes that compile and run inside the API process.
