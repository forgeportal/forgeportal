import { useState }     from 'react';
import { useNavigate }   from 'react-router-dom';
import Spinner           from './Spinner.js';
import { getCsrfToken }  from '../lib/csrf.js';
import { triggerFix }    from '../lib/scorecards.api.js';
import { ApiError }      from '../lib/api.js';
import type { ScorecardRuleResult, ScorecardEvaluation } from '../lib/types.js';

interface Props {
  entityId:   string;
  evaluation: ScorecardEvaluation;
  rule:       ScorecardRuleResult;
  onClose:    () => void;
}

export default function FixConfirmDialog({ entityId, evaluation, rule, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const navigate = useNavigate();

  const fixAction = rule.fixAction!;

  const actionDescription = (() => {
    if (fixAction.actionId === 'scm.createOrUpdateFile@v1') {
      const path = fixAction.suggestedInputs['path'] as string | undefined;
      return `Create file \`${path ?? 'unknown'}\` on a fix branch and open a Pull Request.`;
    }
    if (fixAction.actionId === 'ci.bootstrap@v1') {
      return 'Write a CI configuration file on a fix branch and open a Pull Request.';
    }
    if (fixAction.actionId === 'docs.bootstrap@v1') {
      return 'Create a docs starter page (`docs/index.md`) on a fix branch and open a Pull Request.';
    }
    return `Run action \`${fixAction.actionId}\` and open a Pull Request.`;
  })();

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const token  = await getCsrfToken();
      const result = await triggerFix(entityId, evaluation.scorecardId, rule.ruleId, token);
      navigate(`/templates/runs/${result.data.templateRunId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to trigger fix');
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Fix: {rule.ruleTitle}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{evaluation.scorecardName}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            This will automatically fix the failing rule by performing the following action:
          </p>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {actionDescription}
          </div>
          <p className="text-xs text-gray-500">
            A Pull Request will be opened for review — no changes are pushed directly to the default branch.
          </p>
          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading && <Spinner size="xs" />}
            {loading ? 'Applying fix…' : 'Confirm Fix'}
          </button>
        </div>
      </div>
    </div>
  );
}
