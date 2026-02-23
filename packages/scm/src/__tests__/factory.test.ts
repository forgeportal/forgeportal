import { describe, it, expect, vi } from 'vitest';
import type { AppConfig } from '@forgeportal/core';
import { createSCMProviders } from '../factory.js';

vi.mock('../github.js', () => ({
  GitHubProvider: vi.fn().mockImplementation((opts) => ({
    name: 'github',
    _opts: opts,
  })),
}));

vi.mock('../gitlab.js', () => ({
  GitLabProvider: vi.fn().mockImplementation((opts) => ({
    name: 'gitlab',
    _opts: opts,
  })),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue('-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----'),
  },
}));

function baseConfig(overrides?: Partial<{ github: Record<string, unknown>; gitlab: Record<string, unknown> }>): AppConfig {
  return {
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 5 },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'info' },
    auth: { oidc: {}, sessionSecret: 'test-secret-at-least-16chars' },
    scm: {
      github: { ...(overrides?.github ?? {}) } as AppConfig['scm']['github'],
      gitlab: {
        baseUrl: 'https://gitlab.com',
        ...(overrides?.gitlab ?? {}),
      } as AppConfig['scm']['gitlab'],
    },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as AppConfig;
}

describe('createSCMProviders', () => {
  it('config with GitHub App → creates GitHubProvider', async () => {
    const config = baseConfig({
      github: { appId: '123', privateKeyPath: '/secrets/key.pem' },
    });
    const providers = await createSCMProviders(config);
    expect(providers.github).not.toBeNull();
    expect(providers.gitlab).toBeNull();
    expect(providers.all()).toHaveLength(1);
  });

  it('config with GitLab token → creates GitLabProvider', async () => {
    const config = baseConfig({
      gitlab: { token: 'glpat-test' },
    });
    const providers = await createSCMProviders(config);
    expect(providers.gitlab).not.toBeNull();
    expect(providers.github).toBeNull();
  });

  it('config with both → creates both providers', async () => {
    const config = baseConfig({
      github: { token: 'ghp_test' },
      gitlab: { token: 'glpat-test' },
    });
    const providers = await createSCMProviders(config);
    expect(providers.github).not.toBeNull();
    expect(providers.gitlab).not.toBeNull();
    expect(providers.all()).toHaveLength(2);
  });

  it('config with neither → returns nulls, all() is empty', async () => {
    const config = baseConfig();
    const providers = await createSCMProviders(config);
    expect(providers.github).toBeNull();
    expect(providers.gitlab).toBeNull();
    expect(providers.all()).toHaveLength(0);
  });

  it('get("github") returns correct provider', async () => {
    const config = baseConfig({
      github: { token: 'ghp_test' },
      gitlab: { token: 'glpat-test' },
    });
    const providers = await createSCMProviders(config);
    expect(providers.get('github')).toBe(providers.github);
    expect(providers.get('gitlab')).toBe(providers.gitlab);
  });
});
