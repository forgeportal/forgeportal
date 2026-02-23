import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushSkeletonHandler } from '../../../actions/scm/push-skeleton.handler.js';
import type { ActionContext } from '../../../types.js';
import type { SCMProvider, SCMProviders } from '@forgeportal/scm';

const FILE_A = { path: 'a.md', contentBase64: Buffer.from('# A').toString('base64') };
const FILE_B = { path: 'b.md', contentBase64: Buffer.from('# B').toString('base64') };
const FILE_C = { path: 'c.md', contentBase64: Buffer.from('# C').toString('base64') };

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
    createOrUpdateFile: vi.fn().mockResolvedValue({ sha: 'sha-new', url: '' }),
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
  files: [FILE_A, FILE_B, FILE_C],
};

describe('PushSkeletonHandler', () => {
  let handler: PushSkeletonHandler;
  let scm: SCMProvider;

  beforeEach(() => {
    scm = makeScm();
    handler = new PushSkeletonHandler(makeProviders(scm));
  });

  it('3 new files → all written sequentially, changedFiles=[3]', async () => {
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledTimes(3);
    expect(result.status).toBe('success');
    expect((result.outputs.changedFiles as string[])).toHaveLength(3);
    expect((result.outputs.commitShas as string[])).toHaveLength(3);
    expect(result.warnings).toHaveLength(0);
  });

  it('2 new + 1 unchanged → changedFiles=[2], warning about skipped file', async () => {
    scm = makeScm({
      getFile: vi.fn().mockImplementation((_ref, path) => {
        if (path === FILE_C.path) {
          return Promise.resolve({ path: FILE_C.path, content: '# C', sha: 'sha-c', encoding: 'utf-8' });
        }
        return Promise.resolve(null);
      }),
    });
    handler = new PushSkeletonHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledTimes(2);
    expect((result.outputs.changedFiles as string[])).toHaveLength(2);
    expect(result.warnings).toContain('1 file(s) unchanged and skipped');
  });

  it('advisory lock acquired once before first write', async () => {
    const ctx = makeCtx(baseInput);
    const lockSpy = ctx.acquireRepoLock as ReturnType<typeof vi.fn>;

    await handler.execute(ctx);

    expect(lockSpy).toHaveBeenCalledOnce();
    expect(lockSpy).toHaveBeenCalledWith('https://github.com/acme/my-repo');
    const lockOrder = lockSpy.mock.invocationCallOrder[0];
    const firstWriteOrder = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(firstWriteOrder);
  });

  it('second file fails → REMOTE_ERROR thrown', async () => {
    let callCount = 0;
    scm = makeScm({
      createOrUpdateFile: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) return Promise.reject({ status: 500, message: 'Server error' });
        return Promise.resolve({ sha: 'sha-ok', url: '' });
      }),
    });
    handler = new PushSkeletonHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'REMOTE_ERROR' });
  });

  it('empty files array → VALIDATION_ERROR', async () => {
    const ctx = makeCtx({ ...baseInput, files: [] });
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
