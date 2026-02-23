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
    logger.error({ err }, 'OIDC discovery failed — starting without OIDC');
  }
} else {
  logger.warn('OIDC not configured — running in dev mode with bypass auth');
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
    app.log.info(`Server listening at ${address}`);
  },
);
