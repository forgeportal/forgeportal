import { describe, it, expect, vi } from 'vitest';
import type { SCMProvider, RepoRef, FileContent } from '@forgeportal/scm';
import type { EntityRow } from '@forgeportal/catalog';
import { RuleEvaluator } from '../rule-evaluator.js';
import { ScmFileCache }  from '../scm-file-cache.js';
import type { RuleDefinition } from '../types.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<EntityRow> = {}): EntityRow {
  return {
    id:         'ent-1',
    kind:       'service',
    namespace:  'default',
    name:       'my-service',
    owner_ref:  'team:payments',
    lifecycle:  'production',
    tags:       ['node'],
    links:      [],
    scm:        { provider: 'github', owner: 'myorg', repo: 'my-service', defaultBranch: 'main' },
    spec:       {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeProviderMock(getFileFn: (ref: RepoRef, path: string) => Promise<FileContent | null>): SCMProvider {
  return {
    name: 'github',
    listRepos: vi.fn(),
    getRepo:   vi.fn(),
    getFile:   vi.fn().mockImplementation(getFileFn),
    createRepo: vi.fn(),
    createOrUpdateFile: vi.fn(),
    createPullRequest: vi.fn(),
    listPullRequests: vi.fn(),
    ensureWebhook: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    listFiles: vi.fn(),
  } as unknown as SCMProvider;
}

function makeEvaluator(provider?: SCMProvider): { evaluator: RuleEvaluator; cache: ScmFileCache } {
  const cache    = new ScmFileCache(60_000);
  const providers = new Map<string, SCMProvider>();
  if (provider) providers.set('github', provider);
  return { evaluator: new RuleEvaluator(providers, cache), cache };
}

function rule(overrides: Partial<RuleDefinition>): RuleDefinition {
  return {
    id:     'test-rule',
    title:  'Test Rule',
    level:  'Bronze',
    type:   'entity.field.exists',
    params: { field: 'owner_ref' },
    ...overrides,
  };
}

// ── entity.field.exists ────────────────────────────────────────────────────

describe('entity.field.exists', () => {
  it('owner_ref set → pass', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.field.exists', params: { field: 'owner_ref' } }),
      makeEntity({ owner_ref: 'team:payments' }),
    );
    expect(result.pass).toBe(true);
  });

  it('owner_ref null → fail', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.field.exists', params: { field: 'owner_ref' } }),
      makeEntity({ owner_ref: null }),
    );
    expect(result.pass).toBe(false);
  });

  it('owner_ref empty string → fail', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.field.exists', params: { field: 'owner_ref' } }),
      makeEntity({ owner_ref: '' }),
    );
    expect(result.pass).toBe(false);
  });

  it('tags = [] → fail', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.field.exists', params: { field: 'tags' } }),
      makeEntity({ tags: [] }),
    );
    expect(result.pass).toBe(false);
  });
});

// ── entity.link.exists ─────────────────────────────────────────────────────

describe('entity.link.exists', () => {
  it('link with matching title → pass', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.link.exists', params: { titleContains: 'runbook' } }),
      makeEntity({ links: [{ title: 'Runbook', url: 'https://wiki/runbook' }] }),
    );
    expect(result.pass).toBe(true);
  });

  it('no links → fail', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.link.exists', params: { titleContains: 'runbook' } }),
      makeEntity({ links: [] }),
    );
    expect(result.pass).toBe(false);
  });

  it('link title does not match → fail', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'entity.link.exists', params: { titleContains: 'runbook' } }),
      makeEntity({ links: [{ title: 'Dashboard', url: 'https://grafana' }] }),
    );
    expect(result.pass).toBe(false);
  });
});

// ── scm.file.exists ────────────────────────────────────────────────────────

