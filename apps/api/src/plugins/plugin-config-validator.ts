import type { PluginConfigFieldSchema } from '@forgeportal/plugin-sdk';
import { toPluginEnvVarName } from './secret-resolver.js';

export interface ConfigValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

/**
 * Validates a plugin's resolved config against its manifest config schema.
 *
 * Rules:
 * - required + missing value + missing env var → ERROR (plugin disabled)
 * - wrong type (e.g. number where string expected) → WARNING (plugin still loads)
 * - unknown config key (not in manifest) → WARNING (key passed through to plugin)
 *
 * For secret fields: "missing" means neither yaml value nor env var is present.
 * The validator receives the already-resolved config (after resolvePluginConfig).
 */
export function validatePluginConfig(
  pluginId:       string,
  resolvedConfig: Record<string, unknown>,
  manifestConfig: Record<string, PluginConfigFieldSchema> | undefined,
): ConfigValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!manifestConfig || Object.keys(manifestConfig).length === 0) {
    return { valid: true, errors, warnings };
  }

  for (const [key, schema] of Object.entries(manifestConfig)) {
    const value = resolvedConfig[key];

    // Check required fields
    if (schema.required) {
      const isMissing = value === undefined || value === null || value === '';
      if (isMissing) {
        if (schema.secret) {
          const envVar = toPluginEnvVarName(pluginId, key);
          errors.push(
            `Plugin "${pluginId}" requires secret config field "${key}". ` +
            `Set env var: ${envVar}=<value>`,
          );
        } else {
          errors.push(
            `Plugin "${pluginId}" requires config field "${key}" but it is not set. ` +
            `Add it to forgeportal.yaml under plugins.${pluginId}.config.${key}`,
          );
        }
      }
    }

    // Check type if value is present
    if (value !== undefined && value !== null) {
      const actualType = typeof value;
      if (actualType !== schema.type) {
        warnings.push(
          `Plugin "${pluginId}" config field "${key}": manifest declares type "${schema.type}" ` +
          `but received "${actualType}". The plugin may behave unexpectedly.`,
        );
      }
    }
  }

  // Warn on config keys not declared in the manifest
  for (const key of Object.keys(resolvedConfig)) {
    if (!manifestConfig[key]) {
      warnings.push(
        `Plugin "${pluginId}" config has undeclared field "${key}" (not in manifest). ` +
        `It will be passed through but may be ignored by the plugin.`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
