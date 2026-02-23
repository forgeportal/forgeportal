import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { requirePermission } from '@forgeportal/auth';
import type { LoadedPlugin } from './plugin-loader.js';

export interface PluginsRoutesOptions {
  loadedPlugins: LoadedPlugin[];
  pool: Pool;
}

/**
 * Registers the plugins status API and admin PATCH for enable/disable.
 * - GET /api/v1/plugins        — full list (requires admin:plugins)
 * - GET /api/v1/plugins/status — enabled IDs + public configs (any authenticated user)
 * - PATCH /api/v1/admin/plugins/:id — set enabled (requires admin:plugins); takes effect after restart.
 */
export async function pluginsRoutes(
  app:  FastifyInstance,
  opts: PluginsRoutesOptions,
): Promise<void> {
  const { loadedPlugins, pool } = opts;

  // Full plugin list — admin only
  app.get(
    '/api/v1/plugins',
    { preHandler: [requirePermission('admin:plugins')] },
    async () => loadedPlugins,
  );

  // Enabled plugin IDs + non-secret configs — accessible to all authenticated users.
  // publicConfig is built by resolvePluginConfig(), which strips all secret keys.
  app.get('/api/v1/plugins/status', async () => {
    const enabledIds = loadedPlugins
      .filter((p) => p.status === 'enabled')
      .map((p) => p.id);

    // Build configs map: only enabled plugins, only non-empty configs
    const configs: Record<string, Record<string, unknown>> = {};
    for (const plugin of loadedPlugins) {
      if (plugin.status === 'enabled' && Object.keys(plugin.publicConfig).length > 0) {
        configs[plugin.id] = plugin.publicConfig;
      }
    }

    return { enabledIds, configs };
  });

  // Admin: persist enable/disable override (applied at next server restart)
  app.patch(
    '/api/v1/admin/plugins/:id',
    { preHandler: [requirePermission('admin:plugins')] },
    async (request, reply) => {
      const { id: pluginId } = request.params as { id: string };
      const body = request.body as { enabled?: boolean };

      if (typeof body.enabled !== 'boolean') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Body must contain { enabled: boolean }',
        });
      }

      const knownIds = loadedPlugins.map((p) => p.id);
      if (!knownIds.includes(pluginId)) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Plugin "${pluginId}" not found`,
        });
      }

      await pool.query(
        `INSERT INTO plugin_overrides (plugin_id, enabled, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (plugin_id) DO UPDATE SET enabled = $2, updated_at = now()`,
        [pluginId, body.enabled],
      );

      return reply.send({
        id: pluginId,
        enabled: body.enabled,
        message: 'Override saved. Restart the server for the change to take effect.',
      });
    },
  );
}
