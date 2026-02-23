import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

function mockPool(): unknown {
  return {
    query: async () => ({ rows: [{ count: '0', '?column?': 1 }] }),
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

describe('GET /metrics', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, minimalConfig());
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with Prometheus content-type', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.headers['content-type']).toMatch(/version=0\.0\.4/);
  });

  it('includes default process metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toContain('process_cpu_seconds_total');
    expect(res.body).toContain('nodejs_heap_size_total_bytes');
  });

  it('includes custom HTTP request duration histogram', async () => {
    // Trigger a request first so the histogram has samples
    await app.inject({ method: 'GET', url: '/livez' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toContain('http_request_duration_seconds');
  });

  it('includes action_run_queue_depth gauge', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toContain('action_run_queue_depth');
  });

  it('includes http_errors_total counter', async () => {
    // Trigger a 404 to populate the counter
    await app.inject({ method: 'GET', url: '/nonexistent-route-xyz' });
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.body).toContain('http_errors_total');
  });
});
