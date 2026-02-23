/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import crypto from 'node:crypto';
import type { AppConfig } from '@forgeportal/core';
import { authGuard } from '../middleware.js';
import { authRoutes } from '../routes.js';
import { SESSION_MAX_AGE, DEV_USER } from '../session.js';

function devConfig(): AppConfig {
  return {
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 5 },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: {}, sessionSecret: 'test-secret-at-least-16chars' },
    scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as AppConfig;
}

describe('dev mode (OIDC not configured)', () => {
  let app: FastifyInstance;
  const config = devConfig();

  beforeAll(async () => {
    app = Fastify({ logger: false });
    const key = crypto.scryptSync(config.auth.sessionSecret, 'forgeportal-salt', 32);

    app.register(fastifyCookie);
    app.register(fastifySecureSession, {
      key,
      cookieName: 'forgeportal.sid',
      cookie: { path: '/', httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE },
    });

    app.addHook('onRequest', authGuard(config, null as never));
    app.register(authRoutes, { config, oidcConfig: null });

    app.get('/api/v1/test', async (request) => ({ user: request.user }));

    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('injects dev user on all requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/test' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ sub: 'dev-user', email: 'dev@forgeportal.local' });
  });

  it('/api/v1/auth/me returns dev user with platform-admin role', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(200);
    const { user } = res.json();
    expect(user).toMatchObject({ sub: 'dev-user', email: 'dev@forgeportal.local', role: 'platform-admin' });
    expect(user.permissions.length).toBeGreaterThan(0);
  });

  it('/api/v1/auth/login returns 501', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/login' });
    expect(res.statusCode).toBe(501);
  });
});
