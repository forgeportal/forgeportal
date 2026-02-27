import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActionRuns } from '../hooks/useActionRuns.js';
import RunStatusBadge from '../components/RunStatusBadge.js';
import { formatRelativeTime, formatDuration } from '../lib/utils.js';

const STATUS_OPTIONS = ['', 'queued', 'running', 'success', 'failed', 'canceled'] as const;

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded bg-gray-200" style={{ width: `${40 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function ActionRunsListPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useActionRuns({ status: statusFilter || undefined, limit: 50 });

  const runs = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Action Runs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Recent action executions across all templates.
          </p>
        </div>
      </div>

      {/* Status filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
        <button
          onClick={() => void refetch()}
          className="ml-auto rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load action runs: {(error as Error).message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Action / Step
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Requested By
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Started
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Template Run
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
            {isLoading ? (
              [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  No action runs yet. Run a template to get started.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {run.stepId ?? run.actionId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{run.requestedBy}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(run.startedAt ?? run.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(run.startedAt, run.finishedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {run.templateRunId && (
                      <Link
                        to={`/templates/runs/${run.templateRunId}`}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        View run →
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && data && (
        <p className="mt-2 text-right text-xs text-gray-400">
          {runs.length} of {data.pagination.total} runs
        </p>
      )}
    </div>
  );
}
