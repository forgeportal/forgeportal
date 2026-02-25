import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KubernetesApiClient, parseClusters, resolveCluster } from '../api-client.js';
import type { ClusterConfig, RawDeployment, RawPod } from '../types.js';

// ── Test cluster fixture ──────────────────────────────────────────────────────

const CLUSTER: ClusterConfig = {
  name:          'test-cluster',
  url:           'https://k8s.test.internal',
  token:         'test-token',
  skipTLSVerify: false,
};

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetchJson(body: unknown, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   () => Promise.resolve(body),
    text:   () => Promise.resolve(JSON.stringify(body)),
    statusText: status === 200 ? 'OK' : 'Error',
  }));
}

function mockFetchText(text: string, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    text:   () => Promise.resolve(text),
    json:   () => Promise.reject(new Error('not JSON')),
  }));
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

// ── parseClusters ─────────────────────────────────────────────────────────────

describe('parseClusters', () => {
  it('parses a valid clusters JSON string', () => {
    const json = JSON.stringify([
      { name: 'production', url: 'https://k8s-prod.internal', skipTLSVerify: false },
      { name: 'staging',    url: 'https://k8s-stg.internal',  skipTLSVerify: true },
    ]);

    const clusters = parseClusters(json, (key) => `token-${key.toLowerCase()}`);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toMatchObject({
      name:          'production',
      url:           'https://k8s-prod.internal',
      token:         'token-production',
      skipTLSVerify: false,
    });
    expect(clusters[1]).toMatchObject({
      name:          'staging',
      token:         'token-staging',
      skipTLSVerify: true,
    });
  });

  it('strips trailing slash from cluster URL', () => {
    const json = JSON.stringify([{ name: 'dev', url: 'https://k8s.dev.internal/' }]);
    const clusters = parseClusters(json, () => undefined);
    expect(clusters[0]?.url).toBe('https://k8s.dev.internal');
  });

  it('defaults skipTLSVerify to false when not provided', () => {
    const json = JSON.stringify([{ name: 'dev', url: 'https://k8s.dev.internal' }]);
    const clusters = parseClusters(json, () => undefined);
    expect(clusters[0]?.skipTLSVerify).toBe(false);
  });

  it('uses empty string token when env var is not set', () => {
    const json = JSON.stringify([{ name: 'dev', url: 'https://k8s.dev.internal' }]);
    const clusters = parseClusters(json, () => undefined);
    expect(clusters[0]?.token).toBe('');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseClusters('not-json', () => undefined)).toThrow(/valid JSON/);
  });
});

// ── resolveCluster ────────────────────────────────────────────────────────────

describe('resolveCluster', () => {
  const clusters: ClusterConfig[] = [
    { name: 'prod',    url: 'https://prod', token: 't1', skipTLSVerify: false },
    { name: 'staging', url: 'https://stg',  token: 't2', skipTLSVerify: true  },
  ];

  it('returns first cluster when no name is provided', () => {
    expect(resolveCluster(clusters)).toBe(clusters[0]);
  });

  it('resolves cluster by name', () => {
    expect(resolveCluster(clusters, 'staging')).toBe(clusters[1]);
  });

  it('throws when named cluster does not exist', () => {
    expect(() => resolveCluster(clusters, 'ghost')).toThrow(/not found/);
  });

  it('throws when cluster list is empty', () => {
    expect(() => resolveCluster([])).toThrow(/no clusters configured/);
  });
});

// ── KubernetesApiClient.getWorkloads ──────────────────────────────────────────

