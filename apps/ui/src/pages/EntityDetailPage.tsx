import { Link, useParams } from 'react-router-dom';
import { useEntity } from '../hooks/useEntity.js';
import Badge from '../components/Badge.js';
import Spinner from '../components/Spinner.js';
import ErrorMessage from '../components/ErrorMessage.js';
import Tabs from '../components/Tabs.js';
import EntityOverviewTab from './EntityOverviewTab.js';
import EntityDependenciesTab from './EntityDependenciesTab.js';
import EntityDocsTab from './EntityDocsTab.js';
import EntityScorecardsTab from './EntityScorecardsTab.js';
import EntityActionsTab from './EntityActionsTab.js';
import EntityActivityTab from './EntityActivityTab.js';
import { EntityProvider, PluginConfigProvider } from '@forgeportal/plugin-sdk/react';
import type { Entity as SdkEntity } from '@forgeportal/plugin-sdk';
import { usePlugins } from '../plugins/PluginContext.js';
import { tabOwnership } from '../plugins/plugin-registry-ui.js';
import type { Entity } from '../lib/types.js';

function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return <span>Today</span>;
  if (diffDays === 1) return <span>Yesterday</span>;
  if (diffDays < 30) return <span>{diffDays}d ago</span>;
  return <span>{date.toLocaleDateString()}</span>;
}

/**
 * Maps the UI's internal Entity type to the SDK's Entity subset.
 * Used to pass the current entity to plugin components via EntityProvider.
 */
function toSdkEntity(entity: Entity): SdkEntity {
  return {
    id:          entity.id,
    kind:        entity.kind,
    namespace:   entity.namespace,
    name:        entity.name,
    title:       entity.name,
    description: entity.description,
    tags:        entity.tags,
    links:       entity.links,
    annotations: entity.annotations,
    owner_ref:   entity.owner_ref ?? undefined,
    lifecycle:   entity.lifecycle ?? undefined,
    spec:        entity.spec,
  };
}

export default function EntityDetailPage() {
  const { id }              = useParams<{ id: string }>();
  const { getEntityTabs, getPluginConfig } = usePlugins();
  const { data, isLoading, isError, error, refetch } = useEntity(id ?? '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    const msg = error instanceof Error ? error.message : 'Failed to load entity';
    return (
      <div className="py-12">
        <ErrorMessage message={msg} onRetry={refetch} />
        <div className="mt-4 text-center">
          <Link to="/catalog" className="text-sm text-indigo-600 hover:underline">
            ← Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  const { entity, relations, sources } = data.data;
  const sdkEntity = toSdkEntity(entity);

  // Build plugin tabs, each wrapped in EntityProvider + PluginConfigProvider
  const pluginTabs = getEntityTabs(entity.kind).map((tab) => {
    const ownerPluginId = tabOwnership.get(tab.id) ?? '';
    const pluginConfig  = getPluginConfig(ownerPluginId);
    return {
      id:      tab.id,
      label:   tab.title,
      content: (
        <EntityProvider entity={sdkEntity}>
          <PluginConfigProvider config={pluginConfig}>
            <tab.component entity={sdkEntity} />
          </PluginConfigProvider>
        </EntityProvider>
      ),
    };
  });

  const tabs = [
    {
      id:      'overview',
      label:   'Overview',
      content: <EntityOverviewTab entity={entity} sources={sources} />,
    },
    {
      id:      'deps',
      label:   'Dependencies',
      content: <EntityDependenciesTab entityId={entity.id} relations={relations} />,
    },
    {
      id:      'docs',
      label:   'Docs',
      content: <EntityDocsTab entityId={entity.id} />,
    },
    {
      id:      'scorecards',
      label:   'Scorecards',
      content: <EntityScorecardsTab entityId={entity.id} />,
    },
    {
      id:      'actions',
      label:   'Actions',
      content: <EntityActionsTab entityId={entity.id} />,
    },
    {
      id:      'activity',
      label:   'Activity',
      content: <EntityActivityTab entityId={entity.id} />,
    },
    // Plugin-provided tabs appended at the end
    ...pluginTabs,
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-400">
        <Link to="/catalog" className="hover:text-indigo-600 transition-colors">
          Catalog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{entity.name}</span>
      </nav>

      {/* Entity header */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
              <Badge label={entity.kind} variant="kind" />
              {entity.lifecycle && <Badge label={entity.lifecycle} variant="lifecycle" />}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {entity.namespace}
              {entity.owner_ref && (
                <> · <span className="text-gray-700">{entity.owner_ref}</span></>
              )}
            </p>
            {entity.description && (
              <p className="mt-1 text-sm text-gray-500">{entity.description}</p>
            )}
          </div>
          <div className="text-right text-xs text-gray-400">
            <div>Updated <RelativeTime iso={entity.updated_at} /></div>
            <div className="mt-0.5 font-mono text-gray-300">{entity.id}</div>
          </div>
        </div>

        {entity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entity.tags.map((tag) => (
              <Badge key={tag} label={tag} variant="tag" />
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-6 shadow-sm">
        <Tabs tabs={tabs} defaultTab="overview" />
      </div>
    </div>
  );
}
