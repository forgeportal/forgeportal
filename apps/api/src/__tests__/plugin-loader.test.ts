import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SDK_VERSION } from '@forgeportal/plugin-sdk';
import { checkEngineVersion } from '../plugins/version-check.js';
import { readPluginManifest, readPluginManifestFromDir } from '../plugins/manifest-reader.js';
import { derivePluginId } from '../plugins/plugin-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PLUGIN_DIR = path.resolve(__dirname, 'fixtures/forge-plugin-mock');

// ─── Unit: checkEngineVersion ────────────────────────────────────────────────

describe('checkEngineVersion', () => {
  it('returns compatible for matching semver range', () => {
    const result = checkEngineVersion(`^${SDK_VERSION}`);
    expect(result.compatible).toBe(true);
  });

  it('returns compatible for exact version match', () => {
    const result = checkEngineVersion(SDK_VERSION);
    expect(result.compatible).toBe(true);
  });

  it('returns incompatible for non-matching major version', () => {
    const result = checkEngineVersion('^99.0.0');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('requires SDK ^99.0.0');
  });

  it('returns incompatible for invalid semver range', () => {
    const result = checkEngineVersion('not-a-version');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('Invalid semver range');
  });
});

// ─── Unit: readPluginManifest (node_modules resolution) ──────────────────────

describe('readPluginManifest', () => {
  it('throws if package not found in node_modules', async () => {
    await expect(
      readPluginManifest('@nonexistent/forge-plugin-fake'),
    ).rejects.toThrow('not found in node_modules');
  });

  it('throws if forgeportal-plugin.json is missing', async () => {
    await expect(
      readPluginManifest('semver'),
    ).rejects.toThrow('missing forgeportal-plugin.json');
  });
});

// ─── Unit: readPluginManifestFromDir (fixture) ───────────────────────────────

describe('readPluginManifestFromDir', () => {
  it('reads manifest from fixture directory', async () => {
    const { manifest, entryPath } = await readPluginManifestFromDir(MOCK_PLUGIN_DIR);
    expect(manifest.forgeportal.type).toBe('backend');
    expect(manifest.forgeportal.engineVersion).toBe('^1.0.0');
    expect(manifest.forgeportal.capabilities.backend?.actionProviders).toContain('mock.echo@v1');
    expect(entryPath).toContain('index.js');
  });

  it('throws if forgeportal-plugin.json is missing', async () => {
    await expect(
      readPluginManifestFromDir('/tmp/nonexistent-plugin-dir'),
    ).rejects.toThrow('forgeportal-plugin.json');
  });
});

// ─── Unit: derivePluginId ────────────────────────────────────────────────────

describe('derivePluginId', () => {
  const cases: [string, string][] = [
    ['@myorg/forge-plugin-pagerduty', 'pagerduty'],
    ['forge-plugin-slack-notify',     'slack-notify'],
    ['@myorg/forge-plugin-costview',  'costview'],
    ['@myorg/my-custom-plugin',       'my-custom-plugin'],
    ['forge-plugin-simple',           'simple'],
  ];

  it.each(cases)('"%s" → "%s"', (packageName, expectedId) => {
    expect(derivePluginId(packageName)).toBe(expectedId);
  });
});

// ─── Integration: BackendPluginRegistry via fixture ──────────────────────────

describe('BackendPluginRegistry with mock plugin', async () => {
  const { manifest } = await readPluginManifestFromDir(MOCK_PLUGIN_DIR);
  const entryUrl = new URL(
    `file://${MOCK_PLUGIN_DIR.replace(/\\/g, '/')}/dist/index.js`,
  );

  it('fixture manifest has correct capabilities', () => {
    expect(manifest.forgeportal.type).toBe('backend');
    expect(manifest.forgeportal.capabilities.backend?.routes).toContain('/status');
    expect(manifest.forgeportal.capabilities.backend?.actionProviders).toContain('mock.echo@v1');
  });

  it('mock plugin registers an action provider and route', async () => {
    const { BackendPluginRegistry } = await import('@forgeportal/plugin-sdk');
    const pluginModule = (await import(entryUrl.href)) as {
      registerBackendPlugin: (sdk: InstanceType<typeof BackendPluginRegistry>) => void;
    };

    const registry = new BackendPluginRegistry(
      { get: () => undefined },
      { info: () => {}, warn: () => {}, error: () => {} },
    );

    pluginModule.registerBackendPlugin(registry);

    const providers = registry.getActionProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe('mock.echo');
    expect(providers[0]?.version).toBe('v1');

    const routes = registry.getBackendRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0]?.path).toBe('/status');
  });

  it('mock plugin echo action returns echoed output', async () => {
    const { BackendPluginRegistry } = await import('@forgeportal/plugin-sdk');
    const pluginModule = (await import(entryUrl.href)) as {
      registerBackendPlugin: (sdk: InstanceType<typeof BackendPluginRegistry>) => void;
    };

    const registry = new BackendPluginRegistry(
      { get: () => undefined },
      { info: () => {}, warn: () => {}, error: () => {} },
    );

    pluginModule.registerBackendPlugin(registry);

    const provider = registry.getActionProviders()[0]!;
    const result = await provider.handler({} as never, { message: 'hello' });
    expect(result.status).toBe('success');
    expect(result.outputs['echoed']).toBe('hello');
  });
});
