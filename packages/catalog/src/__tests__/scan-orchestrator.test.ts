import { describe, it, expect, vi } from 'vitest';
import { runRepoScan } from '../scan-orchestrator.js';
import type { AppConfig } from '@forgeportal/core';

vi.mock('../scanner.js', () => ({
  scanOrg: vi.fn(async (opts: { org: string; provider: { name: string } }) => ({
    org: opts.org,
    provider: opts.provider.name,
    reposScanned: 5,
    entitiesCreated: 2,
    entitiesUpdated: 1,
    skipped: 2,
    errors: 0,
    duration: 100,
  })),
}));

const noopLogger: Record<string, unknown> = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
  fatal: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'info',
};

function makeConfig(orgs: AppConfig['discovery']['orgs']): AppConfig {
  return {
    discovery: {
      orgs,
      entityFilePath: 'entity.yaml',
      intervalMinutes: 0,
    },
  } as AppConfig;
}

function makeProviders(available: string[]) {
  const ghProvider = { name: 'github' };
  const glProvider = { name: 'gitlab' };
  return {
    github: available.includes('github') ? ghProvider : null,
    gitlab: available.includes('gitlab') ? glProvider : null,
    all: () => [
      ...(available.includes('github') ? [ghProvider] : []),
      ...(available.includes('gitlab') ? [glProvider] : []),
    ],
    get: (name: string) => {
      if (name === 'github' && available.includes('github')) return ghProvider;
      if (name === 'gitlab' && available.includes('gitlab')) return glProvider;
      return null;
    },
  };
}

describe('runRepoScan', () => {
  it('multiple orgs → scans each with correct provider', async () => {
    const config = makeConfig([
      { provider: 'github', org: 'gh-org' },
      { provider: 'gitlab', org: 'gl-group' },
    ]);
    const providers = makeProviders(['github', 'gitlab']);

    const results = await runRepoScan({
      config,
      pool: {} as never,
      scmProviders: providers as never,
      logger: noopLogger as never,
    });
    expect(results).toHaveLength(2);
    expect(results[0].org).toBe('gh-org');
    expect(results[1].org).toBe('gl-group');
  });

  it('missing provider → skips with warning', async () => {
    const config = makeConfig([
      { provider: 'gitlab', org: 'gl-group' },
    ]);
    const providers = makeProviders(['github']);

    const results = await runRepoScan({
      config,
      pool: {} as never,
      scmProviders: providers as never,
      logger: noopLogger as never,
    });
    expect(results).toHaveLength(0);
    expect(noopLogger['warn'] as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it('returns combined results', async () => {
    const config = makeConfig([
      { provider: 'github', org: 'org-a' },
      { provider: 'github', org: 'org-b' },
    ]);
    const providers = makeProviders(['github']);

    const results = await runRepoScan({
      config,
      pool: {} as never,
      scmProviders: providers as never,
      logger: noopLogger as never,
    });
    expect(results).toHaveLength(2);
    const totalCreated = results.reduce((s, r) => s + r.entitiesCreated, 0);
    expect(totalCreated).toBe(4);
  });
});
