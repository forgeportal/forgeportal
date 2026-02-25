import type { ActionProvider } from '@forgeportal/plugin-sdk';
import type { ClusterConfig } from './types.js';
import { KubernetesApiClient, resolveCluster } from './api-client.js';

/**
 * kubernetes.restartDeployment@v1
 *
 * Triggers a rolling restart of a named Kubernetes Deployment by patching
 * the pod template annotation `kubectl.kubernetes.io/restartedAt`.
 *
 * Input:
 *   - deploymentName: string (required)
 *   - namespace:      string (optional, defaults to "default")
 *   - cluster:        string (optional, defaults to first configured cluster)
 */
export function createRestartDeploymentAction(
  clusters: ClusterConfig[],
  defaultNamespace: string,
): ActionProvider {
  return {
    id:      'kubernetes.restartDeployment',
    version: 'v1',
    schema: {
      input: {
        type:       'object',
        required:   ['deploymentName'],
        properties: {
          deploymentName: {
            type:        'string',
            title:       'Deployment Name',
            description: 'Name of the Kubernetes Deployment to restart.',
          },
          namespace: {
            type:        'string',
            title:       'Namespace',
            description: 'Kubernetes namespace (default: plugin defaultNamespace or "default").',
          },
          cluster: {
            type:        'string',
            title:       'Cluster',
            description: 'Cluster name from plugin config (default: first configured cluster).',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          restartedAt: { type: 'string', description: 'ISO timestamp of the restart patch.' },
        },
      },
    },

    async handler(ctx, input) {
      const deploymentName = input['deploymentName'] as string;
      const namespace      = (input['namespace'] as string | undefined) ?? defaultNamespace;
      const clusterName    = input['cluster'] as string | undefined;

      ctx.logger.info(`Restarting deployment "${deploymentName}" in namespace "${namespace}"`);

      const clusterCfg = resolveCluster(clusters, clusterName);
      const client     = new KubernetesApiClient(clusterCfg);

      await client.restartDeployment(namespace, deploymentName);

      const restartedAt = new Date().toISOString();
      ctx.logger.info(`Deployment "${deploymentName}" restart patch applied at ${restartedAt}`);

      return {
        status:  'success',
        outputs: { restartedAt },
        links: [
          {
            title: `View in cluster ${clusterCfg.name}`,
            url:   `${clusterCfg.url}/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
          },
        ],
      };
    },
  };
}

/**
 * kubernetes.scaleDeployment@v1
 *
 * Scales a Kubernetes Deployment to the desired replica count.
 *
 * Input:
 *   - deploymentName: string  (required)
 *   - replicas:       number  (required)
 *   - namespace:      string  (optional)
 *   - cluster:        string  (optional)
 */
export function createScaleDeploymentAction(
  clusters: ClusterConfig[],
  defaultNamespace: string,
): ActionProvider {
  return {
    id:      'kubernetes.scaleDeployment',
    version: 'v1',
    schema: {
      input: {
        type:       'object',
        required:   ['deploymentName', 'replicas'],
        properties: {
          deploymentName: {
            type:        'string',
            title:       'Deployment Name',
            description: 'Name of the Kubernetes Deployment to scale.',
          },
          replicas: {
            type:        'number',
            title:       'Replicas',
            description: 'Desired number of replicas (0–100).',
          },
          namespace: { type: 'string', title: 'Namespace' },
          cluster:   { type: 'string', title: 'Cluster' },
        },
      },
      output: {
        type: 'object',
        properties: {
          replicas: { type: 'number', description: 'Replica count applied.' },
        },
      },
    },

    async handler(ctx, input) {
      const deploymentName = input['deploymentName'] as string;
      const replicas       = input['replicas'] as number;
      const namespace      = (input['namespace'] as string | undefined) ?? defaultNamespace;
      const clusterName    = input['cluster'] as string | undefined;

      ctx.logger.info(
        `Scaling deployment "${deploymentName}" to ${replicas} replica(s) in namespace "${namespace}"`,
      );

      const clusterCfg = resolveCluster(clusters, clusterName);
      const client     = new KubernetesApiClient(clusterCfg);

      await client.scaleDeployment(namespace, deploymentName, replicas);
      ctx.logger.info(`Deployment "${deploymentName}" scaled to ${replicas}.`);

      return { status: 'success', outputs: { replicas } };
    },
  };
}
