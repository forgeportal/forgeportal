import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArgocdApiClient } from '../api-client.js';
import type { ArgocdConfig } from '../types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONFIG: ArgocdConfig = {
  url:      'https://argocd.test.internal',
  token:    'test-token',
  insecure: false,
};

const APP_FIXTURE = {
  metadata: { name: 'payments-api', namespace: 'default' },
  spec:     { source: { repoURL: 'https://github.com/acme/payments', path: 'k8s', targetRevision: 'HEAD' } },
  status: {
    sync:   { status: 'Synced',   revision: 'abc1234' },
    health: { status: 'Healthy' },
    reconciledAt: '2026-02-20T10:00:00Z',
    history: [
      { id: 0, revision: 'old123', deployedAt: '2026-02-18T08:00:00Z' },
      { id: 1, revision: 'abc1234', deployedAt: '2026-02-20T10:00:00Z' },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({
    ok:         status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json:       () => Promise.resolve(body),
    text:       () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

// ── Constructor ───────────────────────────────────────────────────────────────

describe('ArgocdApiClient constructor', () => {
  it('strips trailing slash from baseUrl', async () => {
    const client = new ArgocdApiClient({ ...CONFIG, url: 'https://argocd.test.internal/' });
    const fetchMock = mockFetch(APP_FIXTURE);
    await client.getApp('payments-api');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://argocd.test.internal/api/v1/applications/payments-api');
  });
});

// ── getApp ────────────────────────────────────────────────────────────────────

describe('ArgocdApiClient.getApp', () => {
  const client = new ArgocdApiClient(CONFIG);

  it('fetches app status and returns the response', async () => {
    mockFetch(APP_FIXTURE);
    const app = await client.getApp('payments-api');
    expect(app.status.sync.status).toBe('Synced');
    expect(app.status.health.status).toBe('Healthy');
  });

  it('URL-encodes the app name', async () => {
    const fetchMock = mockFetch(APP_FIXTURE);
    await client.getApp('my app/with spaces');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('my%20app%2Fwith%20spaces');
  });

  it('sends Bearer token in Authorization header', async () => {
    const fetchMock = mockFetch(APP_FIXTURE);
    await client.getApp('payments-api');
    const [, init] = fetchMock.mock.calls[0] as [string, Record<string, Record<string, string>>];
    expect(init.headers['Authorization']).toBe('Bearer test-token');
  });

  it('throws with status code on non-ok response', async () => {
    mockFetch({ message: 'Not Found' }, 404);
    await expect(client.getApp('ghost')).rejects.toThrow('404');
  });

  it('throws on 403 Forbidden', async () => {
    mockFetch({ message: 'permission denied' }, 403);
    await expect(client.getApp('payments-api')).rejects.toThrow('403');
  });
});

// ── getHistory ────────────────────────────────────────────────────────────────

describe('ArgocdApiClient.getHistory', () => {
  const client = new ArgocdApiClient(CONFIG);

  it('returns history entries in reverse chronological order', async () => {
    mockFetch(APP_FIXTURE);
    const history = await client.getHistory('payments-api');
    expect(history).toHaveLength(2);
    // reversed — most recent first
    expect(history[0]?.revision).toBe('abc1234');
    expect(history[1]?.revision).toBe('old123');
  });

  it('returns empty array when history is absent', async () => {
    const noHistory = { ...APP_FIXTURE, status: { ...APP_FIXTURE.status, history: undefined } };
    mockFetch(noHistory);
    const history = await client.getHistory('payments-api');
    expect(history).toHaveLength(0);
  });

  it('limits history to 10 entries', async () => {
    const manyHistory = Array.from({ length: 15 }, (_, i) => ({
      id: i, revision: `rev${i}`, deployedAt: '2026-01-01T00:00:00Z',
    }));
    mockFetch({ ...APP_FIXTURE, status: { ...APP_FIXTURE.status, history: manyHistory } });
    const history = await client.getHistory('payments-api');
    expect(history).toHaveLength(10);
  });
});

// ── syncApp ───────────────────────────────────────────────────────────────────

describe('ArgocdApiClient.syncApp', () => {
  const client = new ArgocdApiClient(CONFIG);

  it('sends a POST request to the sync endpoint', async () => {
    const fetchMock = mockFetch({}, 200);
    await client.syncApp('payments-api');
    const [url, init] = fetchMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toContain('/applications/payments-api/sync');
    expect(init.method).toBe('POST');
  });

  it('throws on ArgoCD error response', async () => {
    mockFetch({ message: 'application is being synced' }, 409);
    await expect(client.syncApp('payments-api')).rejects.toThrow('409');
  });
});

// ── rollbackApp ───────────────────────────────────────────────────────────────

describe('ArgocdApiClient.rollbackApp', () => {
  const client = new ArgocdApiClient(CONFIG);

  it('sends a POST request with the history ID', async () => {
    const fetchMock = mockFetch({}, 200);
    await client.rollbackApp('payments-api', 0);
    const [url, init] = fetchMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toContain('/applications/payments-api/rollback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ id: 0 });
  });
});
