import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import type pg from 'pg';
import type { AppConfig } from '@forgeportal/core';
import type { ActionRegistry } from '@forgeportal/scaffolder';
import type { SCMProviders } from '@forgeportal/scm';
import type { PluginManifest } from '@forgeportal/plugin-sdk';
import { BackendPluginRegistry, type ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import { requirePermission } from '@forgeportal/auth';
import type { Permission } from '@forgeportal/auth';
import { readPluginManifest } from './manifest-reader.js';
import { checkEngineVersion } from './version-check.js';
import { adaptSdkActionProvider } from './action-provider-adapter.js';
import { resolvePluginConfig } from './secret-resolver.js';
import { validatePluginConfig } from './plugin-config-validator.js';

export type PluginStatus = 'enabled' | 'disabled' | 'error';

export interface LoadedPlugin {
  id:            string;
  name:          string;
  version:       string;
  type:          'ui' | 'backend' | 'fullstack';
  status:        PluginStatus;
  errorMessage?: string;
  capabilities:  PluginManifest['forgeportal']['capabilities'];
  permissions:   string[];
  /** Non-secret config values safe to expose to the UI via GET /api/v1/plugins/status. */
  publicConfig:  Record<string, unknown>;
}

/**
 * Derives a URL-safe plugin ID from a package name.
 * "@myorg/forge-plugin-pagerduty" → "pagerduty"
 * "forge-plugin-slack-notify"     → "slack-notify"
 * "@myorg/my-custom-plugin"       → "my-custom-plugin"
 */
export function derivePluginId(packageName: string): string {
  const withoutScope = packageName.replace(/^@[^/]+\//, '');
  return withoutScope.replace(/^forge-plugin-/, '');
}

export interface PluginLoaderOptions {
  app:            FastifyInstance;
  pool:           pg.Pool;
  config:         AppConfig;
  actionRegistry: ActionRegistry;
  scmProviders:   SCMProviders;
  logger:         FastifyBaseLogger;
}

/**
 * Loads all configured plugins and integrates them into the API server.
 * Called once during server startup (after buildApp, before app.listen).
 *
 * Returns a list of LoadedPlugin descriptors for use by GET /api/v1/plugins.
 */
export async function loadPlugins(opts: PluginLoaderOptions): Promise<LoadedPlugin[]> {
  const { app, pool, config, actionRegistry, scmProviders, logger } = opts;
  const loaded: LoadedPlugin[] = [];

  const packageNames: string[] = config.pluginPackages?.packages ?? [];

  if (packageNames.length === 0) {
    logger.info('No plugin packages configured. Skipping plugin loading.');
    return [];
  }

  logger.info({ count: packageNames.length }, 'Loading plugins');

  for (const packageName of packageNames) {
    const pluginId = derivePluginId(packageName);

    try {
      // 1 — Read manifest
      const { manifest, entryPath } = await readPluginManifest(packageName);

      // 2 — Check engine version compatibility
      const versionCheck = checkEngineVersion(manifest.forgeportal.engineVersion);
      if (!versionCheck.compatible) {
        logger.warn(
          { plugin: packageName, reason: versionCheck.reason },
          `Plugin "${pluginId}" is incompatible — disabling`,
        );
        loaded.push({
          id:           pluginId,
          name:         packageName,
          version:      manifest.version,
          type:         manifest.forgeportal.type,
          status:       'disabled',
          errorMessage: versionCheck.reason,
          capabilities: manifest.forgeportal.capabilities,
          permissions:  manifest.forgeportal.permissions ?? [],
          publicConfig: {},
        });
        continue;
      }

      // 3 — Check enabled flag: DB override (plugin_overrides) wins over forgeportal.yaml
      const pluginEntry = config.plugins[pluginId];
      const enabledByConfig = pluginEntry?.enabled !== false;
      const overrideRow = await pool.query(
        `SELECT enabled FROM plugin_overrides WHERE plugin_id = $1`,
        [pluginId],
      );
      const enabled = overrideRow.rows.length > 0
        ? (overrideRow.rows[0] as { enabled: boolean }).enabled
        : enabledByConfig;

      if (!enabled) {
        logger.info(
          { plugin: pluginId },
          `Plugin "${pluginId}" is disabled (config or admin override) — skipping`,
        );
        loaded.push({
          id:           pluginId,
          name:         packageName,
          version:      manifest.version,
          type:         manifest.forgeportal.type,
          status:       'disabled',
          capabilities: manifest.forgeportal.capabilities,
          permissions:  manifest.forgeportal.permissions ?? [],
          publicConfig: {},
        });
        continue;
      }

      // 4 — Resolve config (yaml + env var secrets + manifest defaults)
      const yamlConfig     = pluginEntry?.config ?? {};
      const manifestConfig = manifest.forgeportal.config;

      const { resolved, publicConfig } = resolvePluginConfig(pluginId, yamlConfig, manifestConfig);

      // 5 — Validate config against manifest schema
      const validation = validatePluginConfig(pluginId, resolved, manifestConfig);

      for (const warn of validation.warnings) {
        logger.warn({ plugin: pluginId }, warn);
      }

      if (!validation.valid) {
        for (const err of validation.errors) {
          logger.error({ plugin: pluginId }, err);
        }
        loaded.push({
          id:           pluginId,
          name:         packageName,
          version:      manifest.version,
          type:         manifest.forgeportal.type,
          status:       'error',
          errorMessage: validation.errors.join('; '),
          capabilities: manifest.forgeportal.capabilities,
          permissions:  manifest.forgeportal.permissions ?? [],
          publicConfig: {},
        });
        continue;
      }

      // 6 — Load backend capabilities (for backend and fullstack plugins)
      const isBackend = manifest.forgeportal.type === 'backend' || manifest.forgeportal.type === 'fullstack';
      if (isBackend) {
        // Dynamically import the plugin's ESM entry
        const pluginModule = (await import(entryPath)) as {
          registerBackendPlugin?: (sdk: ForgeBackendPluginSDK) => void;
          registerPlugin?:        (sdk: ForgeBackendPluginSDK) => void;
        };

        const registerFn = pluginModule.registerBackendPlugin ?? pluginModule.registerPlugin;
        if (typeof registerFn !== 'function') {
          throw new Error(
            `Plugin "${packageName}" entry point does not export registerBackendPlugin() or registerPlugin(). ` +
            `Entry: ${entryPath}`,
          );
        }

        const pluginLogger = logger.child({ plugin: pluginId });

        const registry = new BackendPluginRegistry(
          // Use the fully resolved config (includes secrets for action handlers)
          { get: <T>(key: string) => resolved[key] as T | undefined },
          {
            info:  (msg, meta) => pluginLogger.info(meta ?? {}, msg),
            warn:  (msg, meta) => pluginLogger.warn(meta ?? {}, msg),
            error: (msg, meta) => pluginLogger.error(meta ?? {}, msg),
          },
        );

        // 7 — Call plugin's registration function
        registerFn(registry);

        // 8 — Register action providers into ActionRegistry
        for (const provider of registry.getActionProviders()) {
          const adapted = adaptSdkActionProvider(provider, resolved, scmProviders, pool, pluginLogger);
          try {
            actionRegistry.register(adapted);
            logger.info(
              { plugin: pluginId, actionId: adapted.actionId },
              'Registered plugin action provider',
            );
          } catch (err) {
            logger.warn(
              { plugin: pluginId, actionId: adapted.actionId, err },
              'Action provider already registered — skipping',
            );
          }
        }

        // 9 — Mount backend routes with optional permission middleware
        const requiredPermissions = manifest.forgeportal.permissions ?? [];
        for (const backendRoute of registry.getBackendRoutes()) {
          const routePrefix = `/api/v1/plugins/${pluginId}/${backendRoute.path.replace(/^\//, '')}`;
          logger.info({ plugin: pluginId, prefix: routePrefix }, 'Mounting plugin backend routes');

          await app.register(
            async (scopedApp) => {
              if (requiredPermissions.length > 0) {
                scopedApp.addHook(
                  'onRequest',
                  requirePermission(...(requiredPermissions as Permission[])),
                );
              }
              await backendRoute.handler(scopedApp);
            },
            { prefix: routePrefix },
          );
        }
      }

      loaded.push({
        id:           pluginId,
        name:         packageName,
        version:      manifest.version,
        type:         manifest.forgeportal.type,
        status:       'enabled',
        capabilities: manifest.forgeportal.capabilities,
        permissions:  manifest.forgeportal.permissions ?? [],
        publicConfig,
      });

      logger.info(
        { plugin: pluginId, type: manifest.forgeportal.type },
        `Plugin "${pluginId}" loaded successfully`,
      );

    } catch (err) {
      const errMsg   = err instanceof Error ? err.message : String(err);
      const notFound = errMsg.includes('not found in node_modules');

      if (notFound) {
        // Warn without crashing — other plugins continue to load normally.
        logger.warn(
          { plugin: packageName },
          `Plugin "${packageName}" is configured in forgeportal.yaml but is not installed. ` +
          `Run "pnpm forge sync" and restart the server.`,
        );
      } else {
        logger.error({ plugin: packageName, err }, `Failed to load plugin "${packageName}" — disabling`);
      }

      loaded.push({
        id:           pluginId,
        name:         packageName,
        version:      'unknown',
        type:         'backend',
        status:       'error',
        errorMessage: notFound
          ? `Plugin package "${packageName}" not found in node_modules. Run "pnpm forge sync" and restart the server.`
          : errMsg,
        capabilities: {},
        permissions:  [],
        publicConfig: {},
      });
    }
  }

  return loaded;
}
