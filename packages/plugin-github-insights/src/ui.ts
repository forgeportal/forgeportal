import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { GitHubInsightsTab } from './GitHubInsightsTab.js';

/**
 * UI entry point for the GitHub Insights plugin.
 * Called by the ForgePortal UI shell at startup.
 *
 * Registration in apps/ui/src/plugins/index.ts:
 *   import { registerPlugin as registerGitHubInsights } from '@forgeportal/plugin-github-insights/ui';
 *   registerPluginById('github-insights', registerGitHubInsights);
 */
export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityTab({
    id:        'github-insights-tab',
    title:     'GitHub',
    component: GitHubInsightsTab,
  });
}
