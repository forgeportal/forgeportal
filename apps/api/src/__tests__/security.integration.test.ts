/// <reference types="@fastify/secure-session" />
/// <reference types="@fastify/csrf-protection" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

function mockPool(): unknown {
  return {
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => {},
  };
}

function devConfig(): AppConfig {
  return {
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 5 },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: {}, sessionSecret: 'test-secret-at-least-16chars' },
    scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    docs: { maxIndexFileSizeBytes: 5 * 1024 * 1024 },
    plugins: {},
    pluginPackages: { packages: [] },
    scorecards: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

function oidcConfig(): AppConfig {
  return {
    ...devConfig(),
    auth: {
      oidc: { issuer: 'https://issuer.example.com', clientId: 'cid', clientSecret: 'csec' },
      sessionSecret: 'test-secret-at-least-16chars',
    },
  } as unknown as AppConfig;
}

describe('security headers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, devConfig());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /livez returns security headers (CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options)', async () => {
    const res = await app.inject({ method: 'GET', url: '/livez' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('GET /api/v1/auth/csrf-token returns security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf-token' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});

describe('CSRF 403 on mutating request without token (OIDC mode)', () => {
  it('POST with session but without X-CSRF-Token returns 403', async () => {
    const poolWithPerms = {
      query: async (sql: string, _params?: unknown[]) => {
        if (sql.includes('permissions')) {
          return { rows: [{ permission: 'entity:create' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      end: async () => {},
    };
    const app = buildApp(poolWithPerms as never, oidcConfig());
    await app.ready();

    const session = app.createSecureSession({
      user: { sub: 'u1', email: 'u@test.com', name: 'User', groups: [] },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const cookie = app.encodeSecureSession(session);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      cookies: { 'forgeportal.sid': cookie },
      headers: {}, // no x-csrf-token
      payload: {
        kind: 'service',
        name: 'test',
        namespace: 'default',
      },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('owner/repo validation (400)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const pool = {
      query: async (sql: string) => {
        if (sql.includes('permissions')) return { rows: [{ permission: 'entity:create' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
      end: async () => {},
    };
    app = buildApp(pool as never, devConfig());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/catalog/entities with scm.owner containing slash returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      payload: {
        kind: 'service',
        name: 'test',
        namespace: 'default',
        scm: { owner: 'org/team', repo: 'my-repo' },
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/catalog/entities with scm.repo containing backslash returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      payload: {
        kind: 'service',
        name: 'test',
        namespace: 'default',
        scm: { owner: 'org', repo: 'my\\repo' },
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
