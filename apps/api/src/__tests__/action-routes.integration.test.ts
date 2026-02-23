/// <reference types="@fastify/secure-session" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTION_ID = 'aaaa0000-0000-0000-0000-000000000001';
const RUN_ID    = 'bbbb0000-0000-0000-0000-000000000001';
const IDEM_KEY  = 'idempotency-abc';

const actionRow = {
  id: ACTION_ID,
  name: 'scm.createRepo',
  version: 'v1',
  definition: {
    parameters: {
      type: 'object',
      properties: {
        repoName: { type: 'string' },
        token: { type: 'string', secret: true },
      },
    },
  },
};

const runRow = {
  id: RUN_ID,
  action_id: ACTION_ID,
  template_id: null,
  entity_id: null,
  requested_by: 'dev@forgeportal.local',
  status: 'queued',
  input: {},
  output: {},
  locked_by: null,
  locked_at: null,
  retry_count: 0,
  max_retries: 3,
  idempotency_key: IDEM_KEY,
  next_attempt_at: null,
  started_at: null,
  finished_at: null,
  created_at: new Date().toISOString(),
};

const successRunRow = { ...runRow, status: 'success', output: { repoUrl: 'https://github.com/x/y' } };

const runWithLinks = {
  ...runRow,
  status: 'success',
  output: {
    repoUrl: 'https://github.com/x/y',
    links: [{ title: 'Repository', url: 'https://github.com/x/y' }],
  },
};

const auditEntry = {
  id: 'audit-uuid-1',
  actor: 'dev@forgeportal.local',
  action: 'scm.createRepo@v1',
  target_type: 'action_run',
  target_id: RUN_ID,
  metadata: { run_id: RUN_ID, status: 'success', outputs: {} },
  ts: new Date().toISOString(),
};

