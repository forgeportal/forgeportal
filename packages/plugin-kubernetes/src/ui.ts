import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { KubernetesTab } from './KubernetesTab.js';

/**
 * UI entry point for the Kubernetes plugin.
 * Called by the ForgePortal UI shell at startup.
 *
 * Registration in apps/ui/src/plugins/index.ts:
 *   import { registerPlugin as registerKubernetes } from '@forgeportal/plugin-kubernetes/ui';
 *   registerPluginById('kubernetes', registerKubernetes);
 */
export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityTab({
    id:        'kubernetes-tab',
    title:     'Kubernetes',
    component: KubernetesTab,
    // No appliesTo restriction — the tab component handles missing annotation gracefully
  });
}
