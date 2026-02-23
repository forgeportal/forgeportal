/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

const entityStore: Record<string, Record<string, unknown>> = {};
let entityCounter = 0;

function mockPool(): unknown {
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT 1')) {
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      }
      if (sql.includes('FROM permissions WHERE')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO entities')) {
        const id = params?.[0] as string;
        const existingKey = `${params?.[1]}/${params?.[2]}/${params?.[3]}`;
        const duplicate = Object.values(entityStore).find(
          (e) =>
            `${e['kind']}/${e['namespace']}/${e['name']}` === existingKey,
        );
        if (duplicate) {
          const err = new Error('unique_violation') as Error & { code: string };
          err.code = '23505';
          throw err;
        }
        const now = new Date();
        const entity = {
          id,
          kind: params?.[1],
          namespace: params?.[2],
          name: params?.[3],
          owner_ref: params?.[4] ?? null,
          lifecycle: params?.[5] ?? null,
          tags: JSON.parse((params?.[6] as string) ?? '[]'),
          links: JSON.parse((params?.[7] as string) ?? '[]'),
          scm: JSON.parse((params?.[8] as string) ?? '{}'),
          spec: JSON.parse((params?.[9] as string) ?? '{}'),
          created_at: now,
          updated_at: now,
        };
        entityStore[id] = entity;
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('FROM entities WHERE id = $1')) {
        const id = params?.[0] as string;
        const entity = entityStore[id];
        if (!entity) return { rows: [], rowCount: 0 };
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM entities WHERE id = $1')) {
        const id = params?.[0] as string;
        if (entityStore[id]) {
          delete entityStore[id];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('UPDATE entities SET')) {
        const idParam = params?.[params.length - 1] as string;
        const entity = entityStore[idParam];
        if (!entity) return { rows: [], rowCount: 0 };
        entity['updated_at'] = new Date();
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('FROM entities') && sql.includes('COUNT(*)')) {
        const all = Object.values(entityStore);
        const total = all.length;
        const rows = all.map((e) => ({ ...e, total }));
        return { rows, rowCount: rows.length };
      }
      if (sql.includes('FROM entity_relations')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM entity_sources')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

function devConfig(): AppConfig {
  return {
    db: {
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
      maxPoolSize: 5,
    },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: {}, sessionSecret: 'test-secret-at-least-16chars' },
    scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
    migrations: {
      dir: 'tools/migration',
      runSeed: false,
      seedFile: 'tools/seed/seed_v1.sql',
    },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

describe('catalog CRUD integration (dev mode)', () => {
  let app: FastifyInstance;
  let createdId: string;

  beforeAll(async () => {
    for (const k of Object.keys(entityStore)) delete entityStore[k];
    app = buildApp(mockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/catalog/entities creates entity → 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      payload: {
        kind: 'service',
        name: 'orders-api',
        tags: ['backend'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.entity.kind).toBe('service');
    expect(body.data.entity.name).toBe('orders-api');
    createdId = body.data.entity.id;
  });

  it('POST duplicate → 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      payload: {
        kind: 'service',
        name: 'orders-api',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('Conflict');
  });

  it('GET /api/v1/catalog/entities returns paginated list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('offset');
    expect(body.pagination).toHaveProperty('limit');
  });

  it('GET /api/v1/catalog/entities/:id returns entity', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/catalog/entities/${createdId}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.entity.id).toBe(createdId);
    expect(body.data.relations).toBeInstanceOf(Array);
    expect(body.data.sources).toBeInstanceOf(Array);
  });

  it('GET /api/v1/catalog/entities/:id with unknown id → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities/00000000-0000-0000-0000-000000000099',
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT /api/v1/catalog/entities/:id updates entity → 200', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/catalog/entities/${createdId}`,
      payload: { lifecycle: 'production' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('DELETE /api/v1/catalog/entities/:id → 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/catalog/entities/${createdId}`,
    });
    expect(res.statusCode).toBe(204);
  });

  it('DELETE unknown entity → 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/catalog/entities/00000000-0000-0000-0000-000000000099',
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST with invalid body → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      payload: { kind: 'invalid-kind', name: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('catalog CRUD (OIDC mode - no session)', () => {
  let app: FastifyInstance;

  function oidcConfig(): AppConfig {
    return {
      ...devConfig(),
      auth: {
        oidc: {
          issuer: 'https://issuer.example.com',
          clientId: 'cid',
          clientSecret: 'csec',
        },
        sessionSecret: 'test-secret-at-least-16chars',
      },
    } as unknown as AppConfig;
  }

  beforeAll(async () => {
    app = buildApp(mockPool() as never, oidcConfig(), null);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/catalog/entities → 401 without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('catalog RBAC (viewer cannot POST)', () => {
  let app: FastifyInstance;

  function viewerMockPool(): unknown {
    return {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
        if (sql.includes('FROM permissions WHERE') && sql.includes('subject_ref = $1')) {
          const ref = params?.[0] as string;
          if (ref === 'user:viewer1') {
            return { rows: [{ role: 'viewer', scope: {} }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
        if (sql.includes('FROM entities') && sql.includes('COUNT(*)')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      },
      end: async () => {},
    };
  }

  function oidcConfig(): AppConfig {
    return {
      ...devConfig(),
      auth: {
        oidc: {
          issuer: 'https://issuer.example.com',
          clientId: 'cid',
          clientSecret: 'csec',
        },
        sessionSecret: 'test-secret-at-least-16chars',
      },
    } as unknown as AppConfig;
  }

  beforeAll(async () => {
    app = buildApp(viewerMockPool() as never, oidcConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  function injectSession(user: Record<string, unknown>) {
    const session = app.createSecureSession({
      user,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    return app.encodeSecureSession(session);
  }

  it('viewer POST /api/v1/catalog/entities → 403', async () => {
    const cookie = injectSession({ sub: 'viewer1', email: 'v@test.com', name: 'Viewer', groups: [] });

    const csrfRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(csrfRes.statusCode).toBe(200);
    const csrfToken = csrfRes.json().token as string;

    const updatedCookie = csrfRes.cookies.find(
      (c: { name: string }) => c.name === 'forgeportal.sid',
    )?.value ?? cookie;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/catalog/entities',
      cookies: { 'forgeportal.sid': updatedCookie },
      headers: { 'x-csrf-token': csrfToken },
      payload: { kind: 'service', name: 'forbidden-svc' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'Forbidden', message: 'Missing permission: entity:create' });
  });

  it('viewer GET /api/v1/catalog/entities → 200 (entity:read allowed)', async () => {
    const cookie = injectSession({ sub: 'viewer1', email: 'v@test.com', name: 'Viewer', groups: [] });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities',
      cookies: { 'forgeportal.sid': cookie },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('catalog list filters (dev mode)', () => {
  let app: FastifyInstance;

  function filterMockPool(): unknown {
    const store: Record<string, Record<string, unknown>> = {
      'e1': { id: 'e1', kind: 'service', namespace: 'default', name: 'orders', owner_ref: null, lifecycle: 'production', tags: ['backend'], links: [], scm: {}, spec: {}, created_at: new Date(), updated_at: new Date() },
      'e2': { id: 'e2', kind: 'library', namespace: 'default', name: 'utils', owner_ref: null, lifecycle: null, tags: ['shared'], links: [], scm: {}, spec: {}, created_at: new Date(), updated_at: new Date() },
      'e3': { id: 'e3', kind: 'service', namespace: 'default', name: 'payments', owner_ref: null, lifecycle: 'experimental', tags: ['backend'], links: [], scm: {}, spec: {}, created_at: new Date(), updated_at: new Date() },
    };

    return {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
        if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
        if (sql.includes('FROM entity_relations')) return { rows: [], rowCount: 0 };
        if (sql.includes('FROM entity_sources')) return { rows: [], rowCount: 0 };
        if (sql.includes('FROM entities') && sql.includes('COUNT(*)')) {
          let filtered = Object.values(store);
          if (sql.includes('kind = $')) {
            const kindIdx = sql.match(/kind = \$(\d+)/)?.[1];
            if (kindIdx) {
              const kind = params?.[Number(kindIdx) - 1] as string;
              filtered = filtered.filter((e) => e['kind'] === kind);
            }
          }
          if (sql.includes('plainto_tsquery')) {
            const qIdx = sql.match(/plainto_tsquery\('english', \$(\d+)\)/)?.[1];
            if (qIdx) {
              const q = (params?.[Number(qIdx) - 1] as string).toLowerCase();
              filtered = filtered.filter((e) =>
                (e['name'] as string).toLowerCase().includes(q) ||
                (e['kind'] as string).toLowerCase().includes(q),
              );
            }
          }
          const total = filtered.length;
          const rows = filtered.map((e) => ({ ...e, total }));
          return { rows, rowCount: rows.length };
        }
        return { rows: [], rowCount: 0 };
      },
      end: async () => {},
    };
  }

  beforeAll(async () => {
    app = buildApp(filterMockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('GET with ?kind=service returns only services', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities?kind=service',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data.every((e: { kind: string }) => e.kind === 'service')).toBe(true);
    expect(body.pagination.total).toBe(2);
  });

  it('GET with ?kind=library returns only libraries', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities?kind=library',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('utils');
  });

  it('GET with ?q=orders returns FTS match', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities?q=orders',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('orders');
  });

  it('GET with ?q=nonexistent returns empty', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/entities?q=nonexistent',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });
});

