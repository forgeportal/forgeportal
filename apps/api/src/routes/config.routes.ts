import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';

export async function configRoutes(
  app: FastifyInstance,
  opts: { config: AppConfig },
) {
  // Public — no auth required. Branding info (names, colors, logo URLs) is not sensitive.
  app.get('/api/v1/config/branding', async (_req, reply) => {
    const ui = opts.config.ui ?? {};
    return reply.send({
      portalName:   ui.portalName   ?? 'ForgePortal',
      logoUrl:      ui.logoUrl      ?? null,
      faviconUrl:   ui.faviconUrl   ?? null,
      primaryColor: ui.primaryColor ?? null,
    });
  });
}
