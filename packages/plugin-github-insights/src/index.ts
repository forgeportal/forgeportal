import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import type { GitHubInsightsConfig } from './types.js';
import { createRoutes } from './routes.js';

/**
 * Backend entry point for the GitHub Insights plugin.
 * Called by the ForgePortal plugin loader at startup.
 *
 * Configuration (forgeportal.yaml -> plugins.github-insights.config):
 *   cacheTTLSeconds: number (default: 300)
 *
 * Token resolution (first match wins):
 *   1. FORGEPORTAL_PLUGIN_GITHUB_INSIGHTS_TOKEN env var (dedicated token)
 *   2. SCM_GITHUB_TOKEN env var (shared SCM token)
 */
export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  const token =
    process.env['FORGEPORTAL_PLUGIN_GITHUB_INSIGHTS_TOKEN'] ??
    process.env['SCM_GITHUB_TOKEN'] ??
    '';

  const cacheTTLSeconds = sdk.config.get<number>('cacheTTLSeconds') ?? 300;

  if (!token) {
    sdk.logger.warn(
      'github-insights plugin: no GitHub token found. ' +
      'Set FORGEPORTAL_PLUGIN_GITHUB_INSIGHTS_TOKEN or SCM_GITHUB_TOKEN. ' +
      'API calls will fail for private repos.',
    );
  } else {
    sdk.logger.info(
      `github-insights plugin: ready (cache TTL: ${cacheTTLSeconds}s)`,
    );
  }

  const config: GitHubInsightsConfig = { token, cacheTTLSeconds };

  sdk.registerBackendRoute({
    path:    '',
    handler: createRoutes(config),
  });
}
