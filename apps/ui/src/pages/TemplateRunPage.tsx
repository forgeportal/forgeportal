import { Link, useParams } from 'react-router-dom';
import { useTemplateRun } from '../hooks/useTemplateRun.js';
import RunStatusBadge from '../components/RunStatusBadge.js';
import Spinner from '../components/Spinner.js';
import type { TemplateRunStep } from '../lib/types.js';

/** Translate backend error codes/messages into user-friendly text. */
function translateStepError(outputs: Record<string, unknown>): { message: string; hint: string } {
  const raw = String(outputs['error'] ?? '');

  if (raw.includes('AUTH_ERROR')) {
    return {
      message: 'Authentification SCM échouée',
      hint: 'Le token GitHub/GitLab est manquant ou invalide. Contactez votre administrateur pour configurer SCM_GITHUB_TOKEN ou SCM_GITLAB_TOKEN.',
    };
  }
  if (raw.includes('NOT_FOUND')) {
    return {
      message: 'Ressource introuvable',
      hint: 'Vérifiez le nom de l\'organisation, du groupe ou du dépôt saisi dans le formulaire.',
    };
  }
  if (raw.includes('CONFLICT')) {
    return {
      message: 'Conflit détecté',
      hint: 'Le dépôt ou la ressource existe déjà. Utilisez un nom différent ou supprimez la ressource existante.',
    };
  }
  if (raw.includes('RATE_LIMITED')) {
    return {
      message: 'Limite de taux SCM atteinte',
      hint: 'Trop de requêtes vers l\'API SCM. Patientez quelques minutes avant de réessayer.',
    };
  }
  if (raw.includes('VALIDATION_ERROR')) {
    const detail = raw.replace(/VALIDATION_ERROR[:\s]*/i, '').trim();
    return {
      message: 'Paramètres invalides',
      hint: detail || 'Vérifiez les valeurs saisies dans le formulaire.',
    };
  }
  if (raw.includes('REMOTE_ERROR')) {
    return {
      message: 'Erreur de l\'API SCM',
      hint: 'Le service SCM distant a retourné une erreur. Réessayez dans quelques instants.',
    };
  }
  if (raw) {
    return { message: 'Étape échouée', hint: raw };
  }
  return {
    message: 'Étape échouée',
    hint: 'Consultez les logs d\'action pour plus de détails.',
  };
}

function StepCard({ step, index }: { step: TemplateRunStep; index: number }) {
  const borderClass =
    step.status === 'running'  ? 'border-blue-200 bg-blue-50' :
    step.status === 'success'  ? 'border-green-200 bg-green-50' :
    step.status === 'failed'   ? 'border-red-200 bg-red-50' :
                                 'border-gray-200 bg-gray-50';

  const numberClass =
    step.status === 'success' ? 'bg-green-200 text-green-700' :
    step.status === 'failed'  ? 'bg-red-200 text-red-700' :
    step.status === 'running' ? 'bg-blue-200 text-blue-700' :
                                'bg-gray-200 text-gray-600';

  const durationMs =
    step.startedAt && step.finishedAt
      ? new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime()
      : null;

  const error = step.status === 'failed' ? translateStepError(step.outputs) : null;

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-4 ${borderClass}`}>
      {/* Step number / status icon */}
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${numberClass}`}>
        {step.status === 'running' ? <Spinner size="xs" /> : index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 font-mono">{step.stepId}</span>
          <RunStatusBadge status={step.status} />
        </div>

        {durationMs !== null && (
          <p className="mt-0.5 text-xs text-gray-400">
            {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
          </p>
        )}

        {/* Success outputs */}
        {step.status === 'success' && Object.keys(step.outputs).length > 0 && (
          <div className="mt-2 rounded border border-gray-200 bg-white p-2 font-mono text-xs text-gray-600">
            {Object.entries(step.outputs).map(([k, v]) => (
              <div key={k}>
                <span className="text-gray-400">{k}:</span>{' '}
                {typeof v === 'string' && v.startsWith('http') ? (
                  <a
                    href={v}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {v}
                  </a>
                ) : (
                  String(v)
                )}
              </div>
            ))}
          </div>
        )}

        {/* Failure — translated error */}
        {error && (
          <div className="mt-2">
            <p className="text-sm font-medium text-red-700">{error.message}</p>
            <p className="mt-0.5 text-xs text-red-500">{error.hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplateRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isLoading, error } = useTemplateRun(runId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {(error as Error | null)?.message ?? 'Template run introuvable'}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-indigo-600 hover:underline">
          ← Templates
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Exécution en cours</h1>
          <RunStatusBadge status={run.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Run <span className="font-mono text-xs">{run.runId}</span>
          {' · '}Demandé par {run.requestedBy}
        </p>
      </div>

      {/* Steps timeline */}
      {run.steps.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
          <Spinner size="sm" />
          <span>Run créé, en attente de la première étape…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {run.steps.map((step, idx) => (
            <StepCard key={step.stepId} step={step} index={idx} />
          ))}
        </div>
      )}

      {/* Success panel */}
      {run.status === 'success' && Object.keys(run.outputs).length > 0 && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-green-800">✓ Template terminé avec succès</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(run.outputs).map(([key, value]) => {
              const isUrl = typeof value === 'string' && value.startsWith('http');
              return isUrl ? (
                <a
                  key={key}
                  href={value as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-sm text-green-700 hover:bg-green-100 transition-colors"
                >
                  {key} ↗
                </a>
              ) : (
                <span key={key} className="text-sm text-green-700">
                  <span className="text-green-500">{key}:</span> {String(value)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Failure panel — with retry button */}
      {run.status === 'failed' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-800">
            Échec à l'étape : <span className="font-mono">{run.currentStep ?? 'inconnue'}</span>
          </h3>
          <p className="mt-1 text-sm text-red-600">
            Corrigez les paramètres et relancez, ou consultez les logs d'action pour diagnostiquer l'erreur.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/templates/${run.templateId}`}
              className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              ↩ Réessayer avec d'autres paramètres
            </Link>
            <Link
              to="/actions"
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Voir les logs d'action →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
