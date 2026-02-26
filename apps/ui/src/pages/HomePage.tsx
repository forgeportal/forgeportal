import { useQuery }    from '@tanstack/react-query';
import { Link }        from 'react-router-dom';
import { api }         from '../lib/api.js';
import SetupChecklist  from '../components/SetupChecklist.js';
import type { PaginatedResponse, ScorecardDashboardResponse } from '../lib/types.js';
import { formatRelativeTime } from '../lib/utils.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id:          string;
  actor:       string;
  action:      string;
  target_id:   string | null;
  target_kind: string | null;
  created_at:  string;
}

interface AuditLogsResponse {
  data: { entries: AuditLogEntry[]; total: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  'entity.create':  'bg-green-100 text-green-700',
  'entity.update':  'bg-blue-100 text-blue-700',
  'entity.delete':  'bg-red-100 text-red-700',
  'action.run':     'bg-indigo-100 text-indigo-700',
  'action.cancel':  'bg-yellow-100 text-yellow-700',
  'template.run':   'bg-purple-100 text-purple-700',
  'scorecard.eval': 'bg-amber-100 text-amber-700',
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {action}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:     string;
  value:     number | null | undefined;
  icon:      React.ReactNode;
  loading:   boolean;
  linkTo?:   string;
  accent?:   string;
}

function StatCard({ label, value, icon, loading, linkTo, accent = 'text-indigo-600' }: StatCardProps) {
  const inner = (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 ${accent}`}>
        {icon}
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 rounded bg-gray-100 animate-pulse mb-1" />
        ) : (
          <p className={`text-3xl font-bold text-gray-900`}>{value ?? '—'}</p>
        )}
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );

  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonActivity() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 animate-pulse">
          <div className="h-5 w-28 rounded-full bg-gray-100" />
          <div className="h-4 w-24 rounded bg-gray-100" />
          <div className="ml-auto h-4 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </>
  );
}

// ─── Quick action card ────────────────────────────────────────────────────────

interface QuickActionProps {
  to:          string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  accent:      string;
}

function QuickAction({ to, label, description, icon, accent }: QuickActionProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{label}</p>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      </div>
      <svg className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors mt-auto self-end"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: entitiesData,  isLoading: loadingEntities }   = useQuery({
    queryKey: ['home-entities-count'],
    queryFn:  () => api.get<PaginatedResponse<unknown>>('/catalog/entities?limit=1'),
    staleTime: 60_000,
  });

  const { data: templatesData, isLoading: loadingTemplates }  = useQuery({
    queryKey: ['home-templates-count'],
    queryFn:  () => api.get<PaginatedResponse<unknown>>('/templates?limit=200'),
    staleTime: 60_000,
  });

  const { data: actionRunsData, isLoading: loadingRuns }      = useQuery({
    queryKey: ['home-runs-count'],
    queryFn:  () => api.get<PaginatedResponse<unknown>>('/action-runs?limit=1'),
    staleTime: 60_000,
  });

  const { data: scorecardData, isLoading: loadingScorecard }  = useQuery({
    queryKey: ['home-scorecard-dashboard'],
    queryFn:  () => api.get<ScorecardDashboardResponse>('/scorecards/dashboard'),
    staleTime: 60_000,
  });

  const { data: auditData, isLoading: loadingAudit }          = useQuery({
    queryKey: ['home-audit-recent'],
    queryFn:  () => api.get<AuditLogsResponse>('/audit-logs?limit=5'),
    staleTime: 30_000,
  });

  const entityCount    = (entitiesData as { pagination?: { total?: number } } | undefined)?.pagination?.total;
  const templateCount  = (templatesData as { data?: unknown[] } | undefined)?.data?.length;
  const runCount       = (actionRunsData as { pagination?: { total?: number } } | undefined)?.pagination?.total;
  const goldCount      = scorecardData?.data.totals.Gold;
  const recentActivity = auditData?.data.entries ?? [];

  return (
    <div className="space-y-8">
      <SetupChecklist />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Home</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to ForgePortal — your internal developer platform.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Entities"
          value={entityCount}
          loading={loadingEntities}
          linkTo="/catalog"
          accent="text-indigo-600"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 11h8M8 15h5" />
            </svg>
          }
        />
        <StatCard
          label="Templates"
          value={templateCount}
          loading={loadingTemplates}
          linkTo="/templates"
          accent="text-purple-600"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Action Runs (7d)"
          value={runCount}
          loading={loadingRuns}
          linkTo="/actions"
          accent="text-blue-600"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          label="Gold Scorecards"
          value={goldCount}
          loading={loadingScorecard}
          linkTo="/scorecards"
          accent="text-yellow-600"
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Recent Activity</h2>
            <Link
              to="/admin/audit-logs"
              className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              View all →
            </Link>
          </div>

          {loadingAudit ? (
            <SkeletonActivity />
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No activity yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-2.5">
                  <ActionBadge action={entry.action} />
                  <span className="text-sm text-gray-600 truncate flex-1">
                    {entry.actor}
                    {entry.target_kind && (
                      <span className="text-gray-400"> · {entry.target_kind}</span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatRelativeTime(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider px-1">Quick Actions</h2>
          <QuickAction
            to="/catalog"
            label="Browse Catalog"
            description="Explore all services, libraries, and components."
            accent="bg-indigo-50 text-indigo-600"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
          />
          <QuickAction
            to="/templates"
            label="Run a Template"
            description="Scaffold a new service from an existing template."
            accent="bg-purple-50 text-purple-600"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 4v16m8-8H4" />
              </svg>
            }
          />
          <QuickAction
            to="/scorecards"
            label="View Scorecards"
            description="Check software quality and compliance levels."
            accent="bg-yellow-50 text-yellow-600"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}
