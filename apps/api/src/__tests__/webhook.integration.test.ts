import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import { buildApp } from '../app.js';

const GITHUB_SECRET = 'test-github-webhook-secret';
const GITLAB_SECRET = 'test-gitlab-webhook-secret';

function signPayload(payload: string, secret: string): string {
  return (
    'sha256=' +
    crypto.createHmac('sha256', secret).update(payload).digest('hex')
  );
}

function githubPushPayload(files: string[] = ['src/main.ts']) {
  return {
    repository: {
      full_name: 'org/repo',
      html_url: 'https://github.com/org/repo',
      default_branch: 'main',
    },
    commits: [
      { id: 'abc123', added: files, modified: [], removed: [] },
    ],
  };
}

function gitlabPushPayload(files: string[] = ['src/main.ts']) {
  return {
    object_kind: 'push',
    project: {
      id: 42,
      path_with_namespace: 'group/project',
      web_url: 'https://gitlab.com/group/project',
      default_branch: 'main',
    },
    commits: [
      { id: 'def456', added: files, modified: [], removed: [] },
    ],
  };
}

function mockPool(): unknown {
  return {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT 1'))
        return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (sql.includes('FROM permissions WHERE'))
        return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO jobs'))
        return {
          rows: [
            {
              id: 'job-1',
              type: params?.[0],
              payload: JSON.parse((params?.[1] as string) ?? '{}'),
              status: 'queued',
              locked_by: null,
              locked_at: null,
              created_at: new Date(),
              finished_at: null,
            },
          ],
          rowCount: 1,
        };
      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
  };
}

function devConfig(): AppConfig {
  return {
    db: {
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'test',
      password: 'test',
      maxPoolSize: 5,
    },
    server: { port: 4000, host: '0.0.0.0', logLevel: 'error' },
    auth: { oidc: {}, sessionSecret: 'test-secret-at-least-16chars' },
    scm: {
      github: { webhookSecret: GITHUB_SECRET },
      gitlab: {
        baseUrl: 'https://gitlab.com',
        webhookSecret: GITLAB_SECRET,
      },
    },
    discovery: {
      orgs: [],
      entityFilePath: 'entity.yaml',
      intervalMinutes: 0,
    },
    migrations: {
      dir: 'tools/migration',
      runSeed: false,
      seedFile: 'tools/seed/seed_v1.sql',
    },
    plugins: {},
    encryptionKey: 'local-dev-key-change-in-prod-32chars!',
  } as unknown as AppConfig;
}

function mockScmProviders() {
  return {
    github: {
      name: 'github' as const,
      verifyWebhookSignature: (
        payload: Buffer | string,
        signature: string,
        secret: string,
      ) => {
        const expected =
          'sha256=' +
          crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        return signature === expected;
      },
      listRepos: async function* () {},
      getRepo: async () => ({}),
      getFile: async () => null,
      createRepo: async () => ({}),
      createOrUpdateFile: async () => ({}),
      createPullRequest: async () => ({}),
      ensureWebhook: async () => ({}),
    },
    gitlab: {
      name: 'gitlab' as const,
      verifyWebhookSignature: (
        _payload: Buffer | string,
        signature: string,
        secret: string,
      ) => {
        const sigBuf = Buffer.from(signature);
        const secretBuf = Buffer.from(secret);
        return (
          sigBuf.length === secretBuf.length &&
          crypto.timingSafeEqual(sigBuf, secretBuf)
        );
      },
      listRepos: async function* () {},
      getRepo: async () => ({}),
      getFile: async () => null,
      createRepo: async () => ({}),
      createOrUpdateFile: async () => ({}),
      createPullRequest: async () => ({}),
      ensureWebhook: async () => ({}),
    },
    all: function () {
      return [this.github, this.gitlab];
    },
    get: function (name: string) {
      if (name === 'github') return this.github;
      if (name === 'gitlab') return this.gitlab;
      return null;
    },
  };
}

describe('webhook integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(
      mockPool() as never,
      devConfig(),
      null,
      mockScmProviders() as never,
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GitHub push with valid HMAC → 200', async () => {
    const body = JSON.stringify(githubPushPayload());
    const signature = signPayload(body, GITHUB_SECRET);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'push',
        'x-github-delivery': crypto.randomUUID(),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('GitHub push with invalid HMAC → 401', async () => {
    const body = JSON.stringify(githubPushPayload());
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=invalid',
        'x-github-event': 'push',
        'x-github-delivery': crypto.randomUUID(),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe('Invalid webhook signature');
  });

  it('GitHub push with missing signature → 401', async () => {
    const body = JSON.stringify(githubPushPayload());
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'push',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it('GitLab push with valid token → 200', async () => {
    const body = JSON.stringify(gitlabPushPayload());
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-gitlab-token': GITLAB_SECRET,
        'x-gitlab-event': 'Push Hook',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('GitLab push with invalid token → 401', async () => {
    const payload = gitlabPushPayload(['src/other.ts']);
    payload.commits[0].id = 'unique-gl-invalid-' + crypto.randomUUID();
    const body = JSON.stringify(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-gitlab-token': 'wrong-token-xxxxxxxxxx',
        'x-gitlab-event': 'Push Hook',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });

  it('Duplicate event ID → 200 with action duplicate', async () => {
    const deliveryId = crypto.randomUUID();
    const body = JSON.stringify(githubPushPayload());
    const signature = signPayload(body, GITHUB_SECRET);
    const headers = {
      'content-type': 'application/json',
      'x-hub-signature-256': signature,
      'x-github-event': 'push',
      'x-github-delivery': deliveryId,
    };

    await app.inject({ method: 'POST', url: '/api/v1/webhooks/scm', headers, payload: body });
    const res = await app.inject({ method: 'POST', url: '/api/v1/webhooks/scm', headers, payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.json().action).toBe('duplicate');
  });

  it('Rate limit exceeded → 429', async () => {
    const rateApp = buildApp(
      mockPool() as never,
      devConfig(),
      null,
      mockScmProviders() as never,
    );
    await rateApp.ready();

    const body = JSON.stringify(githubPushPayload());
    const signature = signPayload(body, GITHUB_SECRET);

    for (let i = 0; i < 100; i++) {
      await rateApp.inject({
        method: 'POST',
        url: '/api/v1/webhooks/scm',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
          'x-github-event': 'push',
          'x-github-delivery': crypto.randomUUID(),
        },
        payload: body,
      });
    }

    const res = await rateApp.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'push',
        'x-github-delivery': crypto.randomUUID(),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    const retryAfter = parseInt(res.headers['retry-after'] as string, 10);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    await rateApp.close();
  });

  it('Unknown event type → 200 with action ignored', async () => {
    const body = JSON.stringify(githubPushPayload());
    const signature = signPayload(body, GITHUB_SECRET);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/scm',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signature,
        'x-github-event': 'issues',
        'x-github-delivery': crypto.randomUUID(),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().action).toBe('ignored');
  });
});

