import React, { useState, useCallback } from 'react';
import { useApi } from '@forgeportal/plugin-sdk/react';
import type { Entity } from '@forgeportal/plugin-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncStatus  { status: 'Synced' | 'OutOfSync' | 'Unknown'; revision?: string }
interface HealthStatus { status: 'Healthy' | 'Degraded' | 'Progressing' | 'Suspended' | 'Missing' | 'Unknown' }

interface ArgocdAppResponse {
  data: {
    metadata: { name: string; namespace: string };
    spec: {
      project: string;
      source?: { repoURL: string; targetRevision: string; path?: string };
      destination: { server: string; namespace: string };
    };
    status: {
      sync:            SyncStatus;
      health:          HealthStatus;
      operationState?: { phase: string; message?: string; startedAt: string; finishedAt?: string };
      reconciledAt?:   string;
    };
  };
}

interface HistoryItem {
  id:         number;
  revision:   string;
  deployedAt: string;
  initiatedBy?: { username?: string; automated?: boolean };
}

interface HistoryResponse { data: HistoryItem[] }

// ─── Badges ───────────────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: string }): React.ReactElement {
  const colours: Record<string, string> = {
    Synced:    'bg-green-100 text-green-800',
    OutOfSync: 'bg-amber-100 text-amber-800',
    Unknown:   'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colours[status] ?? colours['Unknown']}`}>
      {status}
    </span>
  );
}

function HealthBadge({ status }: { status: string }): React.ReactElement {
  const colours: Record<string, string> = {
    Healthy:     'bg-green-100 text-green-800',
    Degraded:    'bg-red-100 text-red-800',
    Progressing: 'bg-blue-100 text-blue-800',
    Suspended:   'bg-orange-100 text-orange-800',
    Missing:     'bg-gray-100 text-gray-600',
    Unknown:     'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colours[status] ?? colours['Unknown']}`}>
      {status}
    </span>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

interface ArgocdTabProps { entity: Entity }

export function ArgocdTab({ entity }: ArgocdTabProps): React.ReactElement {
  const [syncing,     setSyncing]     = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const annotations = entity.annotations ?? {};
  const appName     = annotations['forgeportal.dev/argocd-app-name'];

  // Not configured state
  if (!appName) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">ArgoCD not configured for this entity</p>
        <p className="text-xs text-gray-500 mb-4">
          Add the annotation{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">forgeportal.dev/argocd-app-name</code>{' '}
          to your <code className="rounded bg-gray-100 px-1 py-0.5">entity.yaml</code> to see the ArgoCD status.
        </p>
        <pre className="mx-auto max-w-md rounded bg-gray-800 p-3 text-left text-xs text-green-300">
          {`metadata:\n  annotations:\n    forgeportal.dev/argocd-app-name: my-app-prod\n    forgeportal.dev/argocd-project: platform  # optional`}
        </pre>
      </div>
    );
  }

  const {
    data:      appData,
    isPending: appLoading,
    error:     appError,
    refetch:   refetchApp,
  } = useApi<ArgocdAppResponse>(
    `/api/v1/plugins/argocd/entities/${entity.id}/app?appName=${encodeURIComponent(appName)}`,
    { refetchInterval: 30_000 },
  );

  const {
    data:      historyData,
    isPending: historyLoading,
  } = useApi<HistoryResponse>(
    `/api/v1/plugins/argocd/entities/${entity.id}/history?appName=${encodeURIComponent(appName)}`,
  );

  const triggerSync = useCallback(async () => {
    if (!appName || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/plugins/argocd/entities/${entity.id}/sync`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ appName }),
      });
      if (res.ok) {
        const json = await res.json() as { data: { syncTriggeredAt: string } };
        setSyncMessage(`Sync triggered at ${new Date(json.data.syncTriggeredAt).toLocaleTimeString()}`);
        void refetchApp();
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } finally {
      setSyncing(false);
    }
  }, [appName, entity.id, syncing, refetchApp]);

  const app     = appData?.data;
  const history = historyData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {app && (
            <span className="text-xs text-gray-500">
              App: <strong>{app.metadata.name}</strong> · Project: <strong>{app.spec.project}</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {syncMessage && (
            <span className="text-xs text-green-600 font-medium">{syncMessage}</span>
          )}
          <button
            onClick={() => void triggerSync()}
            disabled={syncing || appLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {syncing ? (
              <>
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </>
            ) : (
              'Sync Now'
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {appLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading ArgoCD status…
        </div>
      )}

      {/* Error */}
      {appError && !appLoading && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          Failed to load ArgoCD data: {appError instanceof Error ? appError.message : 'Unknown error'}
        </div>
      )}

      {/* Status cards */}
      {app && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Sync status */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Sync Status</p>
            <SyncBadge status={app.status.sync.status} />
            {app.status.sync.revision && (
              <p className="mt-2 font-mono text-xs text-gray-500 truncate" title={app.status.sync.revision}>
                {app.status.sync.revision.slice(0, 8)}
              </p>
            )}
          </div>

          {/* Health */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Health</p>
            <HealthBadge status={app.status.health.status} />
          </div>

          {/* Last reconciled */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Last Reconciled</p>
            <p className="text-xs text-gray-700">
              {app.status.reconciledAt
                ? new Date(app.status.reconciledAt).toLocaleString()
                : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Operation state */}
      {app?.status.operationState && (
        <div className={`rounded-md border p-3 text-xs ${
          app.status.operationState.phase === 'Succeeded'
            ? 'border-green-200 bg-green-50 text-green-800'
            : app.status.operationState.phase === 'Failed'
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-blue-200 bg-blue-50 text-blue-800'
        }`}>
          <span className="font-medium">Last operation:</span>{' '}
          {app.status.operationState.phase}
          {app.status.operationState.message && ` — ${app.status.operationState.message}`}
        </div>
      )}

      {/* Source */}
      {app?.spec.source && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Source</h3>
          <dl className="grid grid-cols-1 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-gray-500">Repository</dt>
              <dd className="font-mono text-gray-800 truncate">{app.spec.source.repoURL}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Revision</dt>
              <dd className="font-mono text-gray-800">{app.spec.source.targetRevision}</dd>
            </div>
            {app.spec.source.path && (
              <div>
                <dt className="text-gray-500">Path</dt>
                <dd className="font-mono text-gray-800">{app.spec.source.path}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Sync history */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Sync History{' '}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
            {history.length}
          </span>
        </h3>

        {historyLoading ? (
          <p className="text-xs text-gray-400">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-400">No sync history available.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Revision</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Deployed At</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {history.slice(0, 5).map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-gray-800">
                      {item.revision.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(item.deployedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {item.initiatedBy?.automated
                        ? 'Auto-sync'
                        : (item.initiatedBy?.username ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
