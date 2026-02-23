import { describe, it, expect, vi, beforeEach } from 'vitest';
import { K8sBootstrapHandler } from '../../../actions/platform/k8s-bootstrap.handler.js';
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

const baseInput = {
  provider: 'github',
  owner: 'acme',
  repo: 'my-service',
  name: 'my-service',
};

describe('K8sBootstrapHandler', () => {
  let scm: SCMProvider;
  let handler: K8sBootstrapHandler;

  beforeEach(() => {
    scm = makeScm();
    handler = new K8sBootstrapHandler(makeProviders(scm));
  });

  it('mode=helm → 4 files written including Chart.yaml and values.yaml', async () => {
    const ctx = makeCtx({ ...baseInput, mode: 'helm' });
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledTimes(4);
    expect(result.status).toBe('success');
    expect(result.outputs.path).toBe('charts/my-service/');
    const writtenFiles = result.outputs.writtenFiles as string[];
    expect(writtenFiles.some((f) => f.includes('Chart.yaml'))).toBe(true);
    expect(writtenFiles.some((f) => f.includes('values.yaml'))).toBe(true);
  });

  it('mode=manifests → 2 files written (deployment.yaml, service.yaml)', async () => {
    const ctx = makeCtx({ ...baseInput, mode: 'manifests' });
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledTimes(2);
    expect(result.outputs.path).toBe('k8s/');
    const writtenFiles = result.outputs.writtenFiles as string[];
    expect(writtenFiles).toContain('k8s/deployment.yaml');
    expect(writtenFiles).toContain('k8s/service.yaml');
  });

  it('servicePort appears in generated manifest files', async () => {
    const ctx = makeCtx({ ...baseInput, mode: 'manifests', servicePort: 9090 });
    await handler.execute(ctx);

    const allContent = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.calls
      .map((call: unknown[]) => call[2] as string)
      .join('\n');
    expect(allContent).toContain('9090');
  });
});
