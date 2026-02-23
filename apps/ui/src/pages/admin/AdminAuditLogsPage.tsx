import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import { formatRelativeTime } from '../../lib/utils.js';

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
  const style = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {action}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded bg-gray-200" style={{ width: `${35 + i * 12}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function AdminAuditLogsPage() {
  const [actorFilter,    setActorFilter]    = useState('');
  const [targetFilter,   setTargetFilter]   = useState('');
  const [draftActor,     setDraftActor]     = useState('');
  const [draftTarget,    setDraftTarget]    = useState('');
  const [offset,         setOffset]         = useState(0);
  const limit = 50;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', actorFilter, targetFilter, offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actorFilter)  params.set('actor',    actorFilter);
      if (targetFilter) params.set('targetId', targetFilter);
      params.set('limit',  String(limit));
      params.set('offset', String(offset));
      return api.get<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const entries = data?.data.entries ?? [];
  const total   = data?.data.total ?? 0;

  function applyFilters() {
    setActorFilter(draftActor.trim());
    setTargetFilter(draftTarget.trim());
    setOffset(0);
  }

  function clearFilters() {
    setDraftActor('');
    setDraftTarget('');
    setActorFilter('');
    setTargetFilter('');
    setOffset(0);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
          <p className="mt-1 text-sm text-gray-500">
            All actions recorded by ForgePortal — entity changes, runs, template executions.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Actor (email or sub)</label>
          <input
            type="text"
            value={draftActor}
            onChange={(e) => setDraftActor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="user@example.com"
            className="h-8 w-52 rounded-md border border-gray-200 px-3 text-sm placeholder-gray-300 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Target ID (entity UUID)</label>
          <input
            type="text"
            value={draftTarget}
            onChange={(e) => setDraftTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            placeholder="550e8400-..."
            className="h-8 w-64 rounded-md border border-gray-200 px-3 text-sm font-mono placeholder-gray-300 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <button
          onClick={applyFilters}
          className="h-8 rounded-md bg-indigo-600 px-4 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Filter
        </button>
        {(actorFilter || targetFilter) && (
          <button
            onClick={clearFilters}
            className="h-8 rounded-md border border-gray-200 px-3 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load audit logs: {(error as Error).message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                When
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Target
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Metadata
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-500">
                  {actorFilter || targetFilter
                    ? 'No audit logs match your filters.'
                    : 'No audit logs recorded yet.'}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {formatRelativeTime(entry.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 truncate max-w-[160px]">
                    {entry.actor}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {entry.target_kind && (
                      <span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {entry.target_kind}
                      </span>
                    )}
                    {entry.target_id
                      ? <span className="text-gray-400">{entry.target_id.slice(0, 8)}…</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[240px] truncate">
                    {Object.keys(entry.meta ?? {}).length > 0
                      ? JSON.stringify(entry.meta)
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>
            {total === 0
              ? '0 entries'
              : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
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
