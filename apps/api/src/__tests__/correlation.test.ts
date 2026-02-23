import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mockPool(): unknown {
  return {
    query: async () => ({ rows: [{ '?column?': 1 }] }),
    end: async () => {},
  };
}

function minimalConfig(): AppConfig {
  return {
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 5 },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: {}, sessionSecret: 'test-session-secret-1234' },
    scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

describe('correlation ID', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, minimalConfig());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates X-Request-Id when not provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/livez' });
    const reqId = res.headers['x-request-id'] as string;
    expect(reqId).toBeDefined();
    expect(reqId).toMatch(UUID_RE);
  });

  it('propagates X-Request-Id from incoming header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/livez',
      headers: { 'x-request-id': 'my-id-123' },
    });
    expect(res.headers['x-request-id']).toBe('my-id-123');
  });

  it('returns 200 with propagated X-Request-Id on livez', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/livez',
      headers: { 'x-request-id': 'trace-456' },
    });
    expect(res.headers['x-request-id']).toBe('trace-456');
    expect(res.statusCode).toBe(200);
  });
});

