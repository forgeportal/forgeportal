import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSetupStatus } from '../hooks/useSetupStatus.js';

const DISMISS_KEY = 'forgeportal.setup-checklist.dismissed';

interface ChecklistItem {
  id: string;
  title: string;
  description: React.ReactNode;
  done: boolean;
}

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-white" />
  );
}

export default function SetupChecklist() {
  const { data: status, isLoading, isError } = useSetupStatus();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === 'true',
  );

  if (dismissed || isLoading || isError) return null;

  // Only show when catalog is empty
  if ((status?.entityCount ?? 0) > 0) return null;

  const items: ChecklistItem[] = [
    {
      id: 'running',
      title: 'Portal running',
      description: 'Your portal is live.',
      done: true,
    },
    {
      id: 'scm',
      title: 'Configure SCM',
      description: (
        <>
          Add a GitHub or GitLab token in{' '}
          <code className="rounded bg-amber-50 px-1 text-xs font-mono text-amber-700">
            forgeportal.yaml
          </code>
          .{' '}
          <a
            href="https://docs.forgeportal.dev/docs/configuration/scm-providers"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-amber-700 underline hover:text-amber-900"
          >
            SCM Providers guide →
          </a>
        </>
      ),
      done: status?.scmConfigured ?? false,
    },
    {
      id: 'scan',
      title: 'Trigger first scan',
      description: (
        <>
          Discover your repositories automatically.{' '}
          <Link
            to="/admin/scan"
            className="font-medium text-amber-700 underline hover:text-amber-900"
          >
            Go to Admin → Scan →
          </Link>
        </>
      ),
      done: (status?.entityCount ?? 0) > 0,
    },
    {
      id: 'template',
      title: 'Create your first template',
      description: (
        <>
          Define golden-path templates for your teams.{' '}
          <Link
            to="/templates"
            className="font-medium text-amber-700 underline hover:text-amber-900"
          >
            Go to Templates →
          </Link>
        </>
      ),
      done: (status?.templateCount ?? 0) > 0,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === items.length;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-200">
        <div className="flex items-center gap-3">
          <span className="text-xl">🚀</span>
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              {allDone ? 'Setup complete!' : 'Get started with ForgePortal'}
            </h2>
            <p className="text-xs text-amber-700">
              {completedCount} of {items.length} steps complete
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="rounded-md p-1.5 text-amber-600 hover:bg-amber-100 hover:text-amber-800 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-amber-100">
        <div
          className="h-1 bg-amber-400 transition-all duration-500"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Checklist items */}
      <ul className="divide-y divide-amber-100 px-5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3.5">
            <CheckIcon done={item.done} />
            <div className="min-w-0">
              <p
                className={`text-sm font-medium ${
                  item.done ? 'text-gray-400 line-through' : 'text-amber-900'
                }`}
              >
                {item.title}
              </p>
              {!item.done && (
                <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="px-5 pb-4">
        <p className="text-xs text-amber-600">
          <a
            href="https://docs.forgeportal.dev/docs/getting-started/quick-start-docker"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-800 underline"
          >
            Read the full Quick Start guide
          </a>{' '}
          · Dismiss to hide this checklist permanently.
        </p>
      </div>
    </div>
  );
}
