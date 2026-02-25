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
    app.log.info(
      `\n╔══════════════════════════════════════════╗\n` +
      `║  ForgePortal API ready                   ║\n` +
      `║  Listening : ${address.padEnd(26)}║\n` +
      `║  Auth      : ${authMode.padEnd(26)}║\n` +
      `║  SCM       : ${String(scmCount + ' provider(s) configured').padEnd(26)}║\n` +
      `╚══════════════════════════════════════════╝`,
    );
  },
);
