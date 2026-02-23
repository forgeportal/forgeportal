import type { PluginConfigFieldSchema } from '@forgeportal/plugin-sdk';

/**
 * Derives the env var name for a plugin secret config field.
 * Convention: FORGEPORTAL_PLUGIN_{PLUGIN_ID}_{KEY}
 * Hyphens in ID and camelCase in key are both normalized to UPPER_SNAKE.
 *
 * Examples:
 *   pluginId="pagerduty",    key="apiToken"    → FORGEPORTAL_PLUGIN_PAGERDUTY_APITOKEN
 *   pluginId="slack-notify", key="webhookUrl"  → FORGEPORTAL_PLUGIN_SLACK_NOTIFY_WEBHOOKURL
 */
export function toPluginEnvVarName(pluginId: string, key: string): string {
  const idPart  = pluginId.replace(/-/g, '_').toUpperCase();
  const keyPart = key.toUpperCase();
  return `FORGEPORTAL_PLUGIN_${idPart}_${keyPart}`;
}

export interface ResolvedPluginConfig {
  /** Full resolved config (yaml values + env var secrets + manifest defaults). Passed to the plugin handler. */
  resolved:     Record<string, unknown>;
  /** Keys that are marked as secret — excluded from public API responses and logs. */
  secretKeys:   ReadonlySet<string>;
  /** Non-secret resolved values — safe to expose to the UI via the status endpoint. */
  publicConfig: Record<string, unknown>;
}

/**
 * Resolves the effective config for a plugin by combining three sources:
 *   1. Values from forgeportal.yaml  (config.plugins[id].config)
 *   2. Secret values from env vars:  FORGEPORTAL_PLUGIN_{ID}_{KEY}
 *   3. Default values declared in the plugin manifest's config schema
 *
 * Secret fields are stripped from publicConfig to prevent accidental exposure.
 */
export function resolvePluginConfig(
  pluginId:       string,
  yamlConfig:     Record<string, unknown>,
  manifestConfig: Record<string, PluginConfigFieldSchema> | undefined,
): ResolvedPluginConfig {
  const resolved:   Record<string, unknown> = { ...yamlConfig };
  const secretKeys: Set<string>             = new Set();

  if (manifestConfig) {
    for (const [key, schema] of Object.entries(manifestConfig)) {
      if (schema.secret) {
        secretKeys.add(key);
        // Secret fields: prefer env var over yaml (yaml must NOT contain secrets)
        const envVar   = toPluginEnvVarName(pluginId, key);
        const envValue = process.env[envVar];
        if (envValue !== undefined) {
          resolved[key] = envValue;
        }
        // Do NOT apply default for secrets — if required + missing, validator catches it
      } else {
        // Non-secret: apply manifest default if value not provided in yaml
        if (resolved[key] === undefined && schema.default !== undefined) {
          resolved[key] = schema.default;
        }
      }
    }
  }

  // Build publicConfig: resolved minus secret keys
  const publicConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resolved)) {
    if (!secretKeys.has(key)) {
      publicConfig[key] = value;
    }
  }

  return { resolved, secretKeys, publicConfig };
}
