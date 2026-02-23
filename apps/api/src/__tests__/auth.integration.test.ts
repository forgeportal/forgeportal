/// <reference types="@fastify/secure-session" />
/// <reference types="@fastify/csrf-protection" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

function mockPool(): unknown {
  return {
    query: async (sql: string) => {
      if (sql.includes('permissions')) return { rows: [], rowCount: 0 };
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    },
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
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

describe('auth integration (dev mode)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/auth/me returns dev user with platform-admin role', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(200);
    const { user } = res.json();
    expect(user).toMatchObject({ sub: 'dev-user', email: 'dev@forgeportal.local', role: 'platform-admin' });
    expect(user.permissions).toBeInstanceOf(Array);
    expect(user.permissions.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/auth/login returns 501 in dev mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/login' });
    expect(res.statusCode).toBe(501);
  });

  it('POST /api/v1/auth/logout returns success', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('GET /healthz passes without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /livez passes without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/livez' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/v1/auth/csrf-token returns a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf-token' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('token');
    expect(typeof res.json().token).toBe('string');
  });
});

describe('auth integration (OIDC configured - no session)', () => {
  let app: FastifyInstance;

  function oidcConfig(): AppConfig {
    return {
      ...devConfig(),
      auth: {
        oidc: { issuer: 'https://issuer.example.com', clientId: 'cid', clientSecret: 'csec' },
        sessionSecret: 'test-secret-at-least-16chars',
      },
    } as unknown as AppConfig;
  }

  beforeAll(async () => {
    app = buildApp(mockPool() as never, oidcConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/auth/me returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /healthz still passes', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/v1/auth/csrf-token returns 401 without session in OIDC mode', async () => {
    const getRes = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf-token' });
    expect(getRes.statusCode).toBe(401);
  });
});

