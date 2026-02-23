export type PluginType = 'ui' | 'backend' | 'fullstack';

export interface PluginNames {
  /** Short plugin ID, consistent with backend's derivePluginId(). e.g. "pagerduty" */
  pluginId:    string;
  /** Full npm package name. e.g. "@myorg/forge-plugin-pagerduty" */
  packageName: string;
  /** Output directory name. e.g. "forge-plugin-pagerduty" */
  dirName:     string;
  /** PascalCase for component/class names. e.g. "Pagerduty" | "MyPlugin" */
  pascalName:  string;
  /** camelCase for variable names. e.g. "pagerduty" | "myPlugin" */
  camelName:   string;
  /** Human-readable title. e.g. "Pagerduty" | "My Plugin" */
  title:       string;
  /** Optional org scope. e.g. "@myorg" (with @) */
  org?:        string;
}

/**
 * Derives all naming variants from a short plugin identifier.
 *
 * @param pluginId - Short ID, e.g. "pagerduty" or "my-custom-plugin". No scope, no prefix.
 * @param org      - Optional npm scope with @, e.g. "@myorg"
 *
 * Convention: pluginId MUST be kebab-case, lowercase, no special chars.
 */
export function deriveNames(pluginId: string, org?: string): PluginNames {
  if (!/^[a-z][a-z0-9-]*$/.test(pluginId)) {
    throw new Error(
      `Invalid plugin ID "${pluginId}". Must be lowercase kebab-case (e.g. "pagerduty", "my-plugin").`,
    );
  }
  if (org && !/^@[a-z][a-z0-9-]*$/.test(org)) {
    throw new Error(
      `Invalid org scope "${org}". Must start with @ and be lowercase (e.g. "@myorg").`,
    );
  }

  const packageName = org
    ? `${org}/forge-plugin-${pluginId}`
    : `forge-plugin-${pluginId}`;

  const dirName = `forge-plugin-${pluginId}`;

  const parts = pluginId.split('-');
  const pascalName = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

  const camelName =
    (parts[0] ?? '') +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');

  const title = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

  return { pluginId, packageName, dirName, pascalName, camelName, title, org };
}
