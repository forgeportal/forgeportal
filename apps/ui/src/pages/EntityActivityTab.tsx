import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import Spinner from '../components/Spinner.js';
import { formatRelativeTime } from '../lib/utils.js';

interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target_id: string | null;
  target_kind: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

interface AuditLogsResponse {
  data: {
    entries: AuditLogEntry[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface EntityActivityTabProps {
  entityId: string;
}

const ACTION_COLORS: Record<string, string> = {
  'entity.create':   'bg-green-100 text-green-700',
  'entity.update':   'bg-blue-100 text-blue-700',
  'entity.delete':   'bg-red-100 text-red-700',
  'action.run':      'bg-indigo-100 text-indigo-700',
  'action.cancel':   'bg-yellow-100 text-yellow-700',
  'template.run':    'bg-purple-100 text-purple-700',
  'scorecard.eval':  'bg-amber-100 text-amber-700',
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {action}
    </span>
  );
}

function SkeletonRow() {
  return (
    <li className="flex gap-4 py-3 animate-pulse">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-gray-200" />
        <div className="h-3 w-48 rounded bg-gray-200" />
      </div>
    </li>
  );
}

export default function EntityActivityTab({ entityId }: EntityActivityTabProps) {
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey:  ['entity-audit-logs', entityId, offset],
    queryFn:   () =>
      api.get<AuditLogsResponse>(`/audit-logs?targetId=${entityId}&limit=${limit}&offset=${offset}`),
    staleTime: 30_000,
  });

  const entries = data?.data.entries ?? [];
  const total   = data?.data.total ?? 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Audit trail for this entity — creation, updates, action runs.
        </p>
        <button
          onClick={() => void refetch()}
          className="rounded-md border border-gray-200 px-3 py-1 text-xs hover:bg-gray-50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load activity: {(error as Error).message}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <ul className="divide-y divide-gray-100 px-4">
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </ul>
        ) : entries.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            No activity recorded for this entity yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionBadge action={entry.action} />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {entry.actor}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-gray-400">
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </div>
                  {Object.keys(entry.meta ?? {}).length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-gray-400 font-mono">
                      {JSON.stringify(entry.meta)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isLoading && total > limit && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            {offset + 1}–{Math.min(offset + limit, total)} of {total} events
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              disabled={offset === 0}
              className="rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setOffset((o) => o + limit)}
              disabled={offset + limit >= total}
              className="rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
