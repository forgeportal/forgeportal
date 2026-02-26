import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { ArgocdTab } from './ArgocdTab.js';

/**
 * UI entry point for the ArgoCD plugin.
 * Called by the ForgePortal UI shell at startup.
 *
 * Registration in apps/ui/src/plugins/index.ts:
 *   import { registerPlugin as registerArgocd } from '@forgeportal/plugin-argocd/ui';
 *   registerPluginById('argocd', registerArgocd);
 */
export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityTab({
    id:        'argocd-tab',
    title:     'ArgoCD',
    component: ArgocdTab,
  });
}
