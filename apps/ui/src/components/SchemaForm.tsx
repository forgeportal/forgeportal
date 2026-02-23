import { useState } from 'react';
import type { TemplateParameter } from '../lib/types.js';
import Spinner from './Spinner.js';

const INPUT_CLASS =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
  'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none';

function renderField(
  param: TemplateParameter,
  value: unknown,
  onChange: (v: unknown) => void,
  error?: string,
) {
  if (param.type === 'string' && param.enum) {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} ${error ? 'border-red-400' : ''}`}
      >
        <option value="">— select —</option>
        {param.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
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
        className={`${INPUT_CLASS} ${error ? 'border-red-400' : ''}`}
      />
    );
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      pattern={param.pattern}
      placeholder={param.ui === 'team-picker' ? 'team:your-team' : undefined}
      className={`${INPUT_CLASS} ${error ? 'border-red-400' : ''}`}
    />
  );
}

interface SchemaFormProps {
  parameters: TemplateParameter[];
  onSubmit:   (values: Record<string, unknown>) => void;
  loading?:   boolean;
}

export default function SchemaForm({ parameters, onSubmit, loading = false }: SchemaFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const p of parameters) {
      if (p.default !== undefined) init[p.id] = p.default;
    }
    return init;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleChange(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }));
    if (fieldErrors[id]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};

    for (const param of parameters) {
      const value = values[param.id];
      const isEmpty = value === undefined || value === null || value === '';

      if (param.required && isEmpty) {
        errors[param.id] = `"${param.title}" est requis`;
        continue;
      }
      if (!isEmpty && param.pattern && typeof value === 'string') {
        if (!new RegExp(param.pattern).test(value)) {
          errors[param.id] = param.description
            ? `Format invalide — ${param.description}`
            : `Doit respecter le format : ${param.pattern}`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {parameters.map((param) => (
        <div key={param.id}>
          <label className="block text-sm font-medium text-gray-700">
            {param.title}
            {param.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <div className="mt-1">
            {renderField(param, values[param.id], (v) => handleChange(param.id, v), fieldErrors[param.id])}
          </div>
          {fieldErrors[param.id] && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors[param.id]}</p>
          )}
          {param.description && (
            <p className="mt-1 text-xs text-gray-500">{param.description}</p>
          )}
          {param.pattern && !fieldErrors[param.id] && (
            <p className="mt-1 text-xs text-gray-400">
              Format attendu : <code className="font-mono">{param.pattern}</code>
            </p>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {loading && <Spinner size="xs" />}
        {loading ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
