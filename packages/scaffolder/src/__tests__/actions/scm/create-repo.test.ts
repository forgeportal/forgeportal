import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRepoHandler } from '../../../actions/scm/create-repo.handler.js';
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
    getRepo: vi.fn().mockRejectedValue({ status: 404 }),
    getFile: vi.fn(),
    createRepo: vi.fn().mockResolvedValue({
      url: 'https://github.com/acme/my-repo',
      defaultBranch: 'main',
    }),
    createOrUpdateFile: vi.fn(),
    createPullRequest: vi.fn(),
    listPullRequests: vi.fn(),
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

const validInput = {
  provider: 'github',
  owner: 'acme',
  repo: 'my-repo',
};

describe('CreateRepoHandler', () => {
  let handler: CreateRepoHandler;
  let scm: SCMProvider;

  beforeEach(() => {
    scm = makeScm();
    handler = new CreateRepoHandler(makeProviders(scm));
  });

  it('repo does not exist → createRepo called, returns success with repoUrl', async () => {
    const ctx = makeCtx(validInput);
    const result = await handler.execute(ctx);

    expect(scm.createRepo).toHaveBeenCalledOnce();
    expect(result.status).toBe('success');
    expect(result.outputs.repoUrl).toBe('https://github.com/acme/my-repo');
    expect(result.outputs.defaultBranch).toBe('main');
    expect(result.links).toHaveLength(1);
  });

  it('repo already exists → createRepo NOT called, returns success + warning', async () => {
    const existing = { url: 'https://github.com/acme/my-repo', defaultBranch: 'main' };
    scm = makeScm({ getRepo: vi.fn().mockResolvedValue(existing) });
    handler = new CreateRepoHandler(makeProviders(scm));

    const ctx = makeCtx(validInput);
    const result = await handler.execute(ctx);

    expect(scm.createRepo).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.warnings).toContain('Repository already existed — no changes made');
  });

  it('unknown provider → VALIDATION_ERROR without calling any SCM method', async () => {
    const ctx = makeCtx({ ...validInput, provider: 'bitbucket' });
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(scm.getRepo).not.toHaveBeenCalled();
    expect(scm.createRepo).not.toHaveBeenCalled();
  });

  it('missing required field owner → VALIDATION_ERROR', async () => {
    const ctx = makeCtx({ provider: 'github', repo: 'my-repo' });
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('createRepo throws 401 → AUTH_ERROR', async () => {
    scm = makeScm({ createRepo: vi.fn().mockRejectedValue({ status: 401, message: 'Bad credentials' }) });
    handler = new CreateRepoHandler(makeProviders(scm));

    const ctx = makeCtx(validInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'AUTH_ERROR' });
  });

  it('createRepo throws 429 → RATE_LIMITED', async () => {
    scm = makeScm({ createRepo: vi.fn().mockRejectedValue({ status: 429 }) });
    handler = new CreateRepoHandler(makeProviders(scm));

    const ctx = makeCtx(validInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('personal account — createRepo succeeds (user endpoint fallback handled by SCM layer)', async () => {
    // The handler itself is agnostic: it delegates to scm.createRepo().
    // GitHubProvider.createRepo() handles the org→user fallback internally.
    // We verify the handler correctly passes owner as org and returns the result.
    scm = makeScm({
      createRepo: vi.fn().mockResolvedValue({
        url: 'https://github.com/john/personal-repo',
        defaultBranch: 'main',
      }),
    });
    handler = new CreateRepoHandler(makeProviders(scm));

    const ctx = makeCtx({ provider: 'github', owner: 'john', repo: 'personal-repo' });
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.outputs.repoUrl).toBe('https://github.com/john/personal-repo');
    expect(scm.createRepo).toHaveBeenCalledWith(
      expect.objectContaining({ org: 'john', name: 'personal-repo' }),
    );
  });
});