function makeMockPool(opts: {
  actionExists?: boolean;
  runExists?: boolean;
  idempotencyHit?: boolean;
  recentCount?: number;
  runRow?: typeof runRow;
  auditEntries?: unknown[];
} = {}) {
  const {
    actionExists = true,
    runExists = true,
    idempotencyHit = false,
    recentCount = 0,
    runRow: overrideRunRow,
    auditEntries = [],
  } = opts;

  const effectiveRunRow = overrideRunRow ?? runRow;

  return {
    query: async (sql: string, _params?: unknown[]) => {
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
      if (sql.includes('COUNT(*)') && sql.includes('action_runs')) {
        return { rows: [{ count: String(recentCount) }], rowCount: 1 };
      }
      if (sql.includes('FROM actions WHERE')) {
        return actionExists
          ? { rows: [actionRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes('idempotency_key') && sql.includes("status = 'success'")) {
        return idempotencyHit
          ? { rows: [successRunRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes('INTO action_runs')) {
        return { rows: [effectiveRunRow], rowCount: 1 };
      }
      if (sql.includes('FROM action_runs WHERE id')) {
        return runExists
          ? { rows: [effectiveRunRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM action_run_logs')) {
        return { rows: [{ ts: new Date().toISOString(), level: 'info', message: 'started' }], rowCount: 1 };
      }
      if (sql.includes("SET status = 'canceled'")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM audit_logs') && sql.includes('COUNT(*)')) {
        return { rows: [{ count: String(auditEntries.length) }], rowCount: 1 };
      }
      if (sql.includes('FROM audit_logs') && !sql.includes('COUNT(*)')) {
        return { rows: auditEntries, rowCount: auditEntries.length };
      }
      if (sql.includes('INTO audit_logs')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

function devConfig(): AppConfig {
  return {
    server: { port: 3000, logLevel: 'silent' },
    db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test', ssl: false },
    auth: {
      sessionSecret: 'test-secret-at-least-32-characters-long',
      oidc: { issuer: '', clientId: '', clientSecret: '', redirectUri: '' },
    },
    discovery: { entityFilePath: 'entity.yaml', intervalMinutes: 0, orgs: [] },
    scm: { github: {}, gitlab: {} },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('action routes (dev mode)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(makeMockPool() as never, devConfig(), null);
    await app.ready();
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/v1/actions/:actionId/run → 202 + runId (AC: 1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/actions/${ACTION_ID}/run`,
      payload: { input: { name: 'my-repo' } },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.data.runId).toBeDefined();
    expect(body.data.status).toBe('queued');
  });

  it('POST with unknown actionId → 404 (AC: 1)', async () => {
    const appWith404 = buildApp(
      makeMockPool({ actionExists: false }) as never,
      devConfig(),
      null,
    );
    await appWith404.ready();

    const res = await appWith404.inject({
      method: 'POST',
      url: `/api/v1/actions/${ACTION_ID}/run`,
      payload: { input: {} },
    });
    expect(res.statusCode).toBe(404);
    await appWith404.close();
  });

  it('POST with same idempotencyKey for success run → 200 + cached:true (AC: 9)', async () => {
    const cachedApp = buildApp(
      makeMockPool({ idempotencyHit: true }) as never,
      devConfig(),
      null,
    );
    await cachedApp.ready();

    const res = await cachedApp.inject({
      method: 'POST',
      url: `/api/v1/actions/${ACTION_ID}/run`,
      payload: { input: {}, idempotencyKey: IDEM_KEY },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.cached).toBe(true);
    await cachedApp.close();
  });

  it('POST rate limit — 10+ requests in 1 minute → 429 + Retry-After', async () => {
    const rateLimitApp = buildApp(
      makeMockPool() as never,
      devConfig(),
      null,
    );
    await rateLimitApp.ready();

    for (let i = 0; i < 10; i++) {
      const r = await rateLimitApp.inject({
        method: 'POST',
        url: `/api/v1/actions/${ACTION_ID}/run`,
        payload: { input: {} },
      });
      expect(r.statusCode).toBe(202);
    }
    const res = await rateLimitApp.inject({
      method: 'POST',
      url: `/api/v1/actions/${ACTION_ID}/run`,
      payload: { input: {} },
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    const retryAfter = parseInt(res.headers['retry-after'] as string, 10);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    await rateLimitApp.close();
  });

  it('GET /api/v1/actions/runs/:runId → 200 with status and links (AC: 3, 4, 5)', async () => {
    const appWithLinks = buildApp(
      makeMockPool({ runRow: runWithLinks as typeof runRow }) as never,
      devConfig(),
      null,
    );
    await appWithLinks.ready();

    const res = await appWithLinks.inject({
      method: 'GET',
      url: `/api/v1/actions/runs/${RUN_ID}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.runId).toBe(RUN_ID);
    expect(body.data.status).toBe('success');
    expect(Array.isArray(body.data.links)).toBe(true);
    expect(body.data.links).toHaveLength(1);
    expect(body.data.links[0]).toMatchObject({ title: 'Repository' });
    await appWithLinks.close();
  });

  it('GET /api/v1/actions/runs/:runId → 404 when not found', async () => {
    const app404 = buildApp(
      makeMockPool({ runExists: false }) as never,
      devConfig(),
      null,
    );
    await app404.ready();

    const res = await app404.inject({
      method: 'GET',
      url: `/api/v1/actions/runs/${RUN_ID}`,
    });
    expect(res.statusCode).toBe(404);
    await app404.close();
  });

  it('GET /api/v1/actions/runs/:runId/logs → 200 with logs array (AC: 4)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/actions/runs/${RUN_ID}/logs`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data.logs)).toBe(true);
    expect(body.data.logs[0]).toMatchObject({ level: 'info', message: 'started' });
  });

  it('POST /api/v1/actions/runs/:runId/cancel for queued run → 200', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/actions/runs/${RUN_ID}/cancel`,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('canceled');
  });

  // ── Story 3-4 new tests ──────────────────────────────────────────────────

  it('POST run with secret field → stored input has "***" for that field (AC: 2)', async () => {
    const capturedParams: unknown[][] = [];

    const capturePool = {
      query: async (sql: string, params?: unknown[]) => {
        if (params) capturedParams.push(params);
        if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
        if (sql.includes('FROM permissions WHERE')) return { rows: [], rowCount: 0 };
        if (sql.includes('COUNT(*)') && sql.includes('action_runs')) {
          return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('FROM actions WHERE')) {
          return { rows: [actionRow], rowCount: 1 };
        }
        if (sql.includes('idempotency_key') && sql.includes("status = 'success'")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('INTO action_runs')) {
          return { rows: [runRow], rowCount: 1 };
        }
        if (sql.includes('INTO audit_logs')) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      },
      end: async () => {},
    };

    const captureApp = buildApp(capturePool as never, devConfig(), null);
    await captureApp.ready();

    await captureApp.inject({
      method: 'POST',
      url: `/api/v1/actions/${ACTION_ID}/run`,
      payload: { input: { repoName: 'my-repo', token: 'ghp_supersecret123456789012345678901' } },
    });

    // Find the INSERT INTO action_runs params
    const insertParams = capturedParams.find((p) => {
      // The input column is typically at position 3 (0-indexed)
      // We detect it as the params call for action_runs INSERT by checking
      // if any param contains our repoName (as JSON string in input)
      return p.some(
        (v) => typeof v === 'string' && v.includes('repoName'),
      );
    });

    expect(insertParams).toBeDefined();
    const inputJson = insertParams!.find(
      (v): v is string => typeof v === 'string' && v.includes('repoName'),
    )!;
    const parsedInput = JSON.parse(inputJson) as Record<string, unknown>;
    expect(parsedInput['token']).toBe('***');
    expect(parsedInput['repoName']).toBe('my-repo');

    await captureApp.close();
  });

  it('GET /api/v1/audit-logs by platform-admin → 200 with entries (AC: 6)', async () => {
    const auditApp = buildApp(
      makeMockPool({ auditEntries: [auditEntry] }) as never,
      devConfig(),
      null,
    );
    await auditApp.ready();

    const res = await auditApp.inject({
      method: 'GET',
      url: '/api/v1/audit-logs',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.entries).toHaveLength(1);
    expect(body.data.entries[0].target_id).toBe(RUN_ID);
    expect(body.data.total).toBe(1);

    await auditApp.close();
  });

  it('GET /api/v1/audit-logs with non-platform-admin (developer) → 403 (AC: 6)', async () => {
    function developerPool(): unknown {
      return {
        query: async (sql: string, params?: unknown[]) => {
          if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }], rowCount: 1 };
          if (sql.includes('FROM permissions WHERE') && sql.includes('subject_ref = $1')) {
            const ref = params?.[0] as string;
            if (ref === 'user:dev-rbac') {
              return { rows: [{ role: 'developer', scope: {} }], rowCount: 1 };
            }
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
        oidc: {
          issuer: 'https://issuer.example.com',
          clientId: 'cid',
          clientSecret: 'csec',
          redirectUri: 'https://app.example.com/callback',
        },
        sessionSecret: 'test-secret-at-least-32-characters-long',
      },
    } as unknown as AppConfig;

    const oidcApp = buildApp(developerPool() as never, oidcConfig, null);
    await oidcApp.ready();

    const session = oidcApp.createSecureSession({
      user: { sub: 'dev-rbac', email: 'd@test.com', name: 'Dev', groups: [] },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const cookie = oidcApp.encodeSecureSession(session);

    const csrfRes = await oidcApp.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf-token',
      cookies: { 'forgeportal.sid': cookie },
    });
    const updatedCookie =
      csrfRes.cookies.find((c: { name: string }) => c.name === 'forgeportal.sid')?.value ?? cookie;

    const res = await oidcApp.inject({
      method: 'GET',
      url: '/api/v1/audit-logs',
      cookies: { 'forgeportal.sid': updatedCookie },
    });
    expect(res.statusCode).toBe(403);

    await oidcApp.close();
  });
});

