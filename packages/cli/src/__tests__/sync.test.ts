import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, vi } from 'vitest';
import { syncCommand } from '../commands/sync.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpRepo(opts: {
  configPlugins?: string[];
  apiDeps?: Record<string, string>;
  uiDeps?:  Record<string, string>;
  workspacePlugins?: Array<{ name: string; type: 'ui' | 'backend' | 'fullstack'; version?: string }>;
}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sync-test-'));

  // forgeportal.yaml
  const pluginList = opts.configPlugins?.map((p) => `    - "${p}"`).join('\n') ?? '';
  fs.writeFileSync(path.join(root, 'forgeportal.yaml'), `
pluginPackages:
  packages:
${pluginList}
`.trimStart());

  // apps/api/package.json
  const apiDir = path.join(root, 'apps', 'api');
  fs.mkdirSync(apiDir, { recursive: true });
  fs.writeFileSync(path.join(apiDir, 'package.json'), JSON.stringify({
    name: '@forgeportal/api',
    dependencies: opts.apiDeps ?? {},
  }, null, 2));

  // apps/ui/package.json
  const uiDir = path.join(root, 'apps', 'ui');
  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(path.join(uiDir, 'package.json'), JSON.stringify({
    name: '@forgeportal/ui',
    dependencies: opts.uiDeps ?? {},
  }, null, 2));

  // workspace plugins (simulate packages/ directory)
  for (const plugin of opts.workspacePlugins ?? []) {
    const pluginDir = path.join(root, 'packages', plugin.name.replace('@forgeportal/', ''));
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({
      name: plugin.name,
      version: plugin.version ?? '1.0.0',
    }, null, 2));
    fs.writeFileSync(path.join(pluginDir, 'forgeportal-plugin.json'), JSON.stringify({
      version: plugin.version ?? '1.0.0',
      forgeportal: { type: plugin.type },
    }, null, 2));
  }

  return root;
}

function readDeps(root: string, app: 'api' | 'ui'): Record<string, string> {
  const pkgPath = path.join(root, 'apps', app, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string> };
  return pkg.dependencies ?? {};
}