describe('scm.file.exists', () => {
  it('file exists via provider → pass, result cached', async () => {
    const mockGetFile = vi.fn().mockResolvedValue({ path: 'README.md', content: 'hello', sha: 'abc', encoding: 'utf-8' as const });
    const provider    = makeProviderMock(mockGetFile);
    const { evaluator, cache } = makeEvaluator(provider);

    const result = await evaluator.evaluate(
      rule({ type: 'scm.file.exists', params: { path: 'README.md' } }),
      makeEntity(),
    );
    expect(result.pass).toBe(true);
    expect(mockGetFile).toHaveBeenCalledTimes(1);
    expect(cache.get('myorg', 'my-service', 'README.md')).toBe(true);
  });

  it('file does not exist → fail', async () => {
    const provider = makeProviderMock(vi.fn().mockResolvedValue(null));
    const { evaluator } = makeEvaluator(provider);
    const result = await evaluator.evaluate(
      rule({ type: 'scm.file.exists', params: { path: 'MISSING.md' } }),
      makeEntity(),
    );
    expect(result.pass).toBe(false);
  });

  it('uses cached value on second call, no extra provider call', async () => {
    const mockGetFile = vi.fn().mockResolvedValue({ path: 'README.md', content: 'hi', sha: 'x', encoding: 'utf-8' as const });
    const provider    = makeProviderMock(mockGetFile);
    const { evaluator } = makeEvaluator(provider);

    const r = rule({ type: 'scm.file.exists', params: { path: 'README.md' } });
    const entity = makeEntity();
    await evaluator.evaluate(r, entity);
    await evaluator.evaluate(r, entity);
    expect(mockGetFile).toHaveBeenCalledTimes(1); // cached on 2nd call
  });

  it('no SCM data on entity → pass: null with reason scm-not-configured', async () => {
    const { evaluator } = makeEvaluator();
    const result = await evaluator.evaluate(
      rule({ type: 'scm.file.exists', params: { path: 'README.md' } }),
      makeEntity({ scm: {} }),
    );
    // null = skipped/neutral when SCM is not configured for this entity
    expect(result.pass).toBe(null);
    expect(result.details['reason']).toBe('scm-not-configured');
  });

  it('provider throws → pass: false, error set (AC: 8)', async () => {
    const provider = makeProviderMock(vi.fn().mockRejectedValue(new Error('GitHub API 500')));
    const { evaluator } = makeEvaluator(provider);
    const result = await evaluator.evaluate(
      rule({ type: 'scm.file.exists', params: { path: 'README.md' } }),
      makeEntity(),
    );
    expect(result.pass).toBe(false);
    // error is caught at the rule level
  });
});

// ── scm.anyOf ──────────────────────────────────────────────────────────────

describe('scm.anyOf', () => {
  it('first path exists → pass', async () => {
    const provider = makeProviderMock((_, path) =>
      Promise.resolve(path === '.github/workflows/ci.yml' ? { path, content: '', sha: 'x', encoding: 'utf-8' as const } : null),
    );
    const { evaluator } = makeEvaluator(provider);
    const result = await evaluator.evaluate(
      rule({ type: 'scm.anyOf', params: { paths: ['.github/workflows/ci.yml', '.gitlab-ci.yml'] } }),
      makeEntity(),
    );
    expect(result.pass).toBe(true);
    expect(result.details['found']).toBe('.github/workflows/ci.yml');
  });

  it('second path exists, first missing → pass', async () => {
    const provider = makeProviderMock((_, path) =>
      Promise.resolve(path === '.gitlab-ci.yml' ? { path, content: '', sha: 'y', encoding: 'utf-8' as const } : null),
    );
    const { evaluator } = makeEvaluator(provider);
    const result = await evaluator.evaluate(
      rule({ type: 'scm.anyOf', params: { paths: ['.github/workflows/ci.yml', '.gitlab-ci.yml'] } }),
      makeEntity(),
    );
    expect(result.pass).toBe(true);
    expect(result.details['found']).toBe('.gitlab-ci.yml');
  });

  it('none of the paths exist → fail', async () => {
    const provider = makeProviderMock(vi.fn().mockResolvedValue(null));
    const { evaluator } = makeEvaluator(provider);
    const result = await evaluator.evaluate(
      rule({ type: 'scm.anyOf', params: { paths: ['.github/workflows/ci.yml', '.gitlab-ci.yml'] } }),
      makeEntity(),
    );
    expect(result.pass).toBe(false);
    expect(result.details['found']).toBeNull();
  });
});
