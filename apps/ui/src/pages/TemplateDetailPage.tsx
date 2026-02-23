import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTemplate } from '../hooks/useTemplate.js';
import { runTemplate } from '../lib/templates.api.js';
import { getCsrfToken } from '../lib/csrf.js';
import { ApiError } from '../lib/api.js';
import SchemaForm from '../components/SchemaForm.js';
import Spinner from '../components/Spinner.js';
import ErrorMessage from '../components/ErrorMessage.js';

/** Map action name to a short human-readable label */
function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'scm.createRepo@v1':          'Créer le dépôt',
    'scm.pushSkeleton@v1':        'Pousser le squelette de code',
    'scm.createOrUpdateFile@v1':  'Créer / mettre à jour un fichier',
    'scm.openPrOrMr@v1':          'Ouvrir une Pull Request',
    'scm.ensureWebhook@v1':       'Configurer le webhook',
    'ci.bootstrap@v1':            'Configurer la CI',
    'catalog.registerEntity@v1':  'Enregistrer l\'entité dans le catalog',
    'docs.bootstrap@v1':          'Initialiser la documentation',
    'k8s.bootstrap@v1':           'Générer les manifests Kubernetes',
    'scorecards.evaluate@v1':     'Évaluer les scorecards',
  };
  return map[action] ?? action;
}

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading, error } = useTemplate(id);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!template) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getCsrfToken();
      const { runId } = await runTemplate(template.id, values, token);
      navigate(`/templates/runs/${runId}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Soumission échouée. Veuillez réessayer.',
      );
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <ErrorMessage
        message={(error as Error | null)?.message ?? 'Template introuvable'}
      />
    );
  }

  const steps = template.steps ?? [];

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/templates" className="text-sm text-indigo-600 hover:underline">
          ← Templates
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{template.title}</h1>
        <p className="mt-1 text-gray-500">{template.description}</p>
        {template.tags && template.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Wizard — steps preview */}
      {steps.length > 0 && (
        <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-indigo-800">
            Ce que ce template va faire ({steps.length} étape{steps.length > 1 ? 's' : ''})
          </h2>
          <ol className="space-y-2">
            {steps.map((step, idx) => (
              <li key={step.id} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-800">
                    {actionLabel(step.action)}
                  </span>
                  <span className="ml-2 font-mono text-xs text-gray-400">{step.id}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Submit error — inline, pas centré */}
      {submitError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Erreur : </strong>{submitError}
        </div>
      )}

      {/* Form */}
      <SchemaForm
        parameters={template.parameters}
        onSubmit={handleSubmit}
        loading={submitting}
      />
    </div>
  );
}
