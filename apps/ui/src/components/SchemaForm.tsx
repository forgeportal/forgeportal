import { useState } from 'react';
import type { TemplateParameter } from '../lib/types.js';
import Spinner from './Spinner.js';

const INPUT_CLASS =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
  'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors';

const INPUT_ERROR_CLASS =
  'block w-full rounded-md border border-red-400 px-3 py-2 text-sm shadow-sm ' +
  'focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors';

const INPUT_VALID_CLASS =
  'block w-full rounded-md border border-green-400 px-3 py-2 text-sm shadow-sm ' +
  'focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition-colors';

const ENUM_LABELS: Record<string, string> = {
  github:          'GitHub',
  gitlab:          'GitLab',
  'github-actions': 'GitHub Actions',
  'gitlab-ci':     'GitLab CI',
  private:         'Private',
  public:          'Public',
  internal:        'Internal',
  node:            'Node.js',
  python:          'Python',
  java:            'Java',
  go:              'Go',
  rust:            'Rust',
  postgres:        'PostgreSQL',
  mysql:           'MySQL',
  'local-docker':  'Local Docker',
  'docker-compose': 'Docker Compose',
  kubernetes:      'Kubernetes (Helm)',
  'aws-rds':       'AWS RDS (Terraform)',
  'db.t3.micro':   'db.t3.micro (2 vCPU, 1 GB)',
  'db.t3.small':   'db.t3.small (2 vCPU, 2 GB)',
  'db.t3.medium':  'db.t3.medium (2 vCPU, 4 GB)',
  'db.m5.large':   'db.m5.large (2 vCPU, 8 GB)',
  'db.m5.xlarge':  'db.m5.xlarge (4 vCPU, 16 GB)',
};

function humanLabel(value: string): string {
  return ENUM_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ');
}

function validateField(param: TemplateParameter, value: unknown): string | undefined {
  const isEmpty = value === undefined || value === null || value === '';
  if (param.required && isEmpty) return `"${param.title}" est requis`;
  if (!isEmpty && param.pattern && typeof value === 'string') {
    if (!new RegExp(param.pattern).test(value)) {
      return param.description
        ? `Format invalide — ${param.description}`
        : `Doit correspondre au format : ${param.pattern}`;
    }
  }
  return undefined;
}

function renderField(
  param: TemplateParameter,
  value: unknown,
  onChange: (v: unknown) => void,
  touched: boolean,
  error?: string,
) {
  const fieldClass = error ? INPUT_ERROR_CLASS : touched && !error ? INPUT_VALID_CLASS : INPUT_CLASS;

  if (param.type === 'string' && param.enum) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        <option value="">— choisir —</option>
        {param.enum.map((opt) => (
          <option key={opt} value={opt}>
            {humanLabel(opt)}
          </option>
        ))}
      </select>
    );
  }

  if (param.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
      />
    );
  }

  if (param.type === 'number') {
    return (
      <input
        type="number"
        value={String(value ?? '')}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={param.default !== undefined ? String(param.default) : undefined}
        className={fieldClass}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      pattern={param.pattern}
      placeholder={
        param.ui === 'team-picker'
          ? 'team:your-team'
          : param.default !== undefined
            ? String(param.default)
            : undefined
      }
      className={fieldClass}
    />
  );
}

interface SchemaFormProps {
  parameters:   TemplateParameter[];
  onSubmit:     (values: Record<string, unknown>) => void;
  loading?:     boolean;
  submitLabel?: string;
}

function isVisible(param: TemplateParameter, values: Record<string, unknown>): boolean {
  if (!param.dependsOn) return true;
  return Object.entries(param.dependsOn).every(([fieldId, expected]) => values[fieldId] === expected);
}

export default function SchemaForm({
  parameters,
  onSubmit,
  loading = false,
  submitLabel,
}: SchemaFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const p of parameters) {
      if (p.default !== undefined) init[p.id] = p.default;
    }
    return init;
  });
  const [touched,     setTouched]     = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleChange(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setTouched((prev) => ({ ...prev, [id]: true }));

    const param = parameters.find((p) => p.id === id);
    if (param) {
      const err = validateField(param, value);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (err) next[id] = err;
        else delete next[id];
        return next;
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {};

    for (const param of parameters.filter((p) => isVisible(p, values))) {
      allTouched[param.id] = true;
      const err = validateField(param, values[param.id]);
      if (err) errors[param.id] = err;
    }

    setTouched(allTouched);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    onSubmit(values);
  }

  const visibleParams     = parameters.filter((p) => isVisible(p, values));
  const requiredCount     = visibleParams.filter((p) => p.required).length;
  const filledRequired    = visibleParams
    .filter((p) => p.required)
    .filter((p) => {
      const v = values[p.id];
      return v !== undefined && v !== null && v !== '';
    }).length;
  const allRequiredFilled = filledRequired === requiredCount;

  const label = submitLabel ?? 'Créer';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {visibleParams.map((param) => {
        const isTouched = Boolean(touched[param.id]);
        const error     = fieldErrors[param.id];
        return (
          <div key={param.id}>
            <div className="flex items-baseline gap-1.5">
              <label className="block text-sm font-medium text-gray-700">{param.title}</label>
              {param.required ? (
                <span className="text-xs font-medium text-red-500">*</span>
              ) : (
                <span className="text-xs text-gray-400">(optionnel)</span>
              )}
            </div>

            {param.description && (
              <p className="mb-1 mt-0.5 text-xs text-gray-500">{param.description}</p>
            )}

            <div className="mt-1">
              {renderField(param, values[param.id], (v) => handleChange(param.id, v), isTouched, error)}
            </div>

            {error ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <span>⚠</span>
                {error}
              </p>
            ) : isTouched && param.pattern ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <span>✓</span>
                Format valide
              </p>
            ) : param.pattern && !param.description ? (
              <p className="mt-1 text-xs text-gray-400">
                Format attendu : <code className="font-mono">{param.pattern}</code>
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {loading && <Spinner size="xs" />}
          {loading ? 'Création en cours…' : label}
        </button>

        {requiredCount > 0 && !allRequiredFilled && (
          <span className="text-xs text-gray-400">
            {filledRequired}/{requiredCount} champs requis remplis
          </span>
        )}
      </div>
    </form>
  );
}
