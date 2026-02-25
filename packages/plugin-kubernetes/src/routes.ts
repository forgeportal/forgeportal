import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ClusterConfig } from './types.js';
import { KubernetesApiClient, resolveCluster } from './api-client.js';

interface WorkloadsQuery { labelSelector?: string; namespace?: string; cluster?: string }
interface WorkloadsParams { entityId: string }

interface LogsQuery  { namespace?: string; cluster?: string; tail?: string }
interface LogsParams { entityId: string; podName: string }

interface RestartParams { entityId: string; deploymentName: string }
interface RestartBody   { namespace?: string; cluster?: string }

/**
 * Creates Fastify route handlers for the Kubernetes plugin.
 * All routes are mounted under /api/v1/plugins/kubernetes/ by the plugin loader.
 *
 * Routes:
 *   GET  entities/:entityId/workloads
 *   GET  entities/:entityId/pods/:podName/logs
 *   POST entities/:entityId/deployments/:deploymentName/restart
 */
export function createRoutes(
  clusters:         ClusterConfig[],
  defaultNamespace: string,
) {
  return async function handler(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /entities/:entityId/workloads
     *
     * Query params:
     *   labelSelector  (required) — K8s label selector, e.g. "app=payment-api"
     *   namespace      (optional) — K8s namespace, defaults to plugin defaultNamespace
     *   cluster        (optional) — cluster name, defaults to first configured cluster
     */
    fastify.get(
      'entities/:entityId/workloads',
      async (
        request: FastifyRequest<{ Params: WorkloadsParams; Querystring: WorkloadsQuery }>,
        reply:   FastifyReply,
      ) => {
        const { labelSelector, namespace: ns, cluster: clusterName } = request.query;

        if (!labelSelector) {
          return reply.status(400).send({
            error:   'Bad Request',
            message: 'Query parameter "labelSelector" is required.',
          });
        }

        const namespace = ns ?? defaultNamespace;

        try {
          const clusterCfg = resolveCluster(clusters, clusterName);
          const client     = new KubernetesApiClient(clusterCfg);
          const workloads  = await client.getWorkloads(namespace, labelSelector);
          return reply.send({ data: workloads });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'kubernetes plugin: getWorkloads failed');
          if (message.includes('not found')) {
            return reply.status(404).send({ error: 'Not Found', message });
          }
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * GET /entities/:entityId/pods/:podName/logs
     *
     * Query params:
     *   namespace  (optional)
     *   cluster    (optional)
     *   tail       (optional, default 100) — number of log lines to return
     */
    fastify.get(
      'entities/:entityId/pods/:podName/logs',
      async (
        request: FastifyRequest<{ Params: LogsParams; Querystring: LogsQuery }>,
        reply:   FastifyReply,
      ) => {
        const { podName }                                   = request.params;
        const { namespace: ns, cluster: clusterName, tail } = request.query;

        const namespace = ns ?? defaultNamespace;
        const tailLines = tail ? parseInt(tail, 10) : 100;

        try {
          const clusterCfg = resolveCluster(clusters, clusterName);
          const client     = new KubernetesApiClient(clusterCfg);
          const logs       = await client.getPodLogs(namespace, podName, tailLines);
          return reply.send({ data: { logs } });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'kubernetes plugin: getPodLogs failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * POST /entities/:entityId/deployments/:deploymentName/restart
     *
     * Body: { namespace?: string; cluster?: string }
     */
    fastify.post(
      'entities/:entityId/deployments/:deploymentName/restart',
      async (
        request: FastifyRequest<{ Params: RestartParams; Body: RestartBody }>,
        reply:   FastifyReply,
      ) => {
        const { deploymentName }                          = request.params;
        const { namespace: ns, cluster: clusterName } = request.body ?? {};

        const namespace = ns ?? defaultNamespace;

        try {
          const clusterCfg = resolveCluster(clusters, clusterName);
          const client     = new KubernetesApiClient(clusterCfg);
          await client.restartDeployment(namespace, deploymentName);
          return reply.status(202).send({
            data: {
              deploymentName,
              namespace,
              cluster:     clusterCfg.name,
              restartedAt: new Date().toISOString(),
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'kubernetes plugin: restartDeployment failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );
  };
}
