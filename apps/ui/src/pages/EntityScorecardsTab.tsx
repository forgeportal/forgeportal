import { useState }               from 'react';
import { useQuery }               from '@tanstack/react-query';
import { fetchEntityScorecards }  from '../lib/scorecards.api.js';
import { useCurrentUser }         from '../hooks/useCurrentUser.js';
import LevelBadge                 from '../components/LevelBadge.js';
import FixConfirmDialog           from '../components/FixConfirmDialog.js';
import ErrorMessage               from '../components/ErrorMessage.js';
import type { ScorecardRuleResult, ScorecardEvaluation } from '../lib/types.js';

interface Props { entityId: string }

function RuleRow({
  rule,
  evaluation,
  entityId,
  canFix,
}: {
  rule:       ScorecardRuleResult;
  evaluation: ScorecardEvaluation;
  entityId:   string;
  canFix:     boolean;
}) {
  const [showDialog, setShowDialog] = useState(false);

  const isPending = rule.pass === null;
  const icon = isPending
    ? <span className="text-gray-300 text-base" title="Not yet evaluated">⏳</span>
    : rule.pass
    ? <span className="text-green-500 text-base" title="Passing">✓</span>
    : <span className="text-red-500 text-base"   title="Failing">✗</span>;

  return (
    <>
      <div className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
        isPending ? 'bg-gray-50' : rule.pass ? 'bg-green-50' : 'bg-red-50'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-5 text-center">{icon}</span>
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-800 truncate block">
              {rule.ruleTitle}
            </span>
            {isPending && (
              <span className="text-xs text-gray-400">Not yet evaluated</span>
            )}
            {rule.error && (
              <span className="text-xs text-red-400">Error: {rule.error}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            rule.level === 'Gold'   ? 'bg-yellow-100 text-yellow-700' :
            rule.level === 'Silver' ? 'bg-gray-100   text-gray-600'   :
            'bg-orange-100 text-orange-700'
          }`}>{rule.level}</span>
          {!rule.pass && rule.fixAction && canFix && !isPending && (
            <button
              onClick={() => setShowDialog(true)}
              className="rounded-md bg-white border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              Fix →
            </button>
          )}
        </div>
      </div>

      {showDialog && (
        <FixConfirmDialog
          entityId={entityId}
          evaluation={evaluation}
          rule={rule}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}

function ScorecardBlock({
  evaluation,
  entityId,
  canFix,
}: {
  evaluation: ScorecardEvaluation;
  entityId:   string;
  canFix:     boolean;
}) {
  const passCount  = evaluation.rules.filter((r) => r.pass === true).length;
  const totalRules = evaluation.rules.length;
  const evalAge    = evaluation.evaluatedAt
    ? Math.round((Date.now() - new Date(evaluation.evaluatedAt).getTime()) / 60_000)
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{evaluation.scorecardName}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {evaluation.status === 'pending'
              ? 'Never evaluated'
              : `${passCount}/${totalRules} rules passing`
            }
            {evalAge !== null && (
              <span className="ml-2 text-gray-400">
                · evaluated {evalAge < 1 ? 'just now' : evalAge < 60 ? `${evalAge}m ago` : `${Math.floor(evalAge / 60)}h ago`}
              </span>
            )}
          </p>
        </div>
        <LevelBadge level={evaluation.level ?? (evaluation.status === 'pending' ? 'pending' : null)} />
      </div>

      <div className="divide-y divide-gray-50 px-4 py-3 space-y-1.5">
        {evaluation.rules.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No rules defined.</p>
        ) : (
          evaluation.rules.map((rule) => (
            <RuleRow
              key={rule.ruleId}
              rule={rule}
              evaluation={evaluation}
              entityId={entityId}
              canFix={canFix}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function EntityScorecardsTab({ entityId }: Props) {
  const { data: me }                            = useCurrentUser();
  const { data, isLoading, isError, error }     = useQuery({
    queryKey:  ['entity-scorecards', entityId],
    queryFn:   () => fetchEntityScorecards(entityId),
    staleTime: 60_000,
  });

  const canFix      = me?.user?.role !== 'viewer' && me?.user?.role !== 'team-admin';
  const evaluations = data?.data.evaluations ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load scorecards'} />;
  }

  if (evaluations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-gray-100 p-4 mb-3">
          <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500 max-w-sm">
          No scorecards configured for this entity kind.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {evaluations.map((ev) => (
        <ScorecardBlock
          key={ev.scorecardId}
          evaluation={ev}
          entityId={entityId}
          canFix={canFix}
        />
      ))}
    </div>
  );
}