// ─── Mock execSync so pnpm install doesn't run in tests ──────────────────────

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:child_process')>();
  return {
    ...original,
    execSync: vi.fn((cmd: string, _opts?: unknown) => {
      if (String(cmd).startsWith('pnpm install')) return '';
      // Pass npm view to the original (we mock it per-test when needed)
      throw new Error(`Unexpected execSync: ${cmd}`);
    }),
  };
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('forge sync — workspace plugin', () => {
  it('adds a fullstack plugin to both api and ui', async () => {
    const root = makeTmpRepo({
      configPlugins:     ['@forgeportal/plugin-kubernetes'],
      workspacePlugins:  [{ name: '@forgeportal/plugin-kubernetes', type: 'fullstack' }],
    });

    const result = await syncCommand({ root, ci: true });

    expect(result.changed).toBe(true);
    expect(result.apiAdded).toContain('@forgeportal/plugin-kubernetes');
    expect(result.uiAdded).toContain('@forgeportal/plugin-kubernetes');
    expect(readDeps(root, 'api')['@forgeportal/plugin-kubernetes']).toBe('workspace:*');
    expect(readDeps(root, 'ui')['@forgeportal/plugin-kubernetes']).toBe('workspace:*');
  });

  it('adds a backend-only plugin only to api', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-backend-only'],
      workspacePlugins: [{ name: '@forgeportal/plugin-backend-only', type: 'backend' }],
    });

    await syncCommand({ root, ci: true });

    expect(readDeps(root, 'api')['@forgeportal/plugin-backend-only']).toBe('workspace:*');
    expect(readDeps(root, 'ui')['@forgeportal/plugin-backend-only']).toBeUndefined();
  });

  it('adds a ui-only plugin only to ui', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-ui-only'],
      workspacePlugins: [{ name: '@forgeportal/plugin-ui-only', type: 'ui' }],
    });

    await syncCommand({ root, ci: true });

    expect(readDeps(root, 'api')['@forgeportal/plugin-ui-only']).toBeUndefined();
    expect(readDeps(root, 'ui')['@forgeportal/plugin-ui-only']).toBe('workspace:*');
  });

  it('removes a plugin no longer in forgeportal.yaml', async () => {
    const root = makeTmpRepo({
      configPlugins: [],
      apiDeps: { '@forgeportal/plugin-old': '^1.0.0' },
      uiDeps:  { '@forgeportal/plugin-old': '^1.0.0' },
    });
    // forgeportal.yaml has no plugins now
    fs.writeFileSync(path.join(root, 'forgeportal.yaml'), 'pluginPackages:\n  packages: []\n');

    await syncCommand({ root, ci: true });

    expect(readDeps(root, 'api')['@forgeportal/plugin-old']).toBeUndefined();
    expect(readDeps(root, 'ui')['@forgeportal/plugin-old']).toBeUndefined();
  });

  it('does not touch non-plugin deps when removing', async () => {
    const root = makeTmpRepo({
      configPlugins: [],
      apiDeps: {
        'express':                      '^4.18.0',
        '@forgeportal/plugin-old':      '^1.0.0',
        '@forgeportal/core':            '^1.0.0',
      },
    });
    fs.writeFileSync(path.join(root, 'forgeportal.yaml'), 'pluginPackages:\n  packages: []\n');

    await syncCommand({ root, ci: true });

    const deps = readDeps(root, 'api');
    expect(deps['express']).toBe('^4.18.0');
    expect(deps['@forgeportal/core']).toBe('^1.0.0');
    expect(deps['@forgeportal/plugin-old']).toBeUndefined();
  });

  it('returns changed:false when already in sync', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-kubernetes'],
      apiDeps:          { '@forgeportal/plugin-kubernetes': 'workspace:*' },
      uiDeps:           { '@forgeportal/plugin-kubernetes': 'workspace:*' },
      workspacePlugins: [{ name: '@forgeportal/plugin-kubernetes', type: 'fullstack' }],
    });

    const result = await syncCommand({ root, ci: true });
    expect(result.changed).toBe(false);
  });
});

describe('forge sync --dry-run', () => {
  it('does not modify package.json files', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-kubernetes'],
      workspacePlugins: [{ name: '@forgeportal/plugin-kubernetes', type: 'fullstack' }],
    });

    const before = JSON.stringify(readDeps(root, 'api'));
    await syncCommand({ root, dryRun: true });
    expect(JSON.stringify(readDeps(root, 'api'))).toBe(before);
  });

  it('reports changed:true without writing', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-kubernetes'],
      workspacePlugins: [{ name: '@forgeportal/plugin-kubernetes', type: 'fullstack' }],
    });

    const result = await syncCommand({ root, dryRun: true });
    expect(result.changed).toBe(true);
    expect(readDeps(root, 'api')['@forgeportal/plugin-kubernetes']).toBeUndefined();
  });
});

describe('forge sync --check', () => {
  it('exits 1 when out of sync', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-kubernetes'],
      workspacePlugins: [{ name: '@forgeportal/plugin-kubernetes', type: 'fullstack' }],
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string | null) => {
      throw new Error(`process.exit(${_code})`);
    });

    await expect(syncCommand({ root, check: true })).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('exits 0 when in sync', async () => {
    const root = makeTmpRepo({
      configPlugins:    ['@forgeportal/plugin-kubernetes'],
      apiDeps:          { '@forgeportal/plugin-kubernetes': 'workspace:*' },
      uiDeps:           { '@forgeportal/plugin-kubernetes': 'workspace:*' },
      workspacePlugins: [{ name: '@forgeportal/plugin-kubernetes', type: 'fullstack' }],
    });

    const result = await syncCommand({ root, check: true });
    expect(result.changed).toBe(false);
  });
});

describe('forge sync — no forgeportal.yaml', () => {
  it('returns empty result gracefully when no yaml exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-sync-noconfig-'));
    const result = await syncCommand({ root, ci: true });
    expect(result.changed).toBe(false);
  });
});
