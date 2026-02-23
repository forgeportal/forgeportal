import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenPrOrMrHandler } from '../../../actions/scm/open-pr-or-mr.handler.js';
import type { ActionContext } from '../../../types.js';
import type { SCMProvider, SCMProviders } from '@forgeportal/scm';

function makeCtx(input: Record<string, unknown> = {}): ActionContext {
  return {
    runId: 'run-1',
    entityId: null,
    requestedBy: 'user',
    input,
    acquireRepoLock: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

function makeScm(overrides: Partial<SCMProvider> = {}): SCMProvider {
  return {
    name: 'github',
    listRepos: vi.fn(),
    getRepo: vi.fn(),
    getFile: vi.fn(),
    createRepo: vi.fn(),
    createOrUpdateFile: vi.fn(),
    createPullRequest: vi.fn().mockResolvedValue({
      number: 42,
      url: 'https://github.com/acme/my-repo/pull/42',
      state: 'open',
    }),
    listPullRequests: vi.fn().mockResolvedValue([]),
    ensureWebhook: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    listFiles: vi.fn(),
    ...overrides,
  };
}

function makeProviders(scm: SCMProvider): SCMProviders {
  return {
    github: scm as never,
    gitlab: null,
    all: () => [scm],
    get: (name) => (name === 'github' ? scm : null),
  };
}

const baseInput = {
  provider: 'github',
  owner: 'acme',
  repo: 'my-repo',
  headBranch: 'feature/x',
  baseBranch: 'main',
  title: 'My feature',
};

describe('OpenPrOrMrHandler', () => {
  let handler: OpenPrOrMrHandler;
  let scm: SCMProvider;

  beforeEach(() => {
    scm = makeScm();
    handler = new OpenPrOrMrHandler(makeProviders(scm));
  });

  it('no existing PR → createPullRequest called, returns url+number', async () => {
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createPullRequest).toHaveBeenCalledOnce();
    expect(result.status).toBe('success');
    expect(result.outputs.number).toBe(42);
    expect(result.outputs.url).toContain('/pull/42');
    expect(result.links).toHaveLength(1);
  });

  it('PR already exists → createPullRequest NOT called, returns existing + warning', async () => {
    scm = makeScm({
      listPullRequests: vi.fn().mockResolvedValue([
        { number: 7, url: 'https://github.com/acme/my-repo/pull/7', state: 'open' },
      ]),
    });
    handler = new OpenPrOrMrHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createPullRequest).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.outputs.number).toBe(7);
    expect(result.warnings?.[0]).toContain('already existed');
  });

  it('GitHub 422 "pull request already exists" race → re-fetch and return existing', async () => {
    let listCallCount = 0;
    scm = makeScm({
      listPullRequests: vi.fn().mockImplementation(() => {
        listCallCount++;
        if (listCallCount === 1) return Promise.resolve([]);
        return Promise.resolve([{
          number: 99,
          url: 'https://github.com/acme/my-repo/pull/99',
          state: 'open',
        }]);
      }),
      createPullRequest: vi.fn().mockRejectedValue({
        status: 422,
        message: 'A pull request already exists for acme:feature/x.',
      }),
    });
    handler = new OpenPrOrMrHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.outputs.number).toBe(99);
  });

  it('headBranch not found → NOT_FOUND', async () => {
    scm = makeScm({
      createPullRequest: vi.fn().mockRejectedValue({ status: 404, message: 'Branch not found' }),
    });
    handler = new OpenPrOrMrHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
