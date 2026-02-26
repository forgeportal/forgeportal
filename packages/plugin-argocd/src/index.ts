import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import type { ArgocdConfig } from './types.js';
import { createRoutes } from './routes.js';
import { createSyncAppAction, createRollbackAppAction } from './actions.js';

/**
 * Backend entry point for the ArgoCD plugin.
 * Called by the ForgePortal plugin loader at startup.
 *
 * Configuration (forgeportal.yaml -> plugins.argocd.config):
 *   url:      string  — ArgoCD server URL (e.g. https://argocd.internal)
 *   insecure: boolean — skip TLS verification (default: false)
 *
 * Token comes from the environment:
 *   FORGEPORTAL_PLUGIN_ARGOCD_TOKEN
 */
export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  const url      = sdk.config.get<string>('url');
  const insecure = sdk.config.get<boolean>('insecure') ?? false;
  const token    = process.env['FORGEPORTAL_PLUGIN_ARGOCD_TOKEN'] ?? '';

  if (!url) {
    sdk.logger.error(
      'argocd plugin: "url" is required in plugins.argocd.config. Plugin disabled.',
    );
    return;
  }

  if (!token) {
    sdk.logger.warn(
      'argocd plugin: FORGEPORTAL_PLUGIN_ARGOCD_TOKEN env var is not set. API calls will fail.',
    );
  }

  const config: ArgocdConfig = { url, token, insecure };

  sdk.logger.info(`argocd plugin: connected to ${url} (insecure=${insecure})`);

  sdk.registerBackendRoute({
    path:    '',
    handler: createRoutes(config),
  });

  sdk.registerActionProvider(createSyncAppAction(config));
  sdk.registerActionProvider(createRollbackAppAction(config));
}
