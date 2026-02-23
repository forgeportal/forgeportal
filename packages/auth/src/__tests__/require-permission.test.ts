/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import crypto from 'node:crypto';
import type { AppConfig } from '@forgeportal/core';
import { authGuard } from '../middleware.js';
import { requirePermission, requireOwnership } from '../require-permission.js';
import { SESSION_MAX_AGE } from '../session.js';

function makeConfig(): AppConfig {
  return {
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 5 },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: { issuer: 'https://issuer.example.com', clientId: 'id', clientSecret: 'secret' }, sessionSecret: 'test-secret-at-least-16chars' },
    scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as AppConfig;
}

interface MockPoolOpts {
  userRoles?: Record<string, { role: string; scope: Record<string, unknown> }>;
}

function makeMockPool(opts: MockPoolOpts = {}) {
  return {
    query: async (_sql: string, params?: unknown[]) => {
      const ref = params?.[0] as string | undefined;
      if (ref && opts.userRoles?.[ref]) {
        return { rows: [opts.userRoles[ref]], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as never;
}

function buildApp(ownerRef: string = 'team:backend', pool = makeMockPool()): FastifyInstance {
  const config = makeConfig();
  const app = Fastify({ logger: false });
  const key = crypto.scryptSync(config.auth.sessionSecret, 'forgeportal-salt', 32);

  app.register(fastifyCookie);
  app.register(fastifySecureSession, {
    key,
    cookieName: 'forgeportal.sid',
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE },
  });

  app.addHook('onRequest', authGuard(config, pool));

  app.post('/api/v1/actions/:id/run', {
    preHandler: [requirePermission('action:run')],
  }, async () => ({ status: 'ok' }));

  app.put('/api/v1/entities/:id', {
    preHandler: [
      requirePermission('entity:update'),
      requireOwnership(async () => ownerRef),
    ],
  }, async () => ({ status: 'updated' }));

  return app;
}

function injectSession(app: FastifyInstance, user: Record<string, unknown>) {
  const session = app.createSecureSession({
    user,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return app.encodeSecureSession(session);
}

describe('requirePermission', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('developer with action:run passes', async () => {
    const cookie = injectSession(app, { sub: 'u1', email: 'u@test.com', name: 'Test', groups: [] });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/actions/123/run',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(200);
  });

  it('viewer without action:run gets 403', async () => {
    const pool = makeMockPool({
      userRoles: { 'user:viewer1': { role: 'viewer', scope: {} } },
    });
    const viewerApp = buildApp('team:backend', pool);
    await viewerApp.ready();

    const cookie = injectSession(viewerApp, { sub: 'viewer1', email: 'v@test.com', name: 'Viewer', groups: [] });
    const res = await viewerApp.inject({
      method: 'POST',
      url: '/api/v1/actions/123/run',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'Forbidden', message: 'Missing permission: action:run' });

    await viewerApp.close();
  });

  it('no session returns 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/actions/123/run' });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireOwnership', () => {
  it('platform-admin bypasses ownership check', async () => {
    const app = buildApp();
    await app.ready();

    const cookie = injectSession(app, { sub: 'admin', email: 'a@test.com', name: 'Admin', groups: ['platform-admin'] });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/entities/e1',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  it('developer gets 403 (entity:update not in developer perms)', async () => {
    const app = buildApp();
    await app.ready();

    const cookie = injectSession(app, { sub: 'dev1', email: 'd@test.com', name: 'Dev', groups: [] });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/entities/e1',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('team-admin with matching team passes ownership check', async () => {
    const pool = makeMockPool({
      userRoles: { 'user:ta1': { role: 'team-admin', scope: { teams: ['backend'] } } },
    });
    const app = buildApp('team:backend', pool);
    await app.ready();

    const cookie = injectSession(app, { sub: 'ta1', email: 'ta@test.com', name: 'TeamAdmin', groups: ['backend'] });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/entities/e1',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  it('team-admin with different team gets 403', async () => {
    const pool = makeMockPool({
      userRoles: { 'user:ta2': { role: 'team-admin', scope: { teams: ['frontend'] } } },
    });
    const app = buildApp('team:backend', pool);
    await app.ready();

    const cookie = injectSession(app, { sub: 'ta2', email: 'ta2@test.com', name: 'TeamAdmin2', groups: ['frontend'] });
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/entities/e1',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'Forbidden', message: 'You can only modify entities owned by your team' });

    await app.close();
  });

  it('no session returns 401', async () => {
    const app = buildApp();
    await app.ready();

    const res = await app.inject({ method: 'PUT', url: '/api/v1/entities/e1' });
    expect(res.statusCode).toBe(401);

    await app.close();
  });
});
