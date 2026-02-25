import path from 'node:path';
import { loadConfig, createLogger } from '@forgeportal/core';
import { createPool, runMigrations, runSeed } from '@forgeportal/db';
import { configureOIDC, type OIDCConfig } from '@forgeportal/auth';
import { createSCMProviders } from '@forgeportal/scm';
import { ActionRegistry } from '@forgeportal/scaffolder';
import { buildApp } from './app.js';
import { loadPlugins, pluginsRoutes } from './plugins/index.js';

const config = loadConfig();
const logger = createLogger({ level: config.server.logLevel, name: 'api-bootstrap' });

const pool = createPool(config.db);

const migrationsDir = path.resolve(config.migrations.dir);
await runMigrations(pool, migrationsDir);

if (config.migrations.runSeed) {
  const seedFile = path.resolve(config.migrations.seedFile);
  await runSeed(pool, seedFile);
}

let oidcConfig: OIDCConfig | null = null;

if (config.auth.oidc.issuer) {
  try {
    oidcConfig = await configureOIDC(config.auth);
    logger.info('OIDC discovery completed');
  } catch (err) {
    // Clear the issuer so authGuard/middleware enter devMode (bypass auth).
    // Without this, a broken OIDC_ISSUER blocks all authenticated endpoints with 401.
    (config.auth.oidc as Record<string, unknown>).issuer = undefined;
    logger.warn(
      { err },
      '⚠  OIDC discovery failed — falling back to dev-mode bypass.\n' +
      '   Authentication is disabled. Set OIDC_ISSUER to a reachable provider to enable login.',
    );
  }
} else {
  logger.warn('OIDC not configured — running in dev-bypass mode (no login required)');
}

const scmProviders = await createSCMProviders(config, logger);

const app = buildApp(pool, config, oidcConfig, scmProviders);

// ─── Plugin loading (after buildApp, before listen) ───────────────────────────
const apiActionRegistry = new ActionRegistry();
const loadedPlugins = await loadPlugins({
  app,
  pool,
  config,
  actionRegistry: apiActionRegistry,
  scmProviders: scmProviders ?? { github: null, gitlab: null, all: () => [], get: () => null },
  logger: app.log,
});
app.register(pluginsRoutes, { loadedPlugins, pool });

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

app.listen(
  { port: config.server.port, host: config.server.host },
  (err, address) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
    const authMode = oidcConfig
      ? `OIDC  (${config.auth.oidc.issuer ?? 'configured'})`
      : 'dev-bypass  (no login required)';
    const scmCount = scmProviders.all().length;

    // Query entity + template counts for the banner (best-effort, non-blocking).
    void (async () => {
      try {
        const [ent, tpl] = await Promise.all([
          pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM entities'),
          pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM templates'),
        ]);
        const entityCount   = parseInt(ent.rows[0]?.count  ?? '0', 10);
        const templateCount = parseInt(tpl.rows[0]?.count ?? '0', 10);
        const W = 44;
        const line = (label: string, value: string) => {
          const content = `  ${label.padEnd(10)} ${value}`;
          return `║${content.padEnd(W - 2)}║`;
        };
        app.log.info(
          `\n╔${'═'.repeat(W - 2)}╗\n` +
          `║${'  ForgePortal API ready'.padEnd(W - 2)}║\n` +
          `║${'─'.repeat(W - 2)}║\n` +
          `${line('Listening:', address)}\n` +
          `${line('Auth:', authMode)}\n` +
          `${line('SCM:', `${scmCount} provider(s)`)}\n` +
          `${line('Catalog:', `${entityCount} entity(ies), ${templateCount} template(s)`)}\n` +
          `${line('Docs:', 'https://docs.forgeportal.dev')}\n` +
          `╚${'═'.repeat(W - 2)}╝`,
        );
      } catch {
        // Fallback banner without DB stats
        app.log.info(`ForgePortal API ready — listening at ${address} | auth: ${authMode} | SCM: ${scmCount} provider(s)`);
      }
    })();
  },
);
