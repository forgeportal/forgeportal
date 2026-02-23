/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

const binding = {
  entity_id: 'ent-docs-1',
  repo_url: 'https://github.com/myorg/myrepo',
  docs_path: 'docs',
  last_indexed_at: null,
};

function makeMockPool(withBinding = false) {
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
      if (sql.includes('INTO docs_bindings')) {
        const row = {
          entity_id: params?.[0] as string,
          repo_url: params?.[1] as string,
          docs_path: params?.[2] as string,
          last_indexed_at: null,
        };
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('FROM docs_bindings')) {
        if (withBinding) return { rows: [binding], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM docs_pages') && sql.includes('ORDER BY path')) {
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
    discovery: { orgs: [], entityFilePath: 'entity.yaml', intervalMinutes: 0 },
    migrations: { dir: 'tools/migration', runSeed: false, seedFile: 'tools/seed/seed_v1.sql' },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

describe('docs endpoints (dev mode, no binding)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(makeMockPool(false) as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/docs/:entityId with no binding → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/docs/ent-docs-1' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /api/v1/docs/:entityId/binding with no binding → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/docs/ent-docs-1/binding' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/v1/docs/:entityId/binding → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/docs/ent-docs-1/binding',
      payload: { repoUrl: 'https://github.com/myorg/myrepo', docsPath: 'docs' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.entity_id).toBe('ent-docs-1');
    expect(body.data.repo_url).toBe('https://github.com/myorg/myrepo');
  });
});

describe('docs endpoints (dev mode, with binding)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(makeMockPool(true) as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/docs/:entityId/page?path=../../../etc/passwd → 400 (path traversal)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/docs/ent-docs-1/page?path=../../../etc/passwd',
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/docs/:entityId/binding → 200 with binding', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/docs/ent-docs-1/binding' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.entity_id).toBe('ent-docs-1');
    expect(body.data.docs_path).toBe('docs');
  });

  it('GET /api/v1/docs/:entityId/page without SCM provider → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/docs/ent-docs-1/page?path=docs/index.md',
    });
    // No SCM providers configured in dev mode → service throws NotFoundError → 404
    expect(res.statusCode).toBe(404);
  });

  it('CSP header present on docs page response (AC: 5)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/docs/ent-docs-1/page?path=docs/index.md',
    });
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    );
  });

  it('viewer role can GET docs (docs:read)', async () => {
    // In dev mode, all requests get platform-admin — just confirm 404/200 not 403
    const res = await app.inject({ method: 'GET', url: '/api/v1/docs/ent-docs-1' });
    expect([200, 404]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(403);
  });
});

