import type {
  ClusterConfig,
  WorkloadsResponse,
  RawDeployment,
  RawPod,
  RawService,
  RawIngress,
  K8sDeployment,
  K8sPod,
  K8sService,
  K8sIngress,
} from './types.js';

// ─── Cluster config parser ────────────────────────────────────────────────────

/**
 * Parse the `clusters` JSON string from plugin config and resolve per-cluster
 * tokens from environment variables.
 *
 * Token env var convention: FORGEPORTAL_PLUGIN_KUBERNETES_<CLUSTER_NAME_UPPER>_TOKEN
 * e.g. cluster "production" → FORGEPORTAL_PLUGIN_KUBERNETES_PRODUCTION_TOKEN
 */
export function parseClusters(
  rawClustersJson: string,
  getToken: (envKey: string) => string | undefined,
): ClusterConfig[] {
  let raw: Array<{ name: string; url: string; skipTLSVerify?: boolean }>;
  try {
    raw = JSON.parse(rawClustersJson) as typeof raw;
  } catch {
    throw new Error(
      'kubernetes plugin: config.clusters must be a valid JSON string representing an array of {name, url} objects',
    );
  }

  return raw.map((c) => {
    const envKey = c.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    return {
      name:          c.name,
      url:           c.url.replace(/\/$/, ''),
      token:         getToken(envKey) ?? '',
      skipTLSVerify: c.skipTLSVerify ?? false,
    };
  });
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapDeployment(d: RawDeployment): K8sDeployment {
  const desired   = d.spec.replicas ?? 1;
  const ready     = d.status?.readyReplicas ?? 0;
  const available = d.status?.availableReplicas ?? 0;
  const image     = d.spec.template.spec.containers[0]?.image ?? '';

  const rolloutCondition = d.status?.conditions?.find((c) => c.type === 'Progressing');
  const lastRollout      = rolloutCondition?.lastUpdateTime ?? d.metadata.creationTimestamp ?? null;

  return {
    name:        d.metadata.name,
    namespace:   d.metadata.namespace,
    replicas:    { desired, ready, available },
    image,
    lastRollout,
    healthy:     ready >= desired && desired > 0,
  };
}

function resolvePodStatus(pod: RawPod): string {
  // Check for CrashLoopBackOff in any container's waiting state
  for (const cs of pod.status?.containerStatuses ?? []) {
    if (cs.state?.waiting?.reason === 'CrashLoopBackOff') return 'CrashLoopBackOff';
  }
  return pod.status?.phase ?? 'Unknown';
}

function mapPod(p: RawPod): K8sPod {
  const containerStatuses = p.status?.containerStatuses ?? [];
  const ready = containerStatuses.length > 0 && containerStatuses.every((cs) => cs.ready);

  return {
    name:       p.metadata.name,
    namespace:  p.metadata.namespace,
    status:     resolvePodStatus(p),
    ready,
    containers: p.spec?.containers?.length ?? containerStatuses.length,
    nodeName:   p.spec?.nodeName ?? null,
    startTime:  p.status?.startTime ?? null,
  };
}

function mapService(s: RawService): K8sService {
  return {
    name:      s.metadata.name,
    namespace: s.metadata.namespace,
    type:      s.spec?.type ?? 'ClusterIP',
    clusterIp: s.spec?.clusterIP ?? '',
    ports:     (s.spec?.ports ?? []).map((p) => ({
      port:       p.port,
      protocol:   p.protocol ?? 'TCP',
      targetPort: p.targetPort ?? p.port,
    })),
  };
}

function mapIngress(i: RawIngress): K8sIngress {
  const hosts = (i.spec?.rules ?? [])
    .map((r) => r.host ?? '')
    .filter(Boolean);

  return {
    name:      i.metadata.name,
    namespace: i.metadata.namespace,
    hosts,
    tls:       (i.spec?.tls?.length ?? 0) > 0,
  };
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class KubernetesApiClient {
  constructor(private readonly cluster: ClusterConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.cluster.url}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cluster.token}`,
        Accept:        'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`Kubernetes API [${this.cluster.name}] ${path} → ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Aggregate Deployments, Pods, Services, and Ingresses for the given label selector.
   */
  async getWorkloads(namespace: string, labelSelector: string): Promise<WorkloadsResponse> {
    const qs = `labelSelector=${encodeURIComponent(labelSelector)}&limit=100`;

    const [deployments, pods, services, ingresses] = await Promise.all([
      this.request<{ items: RawDeployment[] }>(
        `/apis/apps/v1/namespaces/${namespace}/deployments?${qs}`,
      ),
      this.request<{ items: RawPod[] }>(
        `/api/v1/namespaces/${namespace}/pods?${qs}`,
      ),
      this.request<{ items: RawService[] }>(
        `/api/v1/namespaces/${namespace}/services?${qs}`,
      ),
      this.request<{ items: RawIngress[] }>(
        `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses?${qs}`,
      ).catch(() => ({ items: [] as RawIngress[] })),
    ]);

    return {
      cluster:       this.cluster.name,
      namespace,
      labelSelector,
      deployments:   deployments.items.map(mapDeployment),
      pods:          pods.items.map(mapPod),
      services:      services.items.map(mapService),
      ingresses:     ingresses.items.map(mapIngress),
    };
  }

  /** Returns the last N log lines for a pod container as a plain string. */
  async getPodLogs(namespace: string, podName: string, tailLines = 100): Promise<string> {
    const path = `/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=${tailLines}&timestamps=true`;
    const res = await fetch(`${this.cluster.url}${path}`, {
      headers: { Authorization: `Bearer ${this.cluster.token}` },
    });
    if (!res.ok) throw new Error(`Pod logs [${podName}]: ${res.status}`);
    return res.text();
  }

  /** Trigger a rolling restart via a strategic merge patch on the pod template annotation. */
  async restartDeployment(namespace: string, deploymentName: string): Promise<void> {
    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() },
          },
        },
      },
    };
    await this.request<unknown>(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}`,
      {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
        body:    JSON.stringify(patch),
      },
    );
  }

  /** Scale a deployment to the desired replica count. */
  async scaleDeployment(namespace: string, deploymentName: string, replicas: number): Promise<void> {
    await this.request<unknown>(
      `/apis/apps/v1/namespaces/${namespace}/deployments/${deploymentName}/scale`,
      {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ spec: { replicas } }),
      },
    );
  }
}

// ─── Cluster resolver ─────────────────────────────────────────────────────────

export function resolveCluster(
  clusters: ClusterConfig[],
  clusterName?: string,
): ClusterConfig {
  if (!clusterName) {
    const first = clusters[0];
    if (!first) throw new Error('kubernetes plugin: no clusters configured');
    return first;
  }
  const found = clusters.find((c) => c.name === clusterName);
  if (!found) {
    throw new Error(
      `kubernetes plugin: cluster "${clusterName}" not found. Available: ${clusters.map((c) => c.name).join(', ')}`,
    );
  }
  return found;
}
