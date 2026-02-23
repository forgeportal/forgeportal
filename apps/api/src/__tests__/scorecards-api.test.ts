/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

// ── fixtures ───────────────────────────────────────────────────────────────

const ENTITY_ID    = 'aaaa1111-0000-0000-0000-000000000001';
const SCORECARD_ID = 'bbbb2222-0000-0000-0000-000000000001';
const EVAL_ID      = 'cccc3333-0000-0000-0000-000000000001';

const scorecardRow = {
  id:              SCORECARD_ID,
  name:            'service-maturity',
  applies_to_kind: 'service',
  version:         'v1',
  enabled:         true,
  definition: {
    name:   'service-maturity',
    levels: ['Bronze', 'Silver', 'Gold'],
    rules:  [
      { id: 'owner',  title: 'Owner is set',    level: 'Bronze', type: 'entity.field.exists', params: { field: 'owner_ref' } },
      { id: 'readme', title: 'README.md exists', level: 'Bronze', type: 'scm.file.exists',    params: { path: 'README.md' } },
    ],
  },
  created_at: new Date().toISOString(),
};

const entityRow = {
  id:         ENTITY_ID,
  kind:       'service',
  namespace:  'default',
  name:       'test-svc',
  owner_ref:  'team:backend',
  lifecycle:  'production',
  tags:       [],
  links:      [],
  scm:        { provider: 'github', owner: 'org', repo: 'test-repo', defaultBranch: 'main' },
  spec:       {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const evalRow = {
  id:                EVAL_ID,
  scorecard_id:      SCORECARD_ID,
  entity_id:         ENTITY_ID,
  status:            'success',
  level:             'Bronze',
  results: [
    { ruleId: 'owner',  ruleTitle: 'Owner is set',    level: 'Bronze', pass: true,  details: {} },
    { ruleId: 'readme', ruleTitle: 'README.md exists', level: 'Bronze', pass: false, details: {} },
  ],
  evaluated_at:      new Date().toISOString(),
  cache_ttl_seconds: 3600,
};

const baseConfig: AppConfig = {
  db:         { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', maxPoolSize: 1 },
  server:     { port: 4000, host: '0.0.0.0', logLevel: 'error' },
  auth:       { oidc: { scopes: 'openid email profile' }, sessionSecret: 'test-secret-scorecards-api-1234' },
  scm:        { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
  discovery:  { orgs: [], entityFilePath: 'entity.yaml', intervalMinutes: 0 },
  migrations: { dir: 'tools/migration', runSeed: false, seedFile: '' },
  plugins:    {},
  scorecards: { evalIntervalHours: 0 },
  encryptionKey: 'local-dev-key-change-in-prod-32chars!',
} as unknown as AppConfig;

// ── mock pool factory ──────────────────────────────────────────────────────

interface MockPoolOpts {
  entityExists?:     boolean;
  scorecardExists?:  boolean;
  evaluationExists?: boolean;
}

function mockPool(opts: MockPoolOpts = {}) {
  const { entityExists = true, scorecardExists = true, evaluationExists = true } = opts;

  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT 1'))                          return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE'))            return { rows: [], rowCount: 0 };

      // Entity lookup
      if (sql.includes('FROM entities WHERE id = $1')) {
        if (!entityExists) return { rows: [], rowCount: 0 };
        return { rows: [entityRow], rowCount: 1 };
      }

      // Scorecards list (findAll or findByKind)
      if (sql.includes('FROM scorecards WHERE enabled = true ORDER BY name')) {
        return scorecardExists
          ? { rows: [scorecardRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM scorecards WHERE applies_to_kind = $1 AND enabled = true')) {
        const kind = params?.[0] as string;
        if (!scorecardExists || kind === 'library') return { rows: [], rowCount: 0 };
        return { rows: [scorecardRow], rowCount: 1 };
      }

      // Latest evaluations (DISTINCT ON)
      if (sql.includes('DISTINCT ON')) {
        return evaluationExists
          ? { rows: [evalRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/scorecards', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, baseConfig, null, null);
    await app.ready();
  });

  afterAll(() => app.close());

  it('returns 200 with scorecards list', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/scorecards' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { scorecards: unknown[] } };
    expect(body.data.scorecards).toHaveLength(1);
  });

  it('GET /api/v1/scorecards?kind=service → 200 filtered', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/scorecards?kind=service' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { scorecards: unknown[] } };
    expect(body.data.scorecards).toHaveLength(1);
  });

  it('GET /api/v1/scorecards?kind=library → 200 with empty array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/scorecards?kind=library' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { scorecards: unknown[] } };
    expect(body.data.scorecards).toHaveLength(0);
  });
});

