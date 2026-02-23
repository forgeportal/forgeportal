import { describe, it, expect, vi } from 'vitest';
import { handleWebhookEvent } from '../webhook.handler.js';
import type { AppConfig } from '@forgeportal/core';

function makeConfig(): AppConfig {
  return {
    discovery: { orgs: [], entityFilePath: 'entity.yaml', intervalMinutes: 0 },
    scm: { github: { webhookSecret: 'gh-secret' }, gitlab: { baseUrl: 'https://gitlab.com', webhookSecret: 'gl-secret' } },
  } as unknown as AppConfig;
}

const noopLogger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  child: vi.fn().mockReturnThis(), fatal: vi.fn(), trace: vi.fn(), silent: vi.fn(), level: 'info',
} as never;

function makeEntityYaml() {
  return [
    'apiVersion: forgeportal/v1',
    'kind: service',
    'metadata:',
    '  name: test-svc',
    'spec:',
    '  owner: team:backend',
    '  lifecycle: production',
  ].join('\n');
}

function githubPushPayload(files: string[]) {
  return {
    repository: { full_name: 'org/repo', html_url: 'https://github.com/org/repo', default_branch: 'main' },
    commits: [{ id: 'abc', added: files, modified: [], removed: [] }],
  };
}

function gitlabPushPayload(files: string[]) {
  return {
    project: { path_with_namespace: 'group/project', web_url: 'https://gitlab.com/group/project', default_branch: 'main', id: 42 },
    commits: [{ id: 'abc', added: files, modified: [], removed: [] }],
  };
}

function mockPool() {
  const entities: Record<string, Record<string, unknown>> = {};
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO entities')) {
        const key = `${params?.[1]}/${params?.[2]}/${params?.[3]}`;
        if (entities[key]) {
          const err = new Error('unique_violation') as Error & { code: string };
          err.code = '23505';
          throw err;
        }
        const entity = { id: params?.[0], kind: params?.[1], namespace: params?.[2], name: params?.[3], owner_ref: params?.[4], lifecycle: params?.[5], tags: JSON.parse((params?.[6] as string) ?? '[]'), links: JSON.parse((params?.[7] as string) ?? '[]'), scm: JSON.parse((params?.[8] as string) ?? '{}'), spec: JSON.parse((params?.[9] as string) ?? '{}'), created_at: new Date(), updated_at: new Date() };
        entities[key] = entity;
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('FROM entities WHERE kind = $1 AND namespace = $2 AND name = $3')) {
        const key = `${params?.[0]}/${params?.[1]}/${params?.[2]}`;
        return entities[key] ? { rows: [entities[key]], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('UPDATE entities SET')) {
        const idParam = params?.[params.length - 1] as string;
        const entity = Object.values(entities).find((e) => e['id'] === idParam);
        if (entity) { entity['updated_at'] = new Date(); return { rows: [entity], rowCount: 1 }; }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO entity_sources')) return { rows: [{ id: 'src-1' }], rowCount: 1 };
      if (sql.includes('UPDATE entity_sources')) return { rows: [], rowCount: 1 };
      if (sql.includes('FROM entity_sources WHERE repo_url')) return { rows: [{ entity_id: 'entity-1' }], rowCount: 1 };
      if (sql.includes('INSERT INTO jobs')) {
        return { rows: [{ id: 'job-1', type: params?.[0], payload: JSON.parse((params?.[1] as string) ?? '{}'), status: 'queued', locked_by: null, locked_at: null, created_at: new Date(), finished_at: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

function makeProviders(getFile: (...args: unknown[]) => Promise<unknown>) {
  const provider = {
    name: 'github' as const,
    getFile,
    listRepos: vi.fn(),
    getRepo: vi.fn(),
    createRepo: vi.fn(),
    createOrUpdateFile: vi.fn(),
    createPullRequest: vi.fn(),
    ensureWebhook: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  };
  return {
    github: provider,
    gitlab: provider,
    all: () => [provider],
    get: () => provider,
  };
}

describe('handleWebhookEvent', () => {
  it('GitHub push with entity.yaml change → entity refreshed', async () => {
    const pool = mockPool();
    const providers = makeProviders(async () => ({ path: 'entity.yaml', content: makeEntityYaml(), sha: 'abc', encoding: 'utf-8' }));
    const result = await handleWebhookEvent({
      provider: 'github', eventType: 'push',
      payload: githubPushPayload(['entity.yaml']),
      pool: pool as never, scmProviders: providers as never,
      config: makeConfig(), logger: noopLogger,
    });
    expect(result.action).toBe('entity-refresh');
  });

  it('GitHub push with docs/* change → docs-index job enqueued', async () => {
    const pool = mockPool();
    const providers = makeProviders(async () => null);
    const result = await handleWebhookEvent({
      provider: 'github', eventType: 'push',
      payload: githubPushPayload(['docs/README.md']),
      pool: pool as never, scmProviders: providers as never,
      config: makeConfig(), logger: noopLogger,
    });
    expect(result.action).toBe('docs-index');
    const jobCall = pool.query.mock.calls.find((c) => (c[0] as string).includes('INSERT INTO jobs'));
    expect(jobCall).toBeDefined();
  });

  it('GitHub push with unrelated file → ignored', async () => {
    const pool = mockPool();
    const providers = makeProviders(async () => null);
    const result = await handleWebhookEvent({
      provider: 'github', eventType: 'push',
      payload: githubPushPayload(['src/main.ts']),
      pool: pool as never, scmProviders: providers as never,
      config: makeConfig(), logger: noopLogger,
    });
    expect(result.action).toBe('ignored');
  });

  it('GitHub ping event → returns ping', async () => {
    const pool = mockPool();
    const providers = makeProviders(async () => null);
    const result = await handleWebhookEvent({
      provider: 'github', eventType: 'ping',
      payload: {},
      pool: pool as never, scmProviders: providers as never,
      config: makeConfig(), logger: noopLogger,
    });
    expect(result.action).toBe('ping');
  });

  it('GitLab push with entity.yaml change → entity refreshed', async () => {
    const pool = mockPool();
    const providers = makeProviders(async () => ({ path: 'entity.yaml', content: makeEntityYaml(), sha: 'abc', encoding: 'utf-8' }));
    const result = await handleWebhookEvent({
      provider: 'gitlab', eventType: 'Push Hook',
      payload: gitlabPushPayload(['entity.yaml']),
      pool: pool as never, scmProviders: providers as never,
      config: makeConfig(), logger: noopLogger,
    });
    expect(result.action).toBe('entity-refresh');
  });

  it('GitLab push with docs/ change → docs-index job enqueued', async () => {
    const pool = mockPool();
    const providers = makeProviders(async () => null);
    const result = await handleWebhookEvent({
      provider: 'gitlab', eventType: 'Push Hook',
      payload: gitlabPushPayload(['docs/index.md']),
      pool: pool as never, scmProviders: providers as never,
      config: makeConfig(), logger: noopLogger,
    });
    expect(result.action).toBe('docs-index');
  });
});
