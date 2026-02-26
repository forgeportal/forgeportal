import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { GrafanaTab }          from './GrafanaTab.js';

/**
 * UI entry point for the Grafana plugin.
 * Called by the ForgePortal UI shell at startup.
 *
 * Registration in apps/ui/src/plugins/index.ts:
 *   import { registerPlugin as registerGrafana } from '@forgeportal/plugin-grafana/ui';
 *   registerPluginById('grafana', registerGrafana);
 */
export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityTab({
    id:        'grafana-tab',
    title:     'Grafana',
    component: GrafanaTab,
    // No appliesTo — the tab shows a helpful config message when annotation is missing
  });
}
