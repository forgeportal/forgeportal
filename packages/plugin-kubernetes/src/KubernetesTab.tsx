import React, { useState } from 'react';
import { useApi } from '@forgeportal/plugin-sdk/react';
import type { Entity } from '@forgeportal/plugin-sdk';
import type { WorkloadsResponse } from './types.js';
import { PodStatusBadge } from './PodStatusBadge.js';
import { LogsDrawer } from './LogsDrawer.js';

// ─── Catalog entity shape (annotations not in SDK Entity) ────────────────────

interface FullEntity {
  id:          string;
  annotations: Record<string, string> | null;
  spec?:       Record<string, unknown>;
}

interface EntityDetailResponse {
  data: { entity: FullEntity };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{count}</span>
    </div>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }): React.ReactElement {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-sm text-gray-400">{message}</td>
    </tr>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

interface KubernetesTabProps {
  entity: Entity;
}

export function KubernetesTab({ entity }: KubernetesTabProps): React.ReactElement {
  const [selectedCluster, _setSelectedCluster] = useState<string | undefined>(undefined);
  const [logsTarget, setLogsTarget] = useState<{ podName: string; namespace: string } | null>(null);

  // Fetch full entity to read annotations (SDK Entity type doesn't include them)
  const {
    data: entityDetail,
    isPending: entityLoading,
  } = useApi<EntityDetailResponse>(`/api/v1/catalog/entities/${entity.id}`);

  const annotations  = entityDetail?.data.entity.annotations ?? {};
  const labelSelector = annotations['forgeportal.dev/k8s-label-selector'];
  const clusterAnnotation = annotations['forgeportal.dev/k8s-cluster'];

  const activeCluster = selectedCluster ?? clusterAnnotation;

  // Build workloads URL — only when label selector is known
  const workloadsParams = labelSelector
    ? new URLSearchParams({
        labelSelector,
        ...(activeCluster ? { cluster: activeCluster } : {}),
      })
    : null;

  const workloadsUrl = workloadsParams
    ? `/api/v1/plugins/kubernetes/entities/${entity.id}/workloads?${workloadsParams.toString()}`
    : null;

  const {
    data: workloadsData,
    isPending: workloadsLoading,
    isError,
    error,
    refetch,
  } = useApi<{ data: WorkloadsResponse }>(workloadsUrl ?? '', {
    enabled:        !!workloadsUrl,
    refetchInterval: 15_000,
    retry:           1,
  });

  // ── Not configured state
  if (!entityLoading && !labelSelector) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">Kubernetes not configured for this entity</p>
        <p className="text-xs text-gray-500 mb-4">
          Add the annotation <code className="rounded bg-gray-100 px-1 py-0.5">forgeportal.dev/k8s-label-selector</code> to your <code className="rounded bg-gray-100 px-1 py-0.5">entity.yaml</code> to see live workloads.
        </p>
        <pre className="mx-auto max-w-md rounded bg-gray-800 p-3 text-left text-xs text-green-300">
          {`metadata:\n  annotations:\n    forgeportal.dev/k8s-label-selector: "app=${entity.name}"\n    forgeportal.dev/k8s-cluster: production  # optional`}
        </pre>
      </div>
    );
  }

  const workloads = workloadsData?.data;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {workloads && (
            <span className="text-xs text-gray-500">
              Cluster: <strong>{workloads.cluster}</strong> · ns: <strong>{workloads.namespace}</strong>
              {workloads.labelSelector ? ` · selector: ${workloads.labelSelector}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Multi-cluster dropdown — rendered only when multiple clusters exist */}
          <div id="cluster-select-portal" />
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {(entityLoading || workloadsLoading) && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load workloads: {error?.message}
        </div>
      )}

      {/* Deployments */}
      {workloads && (
        <>
          <section>
            <SectionHeader title="Deployments" count={workloads.deployments.length} />
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ready</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Rollout</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {workloads.deployments.length === 0 && (
                    <EmptyRow cols={5} message="No deployments found" />
                  )}
                  {workloads.deployments.map((d) => (
                    <tr key={d.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${d.healthy ? 'text-green-700' : 'text-red-600'}`}>
                          {d.replicas.ready}/{d.replicas.desired}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate text-xs text-gray-600" title={d.image}>
                        {d.image.split('/').pop()}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {d.lastRollout ? new Date(d.lastRollout).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <RestartButton
                          entityId={entity.id}
                          deploymentName={d.name}
                          namespace={workloads.namespace}
                          cluster={workloads.cluster}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pods */}
          <section>
            <SectionHeader title="Pods" count={workloads.pods.length} />
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Containers</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Node</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Logs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {workloads.pods.length === 0 && (
                    <EmptyRow cols={6} message="No pods found" />
                  )}
                  {workloads.pods.map((p) => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs text-gray-800">{p.name}</td>
                      <td className="px-4 py-2"><PodStatusBadge status={p.status} /></td>
                      <td className="px-4 py-2 text-xs text-gray-600">{p.containers}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{p.nodeName ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {p.startTime ? formatAge(p.startTime) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setLogsTarget({ podName: p.name, namespace: workloads.namespace })}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          View logs
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Services */}
          <section>
            <SectionHeader title="Services" count={workloads.services.length} />
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cluster IP</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ports</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {workloads.services.length === 0 && (
                    <EmptyRow cols={4} message="No services found" />
                  )}
                  {workloads.services.map((s) => (
                    <tr key={s.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{s.type}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600">{s.clusterIp || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {s.ports.map((p) => `${p.port}/${p.protocol}`).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Ingresses */}
          {workloads.ingresses.length > 0 && (
            <section>
              <SectionHeader title="Ingresses" count={workloads.ingresses.length} />
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hosts</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TLS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {workloads.ingresses.map((i) => (
                      <tr key={i.name} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{i.name}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{i.hosts.join(', ') || '—'}</td>
                        <td className="px-4 py-2 text-xs">
                          {i.tls
                            ? <span className="text-green-700 font-medium">Yes</span>
                            : <span className="text-gray-400">No</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* Logs drawer */}
      {logsTarget && workloads && (
        <LogsDrawer
          entityId={entity.id}
          podName={logsTarget.podName}
          namespace={logsTarget.namespace}
          cluster={activeCluster}
          onClose={() => setLogsTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Restart button ───────────────────────────────────────────────────────────

function RestartButton({
  entityId,
  deploymentName,
  namespace,
  cluster,
}: {
  entityId:       string;
  deploymentName: string;
  namespace:      string;
  cluster:        string;
}): React.ReactElement {
  const [loading,  setLoading]  = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRestart = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/v1/plugins/kubernetes/entities/${entityId}/deployments/${encodeURIComponent(deploymentName)}/restart`,
        {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ namespace, cluster }),
        },
      );
      setFeedback(res.ok ? 'Restarted' : 'Failed');
    } catch {
      setFeedback('Error');
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  if (feedback) {
    return (
      <span className={`text-xs font-medium ${feedback === 'Restarted' ? 'text-green-600' : 'text-red-600'}`}>
        {feedback}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleRestart()}
      disabled={loading}
      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 disabled:opacity-50 transition-colors"
    >
      {loading ? '…' : 'Restart'}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(isoTime: string): string {
  const diffMs  = Date.now() - new Date(isoTime).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
