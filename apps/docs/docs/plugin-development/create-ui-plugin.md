---
title: Create a UI Plugin
sidebar_position: 2
---

# Create a UI Plugin

This tutorial walks you through building a **UI-only** plugin that adds an **entity tab** to the catalog. You will scaffold the plugin, implement the tab, then register it in the ForgePortal UI so the tab appears on entity detail pages.

## 1. Scaffold the plugin

From a directory of your choice (e.g. a sibling of the ForgePortal repo):

```bash
npx create-forge-plugin my-info --type ui
cd forge-plugin-my-info
pnpm install
pnpm build
```

You should get a package with `forgeportal-plugin.json`, `src/index.ts`, and a React component (e.g. `src/MyInfoTab.tsx`). Ensure `pnpm build` completes without errors.

## 2. Implement the entity tab

The tab component receives the current **entity** via the SDK and can use hooks to read config or call APIs. Example that compiles:

**`src/MyInfoTab.tsx`** (or the name your scaffold uses):

```tsx
import { useEntity, useConfig } from '@forgeportal/plugin-sdk/react';

export function MyInfoTab() {
  const { entity } = useEntity();
  const customLabel = useConfig<string>('customLabel');

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">
        {customLabel ?? 'Entity info'}
      </h3>
      <dl className="mt-2 space-y-1 text-sm">
        <div>
          <span className="text-gray-500">Name:</span>{' '}
          <span className="font-medium">{entity.name}</span>
        </div>
        <div>
          <span className="text-gray-500">Kind:</span>{' '}
          <span className="font-medium">{entity.kind}</span>
        </div>
        {entity.owner_ref && (
          <div>
            <span className="text-gray-500">Owner:</span>{' '}
            <span className="font-medium">{entity.owner_ref}</span>
          </div>
        )}
      </dl>
    </div>
  );
}
```

**`src/index.ts`** — register the tab with the SDK:

```typescript
import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { MyInfoTab } from './MyInfoTab.js';

export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityTab({
    id:        'my-info-tab',
    title:     'My Info',
    component: MyInfoTab,
    appliesTo: { kinds: ['service', 'component'] }, // optional: only show for these kinds
  });
}
```

Rebuild: `pnpm build`.

## 3. Manifest and config (optional)

In **forgeportal-plugin.json**, declare the tab id in capabilities so the loader knows what you register:

```json
{
  "name": "forge-plugin-my-info",
  "version": "1.0.0",
  "forgeportal": {
    "engineVersion": "^1.0.0",
    "type": "ui",
    "capabilities": {
      "ui": {
        "entityTabs": ["my-info-tab"]
      }
    },
    "config": {
      "customLabel": {
        "type": "string",
        "description": "Title shown in the tab panel",
        "default": "Entity info"
      }
    }
  }
}
```

Config is read in the UI via `useConfig('customLabel')`; values come from `forgeportal.yaml` → `plugins.myinfo.config` (plugin ID = `my-info` → typically `myinfo` after stripping `forge-plugin-`). See [Plugin Manifest](/docs/plugin-development/plugin-manifest).

## 4. Register in the portal {#register-in-the-portal}

ForgePortal does not auto-discover UI plugins from npm. You must **wire the plugin into the UI app**:

1. **Install the package** in the ForgePortal monorepo (e.g. in `apps/ui` or workspace root):
   ```bash
   pnpm add ../path/to/forge-plugin-my-info
   ```
   Or publish the plugin to npm and add it by name.

2. **Register in the UI shell** — edit `apps/ui/src/plugins/index.ts`:
   ```typescript
   import { registerPlugin as registerMyInfo } from 'forge-plugin-my-info';
   registerPluginById('myinfo', registerMyInfo);
   ```
   The second argument (`'myinfo'`) must match the **plugin ID** derived from the package name (e.g. `forge-plugin-my-info` → `my-info`; check `derivePluginId` in the API: it strips `forge-plugin-` and the scope, so `my-info` is the ID if the package name is `forge-plugin-my-info`). Use the same ID in config: `plugins.my-info.config`.

3. **Optional config** in `forgeportal.yaml` (root of ForgePortal):
   ```yaml
   plugins:
     my-info:
       enabled: true
       config:
         customLabel: "Custom title"
   ```

4. **Rebuild and run** the UI:
   ```bash
   pnpm --filter @forgeportal/ui dev
   ```
   Open an entity of kind `service` or `component`; you should see the **My Info** tab.

:::tip
If the tab does not appear, check: (1) the plugin is registered in `apps/ui/src/plugins/index.ts` with the correct ID, (2) the entity kind is in `appliesTo.kinds` (or omit `appliesTo` to show for all kinds), (3) the UI app was rebuilt after adding the plugin.
:::

## Summary

| Step | Action |
|------|--------|
| 1 | `npx create-forge-plugin my-info --type ui` → `pnpm install` → `pnpm build` |
| 2 | Implement tab component with `useEntity()` / `useConfig()`, register in `src/index.ts` |
| 3 | Declare tab id and optional config in `forgeportal-plugin.json` |
| 4 | Add plugin to `apps/ui` and `apps/ui/src/plugins/index.ts`; set config in `forgeportal.yaml`; run UI |

You now have a working UI plugin that compiles and appears as an entity tab in the portal.
