/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

function mockPool(): unknown {
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO jobs')) {
        return {
          rows: [{
            id: 'job-123',
            type: params?.[0],
            payload: JSON.parse((params?.[1] as string) ?? '{}'),
            status: 'queued',
            locked_by: null,
            locked_at: null,
            created_at: new Date(),
            finished_at: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM jobs WHERE type = $1 ORDER BY')) {
        return {
          rows: [{
            id: 'job-123',
            type: 'repo-scan',
            payload: {},
            status: 'success',
            locked_by: 'worker-1',
            locked_at: new Date(),
            created_at: new Date(),
            finished_at: new Date(),
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
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
    discovery: { orgs: [], entityFilePath: 'entity.yaml', intervalMinutes: 0 },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

describe('scan admin endpoints (dev mode)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/v1/admin/scan → 202 with jobId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/scan',
      payload: {},
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.jobId).toBe('job-123');
    expect(body.status).toBe('queued');
  });

  it('GET /api/v1/admin/scan/status → 200 with latest job', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/scan/status',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job).not.toBeNull();
    expect(body.job.type).toBe('repo-scan');
    expect(body.job.status).toBe('success');
  });

  it('developer role → 403 on admin scan (OIDC)', async () => {
    function viewerPool(): unknown {
      return {
        query: async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
          if (sql.includes('FROM permissions WHERE') && sql.includes('subject_ref = $1')) {
            const ref = params?.[0] as string;
            if (ref === 'user:dev1') return { rows: [{ role: 'developer', scope: {} }], rowCount: 1 };
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 0 };
        },
        end: async () => {},
      };
    }

    const oidcConfig: AppConfig = {
      ...devConfig(),
      auth: {
        oidc: { issuer: 'https://issuer.example.com', clientId: 'cid', clientSecret: 'csec' },
        sessionSecret: 'test-secret-at-least-16chars',
      },
    } as unknown as AppConfig;

    const oidcApp = buildApp(viewerPool() as never, oidcConfig, null);
    await oidcApp.ready();

    const session = oidcApp.createSecureSession({
      user: { sub: 'dev1', email: 'd@test.com', name: 'Dev', groups: [] },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const cookie = oidcApp.encodeSecureSession(session);

    const csrfRes = await oidcApp.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
      cookies: { 'forgeportal.sid': cookie },
    });
    const csrfToken = csrfRes.json().token as string;
    const updatedCookie = csrfRes.cookies.find(
      (c: { name: string }) => c.name === 'forgeportal.sid',
    )?.value ?? cookie;

    const res = await oidcApp.inject({
      method: 'POST',
      url: '/api/v1/admin/scan',
      cookies: { 'forgeportal.sid': updatedCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    await oidcApp.close();
  });
});

