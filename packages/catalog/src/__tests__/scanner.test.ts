import { describe, it, expect, vi } from 'vitest';
import { scanOrg } from '../scanner.js';

function makeEntityYaml(name = 'test-svc') {
  return [
    'apiVersion: forgeportal/v1',
    'kind: service',
    'metadata:',
    `  name: ${name}`,
    'spec:',
    '  owner: team:backend',
    '  lifecycle: production',
  ].join('\n');
}

function mockProvider(
  files: Record<string, string | null> = {},
) {
  return {
    name: 'github' as const,
    listRepos: vi.fn(async function* () {
      for (const repoName of Object.keys(files)) {
        yield {
          ref: { owner: 'org', repo: repoName },
          fullName: `org/${repoName}`,
          defaultBranch: 'main',
          private: false,
          url: `https://github.com/org/${repoName}`,
          topics: [],
          updatedAt: '2025-01-01T00:00:00Z',
        };
      }
    }),
    getFile: vi.fn(async (_ref: unknown, _path: string) => {
      const ref = _ref as { repo: string };
      const content = files[ref.repo];
      if (!content) return null;
      return {
        path: 'entity.yaml',
        content,
        sha: 'abc',
        encoding: 'utf-8' as const,
      };
    }),
    getRepo: vi.fn(),
    createRepo: vi.fn(),
    createOrUpdateFile: vi.fn(),
    createPullRequest: vi.fn(),
    ensureWebhook: vi.fn(),
    verifyWebhookSignature: vi.fn(),
  };
}

function mockPool() {
  const entities: Record<string, Record<string, unknown>> = {};
  let counter = 0;
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO entities')) {
        const key = `${params?.[1]}/${params?.[2]}/${params?.[3]}`;
        if (entities[key]) {
          const err = new Error('unique_violation') as Error & { code: string };
          err.code = '23505';
          throw err;
        }
        const entity = {
          id: params?.[0] as string,
          kind: params?.[1],
          namespace: params?.[2],
          name: params?.[3],
          owner_ref: params?.[4],
          lifecycle: params?.[5],
          tags: JSON.parse((params?.[6] as string) ?? '[]'),
          links: JSON.parse((params?.[7] as string) ?? '[]'),
          scm: JSON.parse((params?.[8] as string) ?? '{}'),
          spec: JSON.parse((params?.[9] as string) ?? '{}'),
          created_at: new Date(),
          updated_at: new Date(),
        };
        entities[key] = entity;
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('FROM entities WHERE kind = $1 AND namespace = $2 AND name = $3')) {
        const key = `${params?.[0]}/${params?.[1]}/${params?.[2]}`;
        const entity = entities[key];
        if (!entity) return { rows: [], rowCount: 0 };
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('UPDATE entities SET')) {
        const idParam = params?.[params.length - 1] as string;
        const entity = Object.values(entities).find((e) => e['id'] === idParam);
        if (!entity) return { rows: [], rowCount: 0 };
        entity['updated_at'] = new Date();
        return { rows: [entity], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO entity_sources')) {
        return {
          rows: [{ id: `src-${++counter}`, entity_id: params?.[1], provider: params?.[2] }],
          rowCount: 1,
        };
      }
      if (sql.includes('UPDATE entity_sources SET last_seen_at')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

const noopLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
  fatal: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
  level: 'info',
} as never;

describe('scanOrg', () => {
  it('repo with entity.yaml → entity created + source upserted', async () => {
    const provider = mockProvider({ 'repo-a': makeEntityYaml() });
    const pool = mockPool();
    const result = await scanOrg({
      provider: provider as never,
      org: 'org',
      entityFilePath: 'entity.yaml',
      pool: pool as never,
      logger: noopLogger,
    });
    expect(result.entitiesCreated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.reposScanned).toBe(1);
  });

  it('repo without entity.yaml → skipped, no entity created', async () => {
    const provider = mockProvider({ 'repo-b': null as unknown as string });
    provider.getFile.mockResolvedValue(null);
    const pool = mockPool();
    const result = await scanOrg({
      provider: provider as never,
      org: 'org',
      entityFilePath: 'entity.yaml',
      pool: pool as never,
      logger: noopLogger,
    });
    expect(result.skipped).toBe(1);
    expect(result.entitiesCreated).toBe(0);
  });

  it('repo with invalid entity.yaml → error counted, not created', async () => {
    const provider = mockProvider({ 'repo-c': 'invalid: yaml: [broken' });
    provider.getFile.mockResolvedValue({
      path: 'entity.yaml',
      content: 'not-a-valid-entity',
      sha: 'abc',
      encoding: 'utf-8',
    });
    const pool = mockPool();
    const result = await scanOrg({
      provider: provider as never,
      org: 'org',
      entityFilePath: 'entity.yaml',
      pool: pool as never,
      logger: noopLogger,
    });
    expect(result.errors).toBe(1);
    expect(result.entitiesCreated).toBe(0);
  });

  it('existing entity (conflict) → updated instead', async () => {
    const provider = mockProvider({
      'repo-d': makeEntityYaml('dup-svc'),
      'repo-e': makeEntityYaml('dup-svc'),
    });
    const pool = mockPool();
    const result = await scanOrg({
      provider: provider as never,
      org: 'org',
      entityFilePath: 'entity.yaml',
      pool: pool as never,
      logger: noopLogger,
    });
    expect(result.entitiesCreated).toBe(1);
    expect(result.entitiesUpdated).toBe(1);
  });

  it('entity_sources.last_seen_at updated', async () => {
    const provider = mockProvider({ 'repo-f': makeEntityYaml('svc-f') });
    const pool = mockPool();
    await scanOrg({
      provider: provider as never,
      org: 'org',
      entityFilePath: 'entity.yaml',
      pool: pool as never,
      logger: noopLogger,
    });
    const lastSeenCall = pool.query.mock.calls.find(
      (c) => (c[0] as string).includes('UPDATE entity_sources SET last_seen_at'),
    );
    expect(lastSeenCall).toBeDefined();
  });

  it('summary counts are correct for mixed scenario', async () => {
    const provider = mockProvider({
      'repo-ok': makeEntityYaml('ok-svc'),
      'repo-skip': null as unknown as string,
    });
    provider.getFile.mockImplementation(async (_ref: unknown) => {
      const ref = _ref as { repo: string };
      if (ref.repo === 'repo-skip') return null;
      return {
        path: 'entity.yaml',
        content: makeEntityYaml('ok-svc'),
        sha: 'abc',
        encoding: 'utf-8',
      };
    });
    const pool = mockPool();
    const result = await scanOrg({
      provider: provider as never,
      org: 'org',
      entityFilePath: 'entity.yaml',
      pool: pool as never,
      logger: noopLogger,
    });
    expect(result.reposScanned).toBe(2);
    expect(result.entitiesCreated).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