describe('GET /api/v1/scorecards/:entityId/latest', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(mockPool() as never, baseConfig, null, null);
    await app.ready();
  });

  afterAll(() => app.close());

  it('returns 200 with evaluations for entity', async () => {
    const res = await app.inject({
      method: 'GET',
      url:    `/api/v1/scorecards/${ENTITY_ID}/latest`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { entityId: string; evaluations: Array<{ status: string; level: string }> };
    };
    expect(body.data.entityId).toBe(ENTITY_ID);
    expect(body.data.evaluations).toHaveLength(1);
    expect(body.data.evaluations[0]!.status).toBe('success');
    expect(body.data.evaluations[0]!.level).toBe('Bronze');
  });

  it('failing rule includes fixAction when available', async () => {
    const res = await app.inject({
      method: 'GET',
      url:    `/api/v1/scorecards/${ENTITY_ID}/latest`,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { evaluations: Array<{ rules: Array<{ ruleId: string; pass: boolean; fixAction: unknown }> }> };
    };
    const rules = body.data.evaluations[0]!.rules;
    const readmeRule = rules.find((r) => r.ruleId === 'readme');
    expect(readmeRule!.pass).toBe(false);
    expect(readmeRule!.fixAction).not.toBeNull();
  });

  it('passing rule has fixAction: null', async () => {
    const res = await app.inject({
      method: 'GET',
      url:    `/api/v1/scorecards/${ENTITY_ID}/latest`,
    });
    const body = JSON.parse(res.body) as {
      data: { evaluations: Array<{ rules: Array<{ ruleId: string; pass: boolean; fixAction: unknown }> }> };
    };
    const ownerRule = body.data.evaluations[0]!.rules.find((r) => r.ruleId === 'owner');
    expect(ownerRule!.pass).toBe(true);
    expect(ownerRule!.fixAction).toBeNull();
  });

  it('entity with no evaluations → all entries have status: pending', async () => {
    const poolNone = mockPool({ evaluationExists: false });
    const appNone  = buildApp(poolNone as never, baseConfig, null, null);
    await appNone.ready();

    const res = await appNone.inject({
      method: 'GET',
      url:    `/api/v1/scorecards/${ENTITY_ID}/latest`,
    });
    await appNone.close();

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { evaluations: Array<{ status: string }> };
    };
    expect(body.data.evaluations[0]!.status).toBe('pending');
  });

  it('non-existent entityId → 404', async () => {
    const pool404 = mockPool({ entityExists: false });
    const app404  = buildApp(pool404 as never, baseConfig, null, null);
    await app404.ready();

    const res = await app404.inject({
      method: 'GET',
      url:    `/api/v1/scorecards/nonexistent-id/latest`,
    });
    await app404.close();

    expect(res.statusCode).toBe(404);
  });

  it('route is registered — responds (not a 404 routing error)', async () => {
    const res = await app.inject({
      method: 'GET',
      url:    `/api/v1/scorecards/${ENTITY_ID}/latest`,
    });
    expect(res.statusCode).not.toBe(404);
  });

  it('viewer role (dev mode) → 200, read access for all roles', async () => {
    // In dev mode (no OIDC issuer), all users are allowed through authGuard
    const res = await app.inject({ method: 'GET', url: '/api/v1/scorecards' });
    expect(res.statusCode).toBe(200);
  });
});
