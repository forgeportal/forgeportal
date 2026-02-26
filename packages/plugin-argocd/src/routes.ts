import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ArgocdConfig }     from './types.js';
import { ArgocdApiClient } from './api-client.js';

interface EntityParams { entityId: string }
interface SyncBody     { appName: string }

/**
 * Creates Fastify route handlers for the ArgoCD plugin.
 * All routes are mounted under /api/v1/plugins/argocd/ by the plugin loader.
 *
 * Routes:
 *   GET  entities/:entityId/app           — app summary (status, health, revision)
 *   GET  entities/:entityId/history       — last 10 sync operations
 *   POST entities/:entityId/sync          — trigger sync
 */
export function createRoutes(config: ArgocdConfig) {
  const client = new ArgocdApiClient(config);

  return async function handler(fastify: FastifyInstance): Promise<void> {
    /**
     * GET /entities/:entityId/app?appName=<override>
     *
     * Returns the ArgoCD application summary: sync status, health, revision, operation state.
     * The app name is read from the query param or entity annotations.
     */
    fastify.get(
      'entities/:entityId/app',
      async (
        request: FastifyRequest<{
          Params:      EntityParams;
          Querystring: { appName?: string };
        }>,
        reply: FastifyReply,
      ) => {
        const appName = request.query.appName;

        if (!appName) {
          return reply.status(400).send({
            error:   'Bad Request',
            message: 'Query parameter "appName" is required, or set the forgeportal.dev/argocd-app-name annotation.',
          });
        }

        try {
          const app = await client.getApp(appName);
          return reply.send({ data: app });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'argocd plugin: getApp failed');
          if (message.includes('404')) {
            return reply.status(404).send({ error: 'Not Found', message: `ArgoCD app "${appName}" not found.` });
          }
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * GET /entities/:entityId/history?appName=<override>
     *
     * Returns the last 10 sync history entries for the ArgoCD application.
     */
    fastify.get(
      'entities/:entityId/history',
      async (
        request: FastifyRequest<{
          Params:      EntityParams;
          Querystring: { appName?: string };
        }>,
        reply: FastifyReply,
      ) => {
        const appName = request.query.appName;

        if (!appName) {
          return reply.status(400).send({
            error:   'Bad Request',
            message: 'Query parameter "appName" is required.',
          });
        }

        try {
          const history = await client.getHistory(appName);
          return reply.send({ data: history });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'argocd plugin: getHistory failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );

    /**
     * POST /entities/:entityId/sync
     *
     * Body: { appName: string }
     * Triggers a manual sync of the ArgoCD application.
     */
    fastify.post(
      'entities/:entityId/sync',
      async (
        request: FastifyRequest<{ Params: EntityParams; Body: SyncBody }>,
        reply:   FastifyReply,
      ) => {
        const { appName } = request.body ?? {};

        if (!appName) {
          return reply.status(400).send({
            error:   'Bad Request',
            message: 'Body field "appName" is required.',
          });
        }

        try {
          await client.syncApp(appName);
          return reply.status(202).send({
            data: { appName, syncTriggeredAt: new Date().toISOString() },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          request.log.error({ err }, 'argocd plugin: syncApp failed');
          return reply.status(502).send({ error: 'Bad Gateway', message });
        }
      },
    );
  };
}
