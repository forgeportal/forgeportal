import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { PluginManifest } from '@forgeportal/plugin-sdk';

export interface ManifestReadResult {
  manifest:  PluginManifest;
  pluginDir: string;     // absolute path to plugin package root
  entryPath: string;     // absolute path to plugin's main entry (ESM)
}

/**
 * Validates a parsed manifest object and resolves the entry path.
 * Shared by both production (node_modules) and test (direct path) variants.
 */
async function buildResult(
  packageName: string,
  pluginDir:   string,
  manifestRaw: string,
): Promise<ManifestReadResult> {
  let manifest: PluginManifest;
  try {
    manifest = JSON.parse(manifestRaw) as PluginManifest;
  } catch (err) {
    throw new Error(`Plugin "${packageName}" has invalid JSON in forgeportal-plugin.json: ${String(err)}`);
  }

  if (!manifest.forgeportal?.engineVersion) {
    throw new Error(`Plugin "${packageName}" forgeportal-plugin.json is missing forgeportal.engineVersion`);
  }
  if (!['ui', 'backend', 'fullstack'].includes(manifest.forgeportal.type)) {
    throw new Error(`Plugin "${packageName}" has invalid forgeportal.type: "${manifest.forgeportal.type}"`);
  }

  // Resolve ESM entry point from the plugin's package.json
  const pkgJsonPath = path.join(pluginDir, 'package.json');
  const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8')) as {
    main?: string;
    exports?: Record<string, unknown> | string;
  };

  let entryRelative = '';
  if (typeof pkgJson.exports === 'string') {
    entryRelative = pkgJson.exports;
  } else if (pkgJson.exports && typeof pkgJson.exports === 'object') {
    const root = (pkgJson.exports as Record<string, unknown>)['.'];
    if (typeof root === 'string') {
      entryRelative = root;
    } else if (root && typeof root === 'object') {
      entryRelative = ((root as Record<string, unknown>)['import'] as string) ?? '';
    }
  }
  if (!entryRelative && pkgJson.main) {
    entryRelative = pkgJson.main;
  }
  if (!entryRelative) {
    throw new Error(
      `Plugin "${packageName}" has no resolvable entry point (no main or exports in package.json)`,
    );
  }

  const entryPath = path.resolve(pluginDir, entryRelative);
  return { manifest, pluginDir, entryPath };
}

/**
 * Resolves a plugin package by name from node_modules, reads its
 * forgeportal-plugin.json, and returns the manifest + resolved paths.
 *
 * @param packageName - npm package name, e.g. "@myorg/forge-plugin-pagerduty"
 * @param fromDir     - directory to resolve from (defaults to process.cwd())
 */
export async function readPluginManifest(
  packageName: string,
  fromDir = process.cwd(),
): Promise<ManifestReadResult> {
  const require = createRequire(path.join(fromDir, '__placeholder__.js'));

  // Resolve the plugin directory. Try `./package.json` subpath first (needs
  // explicit export in the package), then fall back to the package main entry
  // (which works even if `exports` doesn't include `./package.json`).
  let pluginDir: string;
  try {
    // Strategy 1: resolve package.json via subpath export
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    pluginDir = path.dirname(pkgJsonPath);
  } catch {
    try {
      // Strategy 2: resolve main entry and walk up to the package root
      const mainEntry = require.resolve(packageName);
      let dir = path.dirname(mainEntry);
      // Walk up until we find a package.json belonging to this package
      while (dir !== path.dirname(dir)) {
        try {
          const pkg = JSON.parse(
            await fs.readFile(path.join(dir, 'package.json'), 'utf8'),
          ) as { name?: string };
          if (pkg.name === packageName) { pluginDir = dir; break; }
        } catch { /* continue */ }
        dir = path.dirname(dir);
      }
    } catch { /* fall through */ }

    if (!pluginDir!) {
      throw new Error(
        `Plugin package "${packageName}" not found in node_modules. ` +
        `Run "pnpm forge sync" and restart the server.`,
      );
    }
  }
  const manifestPath = path.join(pluginDir, 'forgeportal-plugin.json');

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, 'utf8');
  } catch {
    throw new Error(
      `Plugin "${packageName}" is missing forgeportal-plugin.json at ${manifestPath}. ` +
      `Is this a valid ForgePortal plugin?`,
    );
  }

  return buildResult(packageName, pluginDir, manifestRaw);
}

/**
 * Reads a plugin manifest directly from a given directory path.
 * Intended for testing with fixture plugins that are not in node_modules.
 *
 * @param pluginDir - absolute path to plugin package root
 */
export async function readPluginManifestFromDir(
  pluginDir: string,
): Promise<ManifestReadResult> {
  const manifestPath = path.join(pluginDir, 'forgeportal-plugin.json');
  const packageName  = path.basename(pluginDir);

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, 'utf8');
  } catch {
    throw new Error(
      `Missing forgeportal-plugin.json in ${pluginDir}. Is this a valid ForgePortal plugin?`,
    );
  }

  return buildResult(packageName, pluginDir, manifestRaw);
}
