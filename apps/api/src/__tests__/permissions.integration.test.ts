/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

let createdPermissionId: string | undefined;

function mockPool(): unknown {
  const rows: Record<string, unknown>[] = [];

  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('INSERT INTO permissions')) {
        const newRow = {
          id: params?.[0],
          subject_ref: params?.[1],
          role: params?.[2],
          scope: JSON.parse(params?.[3] as string),
          created_at: new Date().toISOString(),
        };
        rows.push(newRow);
        createdPermissionId = newRow.id as string;
        return { rows: [newRow], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM permissions')) {
        const idx = rows.findIndex((r) => r.id === params?.[0]);
        if (idx >= 0) rows.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM permissions ORDER BY')) {
        return { rows, rowCount: rows.length };
      }
      if (sql.includes('FROM permissions WHERE')) {
        return { rows: [], rowCount: 0 };
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
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

describe('permissions admin routes (dev mode = platform-admin)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/admin/permissions lists permissions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/permissions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('data');
    expect(Array.isArray(res.json().data)).toBe(true);
  });

  it('POST /api/v1/admin/permissions creates permission', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/permissions',
      payload: { subjectRef: 'user:alice', role: 'developer' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ subject_ref: 'user:alice', role: 'developer' });
  });

  it('DELETE /api/v1/admin/permissions/:id deletes permission', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/permissions/${createdPermissionId}`,
    });
    expect(res.statusCode).toBe(204);
  });

  it('GET /api/v1/admin/permissions/roles returns role matrix', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/permissions/roles' });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data).toHaveProperty('platform-admin');
    expect(data).toHaveProperty('viewer');
    expect(Array.isArray(data['platform-admin'])).toBe(true);
  });
});

describe('permissions admin routes (OIDC mode - no admin access)', () => {
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

  it('GET /api/v1/admin/permissions returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/admin/permissions' });
    expect(res.statusCode).toBe(401);
  });
});

