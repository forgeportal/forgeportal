import React, { useEffect, useRef } from 'react';
import { useApi } from '@forgeportal/plugin-sdk/react';

interface LogsDrawerProps {
  entityId:  string;
  podName:   string;
  namespace: string;
  cluster?:  string;
  onClose:   () => void;
}

export function LogsDrawer({
  entityId,
  podName,
  namespace,
  cluster,
  onClose,
}: LogsDrawerProps): React.ReactElement {
  const params = new URLSearchParams({ namespace, ...(cluster ? { cluster } : {}) });
  const url    = `/api/v1/plugins/kubernetes/entities/${entityId}/pods/${encodeURIComponent(podName)}/logs?${params.toString()}`;

  const { data: logsResponse, isPending, isError, error } = useApi<{ data: { logs: string } }>(url, {
    refetchInterval: 10_000,
    retry:           1,
  });
  const logs = logsResponse?.data.logs;

  const preRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="relative w-full max-w-4xl rounded-t-xl bg-gray-900 sm:rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">{podName}</p>
            <p className="text-xs text-gray-400">namespace: {namespace}{cluster ? ` · cluster: ${cluster}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
            aria-label="Close logs"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="h-96 overflow-hidden">
          {isPending && (
            <div className="flex h-full items-center justify-center text-gray-400 text-sm">
              Loading logs…
            </div>
          )}
          {isError && (
            <div className="flex h-full items-center justify-center text-red-400 text-sm px-4 text-center">
              {error?.message ?? 'Failed to load logs'}
            </div>
          )}
          {logsResponse !== undefined && (
            <pre
              ref={preRef}
              className="h-full overflow-y-auto p-4 text-xs text-green-300 font-mono whitespace-pre-wrap break-all leading-relaxed"
            >
              {logs || '(no log output)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
