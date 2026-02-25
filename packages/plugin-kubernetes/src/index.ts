import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import { parseClusters } from './api-client.js';
import { createRoutes } from './routes.js';
import { createRestartDeploymentAction, createScaleDeploymentAction } from './actions.js';

/**
 * Backend entry point for the Kubernetes plugin.
 * Called by the ForgePortal plugin loader at startup.
 *
 * Configuration (forgeportal.yaml → plugins.kubernetes.config):
 *   clusters:         JSON string — array of {name, url, skipTLSVerify?}
 *   defaultNamespace: string (default: "default")
 *
 * Per-cluster tokens come from env:
 *   FORGEPORTAL_PLUGIN_KUBERNETES_<CLUSTER_NAME_UPPER>_TOKEN
 */
export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  const rawClusters     = sdk.config.get<string>('clusters') ?? '[]';
  const defaultNs       = sdk.config.get<string>('defaultNamespace') ?? 'default';

  const clusters = parseClusters(
    rawClusters,
    (envKey) => process.env[`FORGEPORTAL_PLUGIN_KUBERNETES_${envKey}_TOKEN`],
  );

  if (clusters.length === 0) {
    sdk.logger.warn(
      'kubernetes plugin: no clusters configured. ' +
      'Set plugins.kubernetes.config.clusters in forgeportal.yaml.',
    );
  } else {
    sdk.logger.info(
      `kubernetes plugin: ${clusters.length} cluster(s) configured — ${clusters.map((c) => c.name).join(', ')}`,
    );
  }

  // Mount backend routes under /api/v1/plugins/kubernetes/
  sdk.registerBackendRoute({
    path:    '',
    handler: createRoutes(clusters, defaultNs),
  });

  // Register template-usable action providers
  sdk.registerActionProvider(createRestartDeploymentAction(clusters, defaultNs));
  sdk.registerActionProvider(createScaleDeploymentAction(clusters, defaultNs));
}
