import { Link } from 'react-router-dom';
import { useTemplates } from '../hooks/useTemplates.js';
import { useCurrentUser } from '../hooks/useCurrentUser.js';
import Badge from '../components/Badge.js';

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="h-4 w-1/2 rounded bg-gray-200" />
      <div className="mt-2 h-3 w-3/4 rounded bg-gray-100" />
      <div className="mt-3 h-3 w-1/4 rounded bg-gray-100" />
    </div>
  );
}

export default function TemplatesListPage() {
  const { data: allTemplates, isLoading, error } = useTemplates();
  // Hide internal system templates that are not meant to be run directly by users
  const INTERNAL_TEMPLATES = ['forge-fix-file'];
  const templates = allTemplates?.filter((t) => !INTERNAL_TEMPLATES.includes(t.name));
  const { data: meData } = useCurrentUser();
  const user = meData?.user;
  const canRun = user?.role !== 'viewer';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Golden path templates to scaffold new services and components.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load templates: {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-500">No templates configured yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Add templates via the seed file or API.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {template.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                    {template.description}
                  </p>
                  {template.tags && template.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <Badge key={tag} label={tag} variant="tag" />
                      ))}
                    </div>
                  )}
                </div>
                {canRun && (
                  <Link
                    to={`/templates/${template.id}`}
                    className="ml-2 shrink-0 inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    Create →
                  </Link>
                )}
              </div>
              <div className="mt-3 text-xs text-gray-400">
                {template.parameters.length} parameter
                {template.parameters.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
