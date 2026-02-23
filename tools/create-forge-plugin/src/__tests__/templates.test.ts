import { describe, it, expect } from 'vitest';
import { deriveNames } from '../names.js';
import {
  genManifest, genPackageJson, genTsConfig,
  genUiIndex, genUiTab,
  genBackendIndex, genBackendAction,
  genFullstackUiIndex,
} from '../templates.js';

const pdNames   = deriveNames('pagerduty', '@acme');
const multiNames = deriveNames('my-plugin');

describe('genManifest', () => {
  it('UI type — no backend capabilities', () => {
    const manifest = JSON.parse(genManifest(pdNames, 'ui')) as {
      name: string;
      forgeportal: {
        engineVersion: string;
        type: string;
        capabilities: { ui?: { entityTabs: string[] }; backend?: unknown };
      };
    };
    expect(manifest.name).toBe('@acme/forge-plugin-pagerduty');
    expect(manifest.forgeportal.engineVersion).toBe('^1.0.0');
    expect(manifest.forgeportal.type).toBe('ui');
    expect(manifest.forgeportal.capabilities.ui?.entityTabs).toContain('pagerduty-tab');
    expect(manifest.forgeportal.capabilities.backend).toBeUndefined();
  });

  it('backend type — no UI capabilities', () => {
    const manifest = JSON.parse(genManifest(pdNames, 'backend')) as {
      forgeportal: {
        type: string;
        capabilities: { backend?: { actionProviders: string[] }; ui?: unknown };
      };
    };
    expect(manifest.forgeportal.type).toBe('backend');
    expect(manifest.forgeportal.capabilities.backend?.actionProviders).toContain('pagerduty.myAction@v1');
    expect(manifest.forgeportal.capabilities.ui).toBeUndefined();
  });

  it('fullstack type — both capabilities', () => {
    const manifest = JSON.parse(genManifest(pdNames, 'fullstack')) as {
      forgeportal: {
        type: string;
        capabilities: { ui?: unknown; backend?: unknown };
      };
    };
    expect(manifest.forgeportal.type).toBe('fullstack');
    expect(manifest.forgeportal.capabilities.ui).toBeDefined();
    expect(manifest.forgeportal.capabilities.backend).toBeDefined();
  });

  it('output is valid JSON', () => {
    expect(() => JSON.parse(genManifest(pdNames, 'ui'))).not.toThrow();
    expect(() => JSON.parse(genManifest(pdNames, 'backend'))).not.toThrow();
    expect(() => JSON.parse(genManifest(pdNames, 'fullstack'))).not.toThrow();
  });
});

describe('genPackageJson', () => {
  it('UI plugin has react peer dep', () => {
    const pkg = JSON.parse(genPackageJson(pdNames, 'ui')) as {
      peerDependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.peerDependencies['@forgeportal/plugin-sdk']).toBe('^1.0.0');
    expect(pkg.peerDependencies['react']).toBeDefined();
    expect(pkg.devDependencies['fastify']).toBeUndefined();
  });

  it('backend plugin has fastify dev dep, no react', () => {
    const pkg = JSON.parse(genPackageJson(pdNames, 'backend')) as {
      peerDependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies['fastify']).toBeDefined();
    expect(pkg.devDependencies['react']).toBeUndefined();
    expect(pkg.peerDependencies['react']).toBeUndefined();
  });

  it('fullstack plugin has both react and fastify', () => {
    const pkg = JSON.parse(genPackageJson(pdNames, 'fullstack')) as {
      peerDependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.peerDependencies['react']).toBeDefined();
    expect(pkg.devDependencies['fastify']).toBeDefined();
  });

  it('package name is correctly set', () => {
    const pkg = JSON.parse(genPackageJson(pdNames, 'ui')) as { name: string };
    expect(pkg.name).toBe('@acme/forge-plugin-pagerduty');
  });

  it('no org: package name without scope', () => {
    const pkg = JSON.parse(genPackageJson(multiNames, 'ui')) as { name: string };
    expect(pkg.name).toBe('forge-plugin-my-plugin');
  });
});

describe('genTsConfig', () => {
  it('UI tsconfig has jsx: react-jsx', () => {
    const tsc = JSON.parse(genTsConfig('ui')) as { compilerOptions: { jsx?: string } };
    expect(tsc.compilerOptions.jsx).toBe('react-jsx');
  });

  it('backend tsconfig has no jsx', () => {
    const tsc = JSON.parse(genTsConfig('backend')) as { compilerOptions: { jsx?: string } };
    expect(tsc.compilerOptions.jsx).toBeUndefined();
  });

  it('fullstack tsconfig has jsx: react-jsx', () => {
    const tsc = JSON.parse(genTsConfig('fullstack')) as { compilerOptions: { jsx?: string } };
    expect(tsc.compilerOptions.jsx).toBe('react-jsx');
  });
});

describe('genUiIndex', () => {
  it('exports registerPlugin function', () => {
    const src = genUiIndex(pdNames);
    expect(src).toContain('export function registerPlugin(sdk: ForgePluginSDK)');
    expect(src).toContain("import type { ForgePluginSDK } from '@forgeportal/plugin-sdk'");
    expect(src).toContain("id:        'pagerduty-tab'");
  });

  it('imports correct component', () => {
    const src = genUiIndex(pdNames);
    expect(src).toContain('import { PagerdutyTab }');
  });
});

describe('genUiTab', () => {
  it('uses useEntity hook', () => {
    const src = genUiTab(pdNames);
    expect(src).toContain("import { useEntity, useConfig }");
    expect(src).toContain("from '@forgeportal/plugin-sdk/react'");
    expect(src).toContain('const { entity }     = useEntity()');
    expect(src).toContain('export function PagerdutyTab()');
  });

  it('uses correct component name for multi-segment', () => {
    const src = genUiTab(multiNames);
    expect(src).toContain('export function MyPluginTab()');
  });
});

describe('genBackendIndex', () => {
  it('exports registerBackendPlugin function', () => {
    const src = genBackendIndex(pdNames);
    expect(src).toContain('export function registerBackendPlugin(sdk: ForgeBackendPluginSDK)');
    expect(src).toContain("import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk'");
  });

  it('registers the action provider', () => {
    const src = genBackendIndex(pdNames);
    expect(src).toContain('sdk.registerActionProvider(pagerdutyAction)');
  });

  it('registers a backend route', () => {
    const src = genBackendIndex(pdNames);
    expect(src).toContain("path: '/status'");
    expect(src).toContain('sdk.registerBackendRoute(');
  });
});

describe('genBackendAction', () => {
  it('has correct action id and version', () => {
    const src = genBackendAction(pdNames);
    expect(src).toContain("id:      'pagerduty.myAction'");
    expect(src).toContain("version: 'v1'");
  });

  it('handler is async', () => {
    const src = genBackendAction(pdNames);
    expect(src).toContain('async handler(ctx, input)');
  });

  it('uses ctx.logger', () => {
    const src = genBackendAction(pdNames);
    expect(src).toContain('ctx.logger.info');
  });
});

describe('genFullstackUiIndex', () => {
  it('exports registerPlugin (not registerBackendPlugin)', () => {
    const src = genFullstackUiIndex(pdNames);
    expect(src).toContain('export function registerPlugin(sdk: ForgePluginSDK)');
    expect(src).not.toContain('registerBackendPlugin');
  });
});
