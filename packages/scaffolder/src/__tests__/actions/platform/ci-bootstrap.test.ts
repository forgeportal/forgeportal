import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CiBootstrapHandler } from '../../../actions/platform/ci-bootstrap.handler.js';
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
    getFile: vi.fn().mockResolvedValue(null),
    createRepo: vi.fn(),
    createOrUpdateFile: vi.fn().mockResolvedValue({ sha: 'sha1', url: '' }),
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

describe('CiBootstrapHandler', () => {
  let scm: SCMProvider;
  let handler: CiBootstrapHandler;

  beforeEach(() => {
    scm = makeScm();
    handler = new CiBootstrapHandler(makeProviders(scm));
  });

  it('type=github-actions, language=node → .github/workflows/ci.yml contains setup-node', async () => {
    const ctx = makeCtx({
      provider: 'github',
      owner: 'acme',
      repo: 'my-service',
      type: 'github-actions',
      language: 'node',
    });
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.outputs.ciFile).toBe('.github/workflows/ci.yml');

    const writtenContent = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(writtenContent).toContain('setup-node');
    expect(writtenContent).toContain('npm test');
  });

  it('type=gitlab-ci, language=go → .gitlab-ci.yml written', async () => {
    handler = new CiBootstrapHandler({
      github: null,
      gitlab: scm as never,
      all: () => [scm],
      get: (name) => (name === 'gitlab' ? scm : null),
    });

    const ctx = makeCtx({
      provider: 'gitlab',
      owner: 'acme',
      repo: 'my-service',
      type: 'gitlab-ci',
      language: 'go',
    });
    const result = await handler.execute(ctx);

    expect(result.outputs.ciFile).toBe('.gitlab-ci.yml');
    const content = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(content).toContain('golang:1.23');
    expect(content).toContain('go test ./...');
  });

  it('language=java → setup-java step in GitHub Actions template', async () => {
    const ctx = makeCtx({
      provider: 'github',
      owner: 'acme',
      repo: 'my-service',
      type: 'github-actions',
      language: 'java',
    });
    await handler.execute(ctx);

    const content = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(content).toContain('setup-java');
    expect(content).toContain('mvn test');
  });

  it('custom buildCommand overrides language default', async () => {
    const ctx = makeCtx({
      provider: 'github',
      owner: 'acme',
      repo: 'my-service',
      type: 'github-actions',
      language: 'node',
      buildCommand: 'make build',
    });
    await handler.execute(ctx);

    const content = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(content).toContain('make build');
    expect(content).not.toContain('npm install');
  });
});
