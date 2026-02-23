import { describe, it, expect, vi } from 'vitest';
import { handleWebhookEvent } from '../webhook.handler.js';
import type { AppConfig } from '@forgeportal/core';

// ── helpers ────────────────────────────────────────────────────────────────

function makeConfig(): AppConfig {
  return {
    discovery: { orgs: [], entityFilePath: 'entity.yaml', intervalMinutes: 0 },
    scm: {
      github: { webhookSecret: 'gh-secret' },
      gitlab: { baseUrl: 'https://gitlab.com', webhookSecret: 'gl-secret' },
    },
  } as unknown as AppConfig;
}

const noopLogger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  child: vi.fn().mockReturnThis(), fatal: vi.fn(), trace: vi.fn(), silent: vi.fn(), level: 'info',
} as never;

function entityYaml() {
  return ['apiVersion: forgeportal/v1', 'kind: service', 'metadata:', '  name: test-svc', 'spec:', '  owner: team:backend', '  lifecycle: production'].join('\n');
}

function githubPushPayload(files: string[]) {
  return {
    repository: { full_name: 'org/repo', html_url: 'https://github.com/org/repo', default_branch: 'main' },
    commits: [{ id: 'abc', added: files, modified: [], removed: [] }],
  };
}

// ── mock pool factory ──────────────────────────────────────────────────────

interface MockPoolOptions {
  scorecardIds?:  string[];    // applicable scorecards to return
  existingJob?:   boolean;     // whether a queued job already exists (dedup test)
  scorecardThrow?: boolean;    // throw on scorecard query (resilience test)
}

function mockPool(opts: MockPoolOptions = {}) {
  const entities: Record<string, Record<string, unknown>> = {};

  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // Entity INSERT
      if (sql.includes('INSERT INTO entities')) {
        const entity = {
          id: params?.[0], kind: params?.[1], namespace: params?.[2], name: params?.[3],
          owner_ref: params?.[4] ?? null, lifecycle: params?.[5] ?? null,
          tags: JSON.parse((params?.[6] as string) ?? '[]'),
          links: JSON.parse((params?.[7] as string) ?? '[]'),
          scm: JSON.parse((params?.[8] as string) ?? '{}'),
          spec: JSON.parse((params?.[9] as string) ?? '{}'),
          created_at: new Date(), updated_at: new Date(),
        };
        const key = `${params?.[1]}/${params?.[2]}/${params?.[3]}`;
        entities[key] = entity;
        return { rows: [entity], rowCount: 1 };
      }
      // Entity source INSERT ... RETURNING *
      if (sql.includes('INSERT INTO entity_sources')) {
        const now = new Date();
        return {
          rows: [{
            id:           params?.[0] ?? 'src-id',
            entity_id:    params?.[1],
            provider:     params?.[2],
            repo_url:     params?.[3],
            path:         params?.[4] ?? '/',
            last_seen_at: null,
            created_at:   now,
            updated_at:   now,
          }],
          rowCount: 1,
        };
      }
      // UPDATE entity_sources SET last_seen_at ...
      if (sql.includes('UPDATE entity_sources')) {
        return { rows: [], rowCount: 1 };
      }
      // Scorecard query
      if (sql.includes('FROM scorecards WHERE applies_to_kind')) {
        if (opts.scorecardThrow) throw new Error('DB error');
        const rows = (opts.scorecardIds ?? []).map((id) => ({ id }));
        return { rows, rowCount: rows.length };
      }
      // Dedup check
      if (sql.includes("type = 'scorecard-eval'") && sql.includes('status = \'queued\'')) {
        return opts.existingJob ? { rows: [{ id: 'job-existing' }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      // enqueueJob INSERT
      if (sql.includes('INSERT INTO jobs')) {
        return { rows: [{ id: 'job-new', type: 'scorecard-eval', status: 'queued', payload: params?.[1], locked_by: null, locked_at: null, created_at: new Date(), finished_at: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

function mockSCMProviders(yaml: string) {
  return {
    get: () => ({
      name: 'github',
      getFile: vi.fn().mockResolvedValue({ path: 'entity.yaml', content: yaml, sha: 'abc', encoding: 'utf-8' }),
    }),
  } as never;
}

// ── tests ─────────────────────────────────────────────────────────────────

describe('handleWebhookEvent — scorecard enqueue', () => {
  it('enqueues scorecard-eval jobs after entity refresh', async () => {
    const pool = mockPool({ scorecardIds: ['sc-1'] });

    const result = await handleWebhookEvent({
      provider: 'github',
      eventType: 'push',
      payload: githubPushPayload(['entity.yaml']),
      pool: pool as never,
      scmProviders: mockSCMProviders(entityYaml()),
      config: makeConfig(),
      logger: noopLogger,
    });

    expect(result.action).toBe('entity-refresh');
    expect(result.scorecardJobsEnqueued).toBe(1);
    // enqueueJob triggers an INSERT INTO jobs
    const insertCall = pool.query.mock.calls.find((c) => (c[0] as string).includes('INSERT INTO jobs'));
    expect(insertCall).toBeDefined();
  });

  it('skips scorecard enqueue when no applicable scorecards exist', async () => {
    const pool = mockPool({ scorecardIds: [] });

    const result = await handleWebhookEvent({
      provider: 'github',
      eventType: 'push',
      payload: githubPushPayload(['entity.yaml']),
      pool: pool as never,
      scmProviders: mockSCMProviders(entityYaml()),
      config: makeConfig(),
      logger: noopLogger,
    });

    expect(result.action).toBe('entity-refresh');
    expect(result.scorecardJobsEnqueued).toBe(0);
    const insertCall = pool.query.mock.calls.find((c) => (c[0] as string).includes('INSERT INTO jobs'));
    expect(insertCall).toBeUndefined();
  });

  it('skips duplicate scorecard-eval job when one is already queued', async () => {
    const pool = mockPool({ scorecardIds: ['sc-1'], existingJob: true });

    const result = await handleWebhookEvent({
      provider: 'github',
      eventType: 'push',
      payload: githubPushPayload(['entity.yaml']),
      pool: pool as never,
      scmProviders: mockSCMProviders(entityYaml()),
      config: makeConfig(),
      logger: noopLogger,
    });

    expect(result.action).toBe('entity-refresh');
    expect(result.scorecardJobsEnqueued).toBe(0);
  });

  it('entity refresh succeeds even when scorecard enqueue throws', async () => {
    const pool = mockPool({ scorecardThrow: true });

    const result = await handleWebhookEvent({
      provider: 'github',
      eventType: 'push',
      payload: githubPushPayload(['entity.yaml']),
      pool: pool as never,
      scmProviders: mockSCMProviders(entityYaml()),
      config: makeConfig(),
      logger: noopLogger,
    });

    // Entity refresh must still succeed despite scorecard error
    expect(result.action).toBe('entity-refresh');
  });
});
