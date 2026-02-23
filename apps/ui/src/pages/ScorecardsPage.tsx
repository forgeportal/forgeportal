import { useQuery }                from '@tanstack/react-query';
import { Link }                    from 'react-router-dom';
import { fetchScorecardDashboard } from '../lib/scorecards.api.js';
import { useCurrentUser }          from '../hooks/useCurrentUser.js';
import LevelBadge                  from '../components/LevelBadge.js';
import ErrorMessage                from '../components/ErrorMessage.js';
import Spinner                     from '../components/Spinner.js';

const LEVEL_ORDER = ['Gold', 'Silver', 'Bronze', 'none'] as const;

function StatCard({ level, count, total }: { level: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <LevelBadge level={level === 'none' ? null : level} />
        <span className="text-2xl font-bold text-gray-900">{count}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{pct}% of entities</p>
    </div>
  );
}

export default function ScorecardsPage() {
  const { data: me }  = useCurrentUser();
  const isAdmin = me?.user?.role === 'platform-admin' || me?.user?.role === 'template-admin';

  const { data, isLoading, isError, error } = useQuery({
    queryKey:  ['scorecards-dashboard'],
    queryFn:   fetchScorecardDashboard,
    staleTime: 120_000,
  });

  const dashboard = data?.data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scorecards</h1>
          <p className="mt-1 text-sm text-gray-500">Service maturity across your catalog</p>
        </div>
        {isAdmin && (
          <Link
            to="/scorecards/admin"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Manage Definitions →
          </Link>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-16"><Spinner size="md" /></div>}
      {isError && <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load dashboard'} />}

      {dashboard && (
        <div className="space-y-8">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {LEVEL_ORDER.map((level) => (
              <StatCard
                key={level}
                level={level}
                count={(dashboard.totals[level as keyof typeof dashboard.totals] as number) ?? 0}
                total={dashboard.totals.total}
              />
            ))}
          </div>

          {/* Per-scorecard breakdown */}
          {dashboard.byScorecardName.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-800">By Scorecard</h2>
              <div className="space-y-3">
                {dashboard.byScorecardName.map((sc) => (
                  <div
                    key={sc.scorecardName}
                    className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{sc.scorecardName}</span>
                      <span className="text-xs text-gray-500">{sc.appliesToKind}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {LEVEL_ORDER.map((level) => {
                        const count = sc.levelBreakdown[level] ?? 0;
                        if (count === 0) return null;
                        return (
                          <span key={level} className="inline-flex items-center gap-1 text-xs">
                            <LevelBadge level={level === 'none' ? null : level} />
                            <span className="font-semibold">{count}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Worst-performing entities */}
          {dashboard.worst.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-800">
                Needs Attention
                <span className="ml-2 text-xs font-normal text-gray-400">(Bronze or not evaluated)</span>
              </h2>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kind</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dashboard.worst.map((e) => (
                      <tr key={e.entityId} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{e.entityName}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{e.entityKind}</td>
                        <td className="px-5 py-3"><LevelBadge level={e.level} /></td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/catalog/${e.entityId}#scorecards`}
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
