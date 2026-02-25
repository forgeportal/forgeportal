import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

export async function statusRoutes(
  app: FastifyInstance,
  { pool }: { pool: pg.Pool },
) {
  /**
   * GET /api/v1/admin/status
   * Returns lightweight setup status used by the onboarding checklist.
   * Available to any authenticated user (viewer+).
   */
  app.get('/api/v1/admin/status', async (_req, _reply) => {
    const config = app.config;

    const scmConfigured =
      !!(config.scm.github?.token) ||
      !!(config.scm.github?.appId) ||
      !!(config.scm.gitlab?.token);

    const oidcConfigured = !!(config.auth.oidc.issuer);
    const authMode: 'oidc' | 'dev-bypass' = oidcConfigured ? 'oidc' : 'dev-bypass';

    const [entitiesResult, templatesResult] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM entities'),
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM templates'),
    ]);

    const entityCount   = parseInt(entitiesResult.rows[0]?.count  ?? '0', 10);
    const templateCount = parseInt(templatesResult.rows[0]?.count ?? '0', 10);

    const version = process.env['npm_package_version'] ?? process.env['FORGEPORTAL_VERSION'] ?? 'unknown';

    return {
      data: {
        scmConfigured,
        oidcConfigured,
        authMode,
        entityCount,
        templateCount,
        version,
      },
    };
  });
}
