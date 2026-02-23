import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnsureWebhookHandler } from '../../../actions/scm/ensure-webhook.handler.js';
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
    createPullRequest: vi.fn(),
    listPullRequests: vi.fn(),
    ensureWebhook: vi.fn().mockResolvedValue({ id: 101, url: 'https://hook.example.com', active: true }),
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
  callbackUrl: 'https://forgeportal.example.com/webhook',
};

describe('EnsureWebhookHandler', () => {
  let handler: EnsureWebhookHandler;
  let scm: SCMProvider;

  beforeEach(() => {
    scm = makeScm();
    handler = new EnsureWebhookHandler(makeProviders(scm));
  });

  it('webhook does not exist → ensureWebhook called, returns webhookId', async () => {
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.ensureWebhook).toHaveBeenCalledOnce();
    expect(scm.ensureWebhook).toHaveBeenCalledWith(
      { owner: 'acme', repo: 'my-repo' },
      'https://forgeportal.example.com/webhook',
      ['push'],
    );
    expect(result.status).toBe('success');
    expect(result.outputs.webhookId).toBe('101');
  });

  it('webhook already active → ensureWebhook still called (provider handles idempotency), returns existing', async () => {
    scm = makeScm({
      ensureWebhook: vi.fn().mockResolvedValue({ id: 55, url: 'https://forgeportal.example.com/webhook', active: true }),
    });
    handler = new EnsureWebhookHandler(makeProviders(scm));

    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(scm.ensureWebhook).toHaveBeenCalledOnce();
    expect(result.outputs.webhookId).toBe('55');
    expect(result.warnings).toHaveLength(0);
  });

  it('HTTP callbackUrl → warning added to ActionResult', async () => {
    const ctx = makeCtx({ ...baseInput, callbackUrl: 'http://insecure.example.com/webhook' });
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.warnings?.some((w) => w.includes('HTTP'))).toBe(true);
  });
});
