/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

const entityRow = {
  id: 'entity-search-1',
  title: 'orders-service',
  kind: 'Service',
  namespace: 'default',
  owner_ref: 'team:platform',
  lifecycle: 'production',
  score: '0.76',
  excerpt: 'The <b>orders</b> service',
};

const docRow = {
  id: 'doc-search-1',
  title: 'Orders Guide',
  entity_id: 'entity-search-1',
  path: 'docs/orders.md',
  score: '0.55',
  excerpt: '<b>orders</b> guide content',
};

function makeMockPool() {
  return {
    query: async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM entities e') && sql.includes('search_tsv')) {
        return { rows: [entityRow], rowCount: 1 };
      }
      if (sql.includes('FROM docs_pages dp') && sql.includes('content_tsv')) {
        return { rows: [docRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

function makeEntitiesOnlyPool() {
  return {
    query: async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM entities e') && sql.includes('search_tsv')) {
        return { rows: [entityRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

function makeDocsOnlyPool() {
  return {
    query: async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
      if (sql.includes('FROM docs_pages dp') && sql.includes('content_tsv')) {
        return { rows: [docRow], rowCount: 1 };
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

describe('search endpoint (dev mode)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(makeMockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/v1/search?q=test → 200 with data + pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=test',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.pagination).toMatchObject({ offset: 0, limit: 20 });
    expect(body.query).toBe('test');
    expect(body.scope).toBe('all');
  });

  it('GET /api/v1/search (no q) → 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('Bad Request');
  });

  it('GET /api/v1/search?q=&scope=entities → 400 (empty q)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=&scope=entities',
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/search?q=test&limit=5&offset=0 → max 5 results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=test&limit=5&offset=0',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.pagination.limit).toBe(5);
  });

  it('response has Cache-Control: private, max-age=10 header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=test',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=10');
  });

  it('rate limit — 60+ requests in 1 minute → 429 + Retry-After', async () => {
    const rateApp = buildApp(makeMockPool() as never, devConfig(), null);
    await rateApp.ready();

    for (let i = 0; i < 60; i++) {
      const r = await rateApp.inject({
        method: 'GET',
        url: '/api/v1/search?q=test',
      });
      expect(r.statusCode).toBe(200);
    }
    const res = await rateApp.inject({
      method: 'GET',
      url: '/api/v1/search?q=test',
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    const retryAfter = parseInt(res.headers['retry-after'] as string, 10);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    await rateApp.close();
  });
});

describe('search endpoint — scope filtering', () => {
  it('GET /api/v1/search?q=test&scope=entities → only entity type results', async () => {
    const entApp = buildApp(makeEntitiesOnlyPool() as never, devConfig(), null);
    await entApp.ready();

    const res = await entApp.inject({
      method: 'GET',
      url: '/api/v1/search?q=test&scope=entities',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.every((r: { type: string }) => r.type === 'entity')).toBe(true);

    await entApp.close();
  });

  it('GET /api/v1/search?q=test&scope=docs → only doc type results', async () => {
    const docsApp = buildApp(makeDocsOnlyPool() as never, devConfig(), null);
    await docsApp.ready();

    const res = await docsApp.inject({
      method: 'GET',
      url: '/api/v1/search?q=test&scope=docs',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.every((r: { type: string }) => r.type === 'doc')).toBe(true);

    await docsApp.close();
  });
});

