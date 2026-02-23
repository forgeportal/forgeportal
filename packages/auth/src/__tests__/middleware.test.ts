/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import crypto from 'node:crypto';
import type { AppConfig } from '@forgeportal/core';
import { authGuard } from '../middleware.js';
import { SESSION_MAX_AGE } from '../session.js';

function makeConfig(oidcIssuer?: string): AppConfig {
  return {
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 5 },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: { issuer: oidcIssuer, clientId: 'id', clientSecret: 'secret' }, sessionSecret: 'test-secret-at-least-16chars' },
    scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as AppConfig;
}

function buildTestApp(config: AppConfig): FastifyInstance {
  const app = Fastify({ logger: false });
  const key = crypto.scryptSync(config.auth.sessionSecret, 'forgeportal-salt', 32);

  app.register(fastifyCookie);
  app.register(fastifySecureSession, {
    key,
    cookieName: 'forgeportal.sid',
    cookie: { path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE },
  });

  const mockPool = {
    query: async () => ({ rows: [], rowCount: 0 }),
  } as never;
  app.addHook('onRequest', authGuard(config, mockPool));

  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/api/v1/test', async (request) => ({ user: request.user, identity: request.identity }));

  return app;
}

describe('authGuard with OIDC configured', () => {
  const config = makeConfig('https://issuer.example.com');
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp(config);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('returns 401 for request without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: 'Unauthorized' });
  });

  it('allows excluded path /healthz without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('returns 200 with valid session', async () => {
    const fakeUser = { sub: 'u1', email: 'u@test.com', name: 'Test', groups: [] };
    const session = app.createSecureSession({ user: fakeUser, exp: Math.floor(Date.now() / 1000) + 3600 });
    const cookie = app.encodeSecureSession(session);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ sub: 'u1' });
  });

  it('returns 401 for expired session', async () => {
    const fakeUser = { sub: 'u1', email: 'u@test.com', name: 'Test', groups: [] };
    const session = app.createSecureSession({ user: fakeUser, exp: Math.floor(Date.now() / 1000) - 10 });
    const cookie = app.encodeSecureSession(session);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/test',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(401);
  });
});
