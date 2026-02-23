import { useQuery }        from '@tanstack/react-query';
import { fetchAllScorecards } from '../lib/scorecards.api.js';
import { useCurrentUser }   from '../hooks/useCurrentUser.js';
import LevelBadge           from '../components/LevelBadge.js';
import Spinner              from '../components/Spinner.js';

export default function ScorecardsAdminPage() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const isAdmin = me?.user?.role === 'platform-admin' || me?.user?.role === 'template-admin';

  const { data, isLoading } = useQuery({
    queryKey:  ['scorecards-admin'],
    queryFn:   () => fetchAllScorecards(),
    enabled:   isAdmin,
    staleTime: 120_000,
  });

  if (meLoading || isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="md" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500 text-sm">You don't have permission to manage scorecards.</p>
        <p className="text-gray-400 text-xs mt-1">Requires: template-admin or platform-admin role.</p>
      </div>
    );
  }

  const scorecards = data?.data.scorecards ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Scorecard Definitions</h1>
        <p className="text-xs text-gray-400">
          Edit via seed SQL or API — read-only view in V1
        </p>
      </div>

      {scorecards.length === 0 ? (
        <p className="text-sm text-gray-400">
          No scorecards found. Run seed SQL to add the default scorecards.
        </p>
      ) : (
        <div className="space-y-6">
          {scorecards.map((sc) => (
            <div key={sc.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {sc.name}{' '}
                    <span className="text-gray-400 font-normal">{sc.version}</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Applies to: <strong>{sc.appliesToKind}</strong> · Levels: {sc.levels.join(' → ')}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{sc.rules.length} rules</span>
              </div>
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-2 text-left font-medium text-gray-500">Rule</th>
                    <th className="px-5 py-2 text-left font-medium text-gray-500">Level</th>
                    <th className="px-5 py-2 text-left font-medium text-gray-500">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sc.rules.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-gray-800 font-medium">{r.title}</td>
                      <td className="px-5 py-2.5"><LevelBadge level={r.level} /></td>
                      <td className="px-5 py-2.5">
                        <span className={`font-mono rounded px-1.5 py-0.5 ${
                          r.type.startsWith('entity.') ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                        }`}>{r.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
