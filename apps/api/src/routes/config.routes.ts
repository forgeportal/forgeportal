import type { FastifyInstance } from 'fastify';

export async function configRoutes(app: FastifyInstance) {
  // Public — path is in auth SKIP_PATHS. Branding info (logo, name, colors) is not sensitive.
  app.get('/api/v1/config/branding', async (_req, reply) => {
    const cfg = app.config;
    return reply.send({
      portalName:   cfg.ui?.portalName   ?? 'ForgePortal',
      logoUrl:      cfg.ui?.logoUrl      ?? null,
      faviconUrl:   cfg.ui?.faviconUrl   ?? null,
      primaryColor: cfg.ui?.primaryColor ?? null,
      navLinks:     cfg.ui?.navLinks     ?? [],
      announcement: cfg.ui?.announcement ?? null,
    });
  });
}
