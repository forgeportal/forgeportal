import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateOrUpdateFileHandler } from '../../../actions/scm/create-or-update-file.handler.js';
import type { ActionContext } from '../../../types.js';
import type { SCMProvider, SCMProviders } from '@forgeportal/scm';

const HELLO_B64 = Buffer.from('hello').toString('base64');
const OTHER_B64 = Buffer.from('world').toString('base64');

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
    getFile: vi.fn().mockResolvedValue(null),
    createRepo: vi.fn(),
    createOrUpdateFile: vi.fn().mockResolvedValue({ sha: 'abc123', url: 'https://example.com' }),
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

const baseInput = {
  provider: 'github',
  owner: 'acme',
  repo: 'my-repo',
  path: 'src/main.ts',
  contentBase64: HELLO_B64,
  message: 'feat: add main.ts',
};

describe('CreateOrUpdateFileHandler', () => {
  let handler: CreateOrUpdateFileHandler;
  let scm: SCMProvider;

  beforeEach(() => {
    scm = makeScm();
    handler = new CreateOrUpdateFileHandler(makeProviders(scm));
  });

  it('file does not exist → creates it, returns commitSha', async () => {
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledOnce();
    expect(result.status).toBe('success');
    expect(result.outputs.commitSha).toBe('abc123');
  });

  it('file exists with same content → no-op success, createOrUpdateFile NOT called', async () => {
    scm = makeScm({
      getFile: vi.fn().mockResolvedValue({ path: 'src/main.ts', content: 'hello', sha: 'sha1', encoding: 'utf-8' }),
    });
    handler = new CreateOrUpdateFileHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.warnings).toContain('File unchanged — no write performed');
  });

  it('file exists with different content → updates using existing sha', async () => {
    scm = makeScm({
      getFile: vi.fn().mockResolvedValue({ path: 'src/main.ts', content: 'old content', sha: 'sha-old', encoding: 'utf-8' }),
    });
    handler = new CreateOrUpdateFileHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledWith(
      { owner: 'acme', repo: 'my-repo' },
      'src/main.ts',
      'hello',
      'feat: add main.ts',
      'main',
      'sha-old',
    );
    expect(result.status).toBe('success');
  });

  it('expectedSha provided but does not match existing sha → CONFLICT', async () => {
    scm = makeScm({
      getFile: vi.fn().mockResolvedValue({ path: 'src/main.ts', content: 'old', sha: 'sha-current', encoding: 'utf-8' }),
    });
    handler = new CreateOrUpdateFileHandler(makeProviders(scm));

    const ctx = makeCtx({ ...baseInput, contentBase64: OTHER_B64, expectedSha: 'sha-stale' });
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(scm.createOrUpdateFile).not.toHaveBeenCalled();
  });

  it('SCM returns 409 concurrent write → CONFLICT', async () => {
    scm = makeScm({
      createOrUpdateFile: vi.fn().mockRejectedValue({ status: 409, message: 'Conflict' }),
    });
    handler = new CreateOrUpdateFileHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