describe('KubernetesApiClient.getWorkloads', () => {
  const client = new KubernetesApiClient(CLUSTER);

  const rawDeployment: RawDeployment = {
    metadata: { name: 'payment-api', namespace: 'production' },
    spec: {
      replicas: 3,
      template: { spec: { containers: [{ image: 'registry.io/payment-api:v1.2.3' }] } },
    },
    status: {
      replicas:          3,
      readyReplicas:     3,
      availableReplicas: 3,
      conditions:        [{ type: 'Progressing', status: 'True', lastUpdateTime: '2026-02-20T10:00:00Z' }],
    },
  };

  const rawPod: RawPod = {
    metadata: { name: 'payment-api-abc12', namespace: 'production' },
    spec:     { nodeName: 'node-1', containers: [{ name: 'payment-api' }] },
    status:   {
      phase:             'Running',
      startTime:         '2026-02-20T09:00:00Z',
      containerStatuses: [{ ready: true, state: {} }],
    },
  };

  it('returns normalised workloads on success', async () => {
    const mockResponse = (url: string) => {
      if (url.includes('/deployments')) return { items: [rawDeployment] };
      if (url.includes('/pods'))        return { items: [rawPod] };
      if (url.includes('/services'))    return { items: [] };
      return { items: [] };
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok:     true,
        status: 200,
        json:   () => Promise.resolve(mockResponse(url)),
        text:   () => Promise.resolve(''),
      }),
    ));

    const result = await client.getWorkloads('production', 'app=payment-api');

    expect(result.cluster).toBe('test-cluster');
    expect(result.namespace).toBe('production');
    expect(result.labelSelector).toBe('app=payment-api');

    expect(result.deployments).toHaveLength(1);
    expect(result.deployments[0]).toMatchObject({
      name:    'payment-api',
      healthy: true,
      replicas: { desired: 3, ready: 3, available: 3 },
      image:   'registry.io/payment-api:v1.2.3',
    });

    expect(result.pods).toHaveLength(1);
    expect(result.pods[0]).toMatchObject({
      name:   'payment-api-abc12',
      status: 'Running',
      ready:  true,
    });
  });

  it('marks deployment unhealthy when readyReplicas < replicas', async () => {
    const unhealthyDeployment: RawDeployment = {
      ...rawDeployment,
      status: { replicas: 3, readyReplicas: 1, availableReplicas: 1 },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok:   true,
        status: 200,
        json: () => Promise.resolve(url.includes('/deployments')
          ? { items: [unhealthyDeployment] }
          : { items: [] }),
        text: () => Promise.resolve(''),
      }),
    ));

    const result = await client.getWorkloads('production', 'app=payment-api');
    expect(result.deployments[0]?.healthy).toBe(false);
  });

  it('detects CrashLoopBackOff pod status', async () => {
    const crashPod: RawPod = {
      ...rawPod,
      status: {
        phase:             'Running',
        containerStatuses: [{ ready: false, state: { waiting: { reason: 'CrashLoopBackOff' } } }],
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok:   true,
        status: 200,
        json: () => Promise.resolve(url.includes('/pods')
          ? { items: [crashPod] }
          : { items: [] }),
        text: () => Promise.resolve(''),
      }),
    ));

    const result = await client.getWorkloads('production', 'app=crash');
    expect(result.pods[0]?.status).toBe('CrashLoopBackOff');
    expect(result.pods[0]?.ready).toBe(false);
  });

  it('sends the Authorization header with the Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ items: [] }),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    await client.getWorkloads('default', 'app=test');

    const firstCall = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((firstCall[1].headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  it('throws on non-ok response from K8s API', async () => {
    mockFetchJson({ message: 'Forbidden' }, 403);
    await expect(client.getWorkloads('default', 'app=test')).rejects.toThrow('403');
  });

  it('gracefully handles ingress API failure (returns empty ingresses)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok:   !url.includes('/ingresses'),
        status: url.includes('/ingresses') ? 404 : 200,
        json: () => Promise.resolve({ items: [] }),
        text: () => Promise.resolve('404 Not Found'),
      }),
    ));

    const result = await client.getWorkloads('default', 'app=test');
    expect(result.ingresses).toHaveLength(0);
  });
});

// ── KubernetesApiClient.getPodLogs ────────────────────────────────────────────

describe('KubernetesApiClient.getPodLogs', () => {
  const client = new KubernetesApiClient(CLUSTER);

  it('returns log text on success', async () => {
    const logText = '2026-02-20T10:00:00Z INFO Server started\n2026-02-20T10:00:01Z INFO Listening on :8080';
    mockFetchText(logText);

    const logs = await client.getPodLogs('default', 'my-pod-abc12');
    expect(logs).toBe(logText);
  });

  it('requests the correct tailLines parameter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, text: () => Promise.resolve('log line'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await client.getPodLogs('default', 'my-pod', 200);

    const url = (fetchMock.mock.calls[0] as [string])[0];
    expect(url).toContain('tailLines=200');
  });

  it('throws on non-ok response', async () => {
    mockFetchText('Not found', 404);
    await expect(client.getPodLogs('default', 'ghost-pod')).rejects.toThrow('404');
  });
});

// ── KubernetesApiClient.restartDeployment ─────────────────────────────────────

describe('KubernetesApiClient.restartDeployment', () => {
  const client = new KubernetesApiClient(CLUSTER);

  it('sends a PATCH request with strategic merge patch content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });
    vi.stubGlobal('fetch', fetchMock);

    await client.restartDeployment('production', 'payment-api');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/deployments/payment-api');
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('strategic-merge-patch');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    const annotations = (
      (body as { spec: { template: { metadata: { annotations: Record<string, string> } } } })
        .spec.template.metadata.annotations
    );
    // use direct key access — toHaveProperty interprets '.' as path separator
    expect(annotations['kubectl.kubernetes.io/restartedAt']).toBeDefined();
    expect(typeof annotations['kubectl.kubernetes.io/restartedAt']).toBe('string');
  });

  it('throws on K8s API error', async () => {
    mockFetchJson({ message: 'Forbidden' }, 403);
    await expect(client.restartDeployment('production', 'payment-api')).rejects.toThrow('403');
  });
});
