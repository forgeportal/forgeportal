import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsBootstrapHandler } from '../../../actions/platform/docs-bootstrap.handler.js';
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

function makePool() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ entity_id: 'entity-1', repo_url: 'r', docs_path: 'docs' }] }),
  };
}

const baseInput = {
  provider: 'github',
  owner: 'acme',
  repo: 'my-service',
};

describe('DocsBootstrapHandler', () => {
  let scm: SCMProvider;
  let handler: DocsBootstrapHandler;

  beforeEach(() => {
    scm = makeScm();
    handler = new DocsBootstrapHandler(makePool() as never, makeProviders(scm));
  });

  it('docs/index.md does not exist → file created', async () => {
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).toHaveBeenCalledOnce();
    const args = (scm.createOrUpdateFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[1]).toBe('docs/index.md');
    expect(result.status).toBe('success');
    expect(result.outputs.docsHome).toBe('docs/index.md');
  });

  it('file already exists with same content → no SCM write', async () => {
    // Build the exact same content the handler generates
    const expectedContent = `# my-service Documentation\n\nWelcome to the documentation for **my-service**.\n\n## Overview\n\nAdd your service overview here.\n\n## Getting Started\n\nDescribe how to get started with this service.\n`;
    scm = makeScm({
      getFile: vi.fn().mockResolvedValue({
        path: 'docs/index.md',
        content: expectedContent,
        sha: 'sha-existing',
        encoding: 'utf-8',
      }),
    });
    handler = new DocsBootstrapHandler(makePool() as never, makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.createOrUpdateFile).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
  });

  it('entityId provided → docs_bindings upserted (pool.query called with docs_bindings)', async () => {
    const pool = makePool();
    handler = new DocsBootstrapHandler(pool as never, makeProviders(scm));

    const ctx = makeCtx({
      ...baseInput,
      entityId: '00000000-0000-0000-0000-000000000001',
    });
    await handler.execute(ctx);

    const docsBindingCall = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('docs_bindings'),
    );
    expect(docsBindingCall).toBeDefined();
  });

  it('no entityId → warning in result, no docs_bindings DB write', async () => {
    const pool = makePool();
    handler = new DocsBootstrapHandler(pool as never, makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(result.warnings?.[0]).toContain('No entityId');
    const docsBindingCall = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('docs_bindings'),
    );
    expect(docsBindingCall).toBeUndefined();
  });
});
