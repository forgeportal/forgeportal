import { Link } from 'react-router-dom';
import type { EntityRelation } from '../lib/types.js';

const RELATION_LABELS: Record<string, string> = {
  dependsOn: 'Depends On',
  partOf: 'Part Of',
  ownedBy: 'Owned By',
  providesApi: 'Provides API',
  consumesApi: 'Consumes API',
};

interface EntityDependenciesTabProps {
  entityId: string;
  relations: EntityRelation[];
}

export default function EntityDependenciesTab({
  entityId,
  relations,
}: EntityDependenciesTabProps) {
  if (relations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-gray-100 p-4">
          <svg
            className="h-8 w-8 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-400">No dependencies</p>
      </div>
    );
  }

  // Group by relation type
  const groups = relations.reduce<Record<string, EntityRelation[]>>((acc, rel) => {
    const key = rel.type;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(rel);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(groups).map(([type, rels]) => (
        <div key={type}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            {RELATION_LABELS[type] ?? type}
          </h3>
          <ul className="space-y-2">
            {rels.map((rel) => {
              const targetId =
                rel.from_entity_id === entityId
                  ? rel.to_entity_id
                  : rel.from_entity_id;
              return (
                <li key={rel.id}>
                  <Link
                    to={`/catalog/${targetId}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                  >
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <code className="font-mono text-xs">{targetId}</code>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
