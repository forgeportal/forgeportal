import { useState } from 'react';
import Badge from '../components/Badge.js';
import type { Entity, EntitySource } from '../lib/types.js';
import { EntityProvider, PluginConfigProvider } from '@forgeportal/plugin-sdk/react';
import type { Entity as SdkEntity } from '@forgeportal/plugin-sdk';
import { usePlugins } from '../plugins/PluginContext.js';
import { cardOwnership } from '../plugins/plugin-registry-ui.js';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <dt className="w-28 shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return <span>Today</span>;
  if (diffDays === 1) return <span>Yesterday</span>;
  if (diffDays < 30) return <span>{diffDays} days ago</span>;
  if (diffDays < 365) return <span>{Math.floor(diffDays / 30)} months ago</span>;
  return <span>{Math.floor(diffDays / 365)} years ago</span>;
}

function CollapsibleSpec({ spec }: { spec: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(spec);
  if (entries.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {open ? 'Hide' : 'Show'} spec ({entries.length} fields)
      </button>
      {open && (
        <dl className="mt-3 rounded-lg bg-gray-50 px-4 py-2">
          {entries.map(([k, v]) => (
            <KVRow
              key={k}
              label={k}
              value={
                <span className="font-mono text-xs text-gray-700">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                </span>
              }
            />
          ))}
        </dl>
      )}
    </div>
  );
}

interface EntityOverviewTabProps {
  entity: Entity;
  sources: EntitySource[];
}

export default function EntityOverviewTab({ entity, sources }: EntityOverviewTabProps) {
  const { getEntityCards, getPluginConfig } = usePlugins();
  const scm = entity.scm as Record<string, string | null | undefined>;

  const sdkEntity: SdkEntity = {
    id:        entity.id,
    kind:      entity.kind,
    namespace: entity.namespace,
    name:      entity.name,
    title:     entity.name,
    tags:      entity.tags,
    links:     entity.links,
    owner_ref: entity.owner_ref ?? undefined,
    lifecycle: entity.lifecycle ?? undefined,
    spec:      entity.spec,
  };

  const pluginCards = getEntityCards(entity.kind);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column — main metadata */}
      <div className="lg:col-span-2 space-y-6">
        <Section title="Metadata">
          <dl className="rounded-lg border border-gray-200 bg-white px-4 py-2 divide-y divide-gray-100">
            <KVRow label="Namespace" value={entity.namespace} />
            <KVRow
              label="Lifecycle"
              value={entity.lifecycle
                ? <Badge label={entity.lifecycle} variant="lifecycle" />
                : <span className="text-gray-300">—</span>}
            />
            <KVRow
              label="Tags"
              value={
                entity.tags.length > 0
                  ? (
                    <div className="flex flex-wrap gap-1">
                      {entity.tags.map((t) => <Badge key={t} label={t} variant="tag" />)}
                    </div>
                  )
                  : <span className="text-gray-300">No tags</span>
              }
            />
            <KVRow label="Created" value={<RelativeTime iso={entity.created_at} />} />
            <KVRow label="Updated" value={<RelativeTime iso={entity.updated_at} />} />
          </dl>
        </Section>

        {entity.links.length > 0 && (
          <Section title="Links">
            <ul className="space-y-2">
              {entity.links.map((link, i) => (
                <li key={i}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {link.title || link.url}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {Object.keys(entity.spec).length > 0 && (
          <Section title="Spec">
            <CollapsibleSpec spec={entity.spec} />
          </Section>
        )}

        {/* Plugin-provided entity cards */}
        {pluginCards.map((card) => {
          const ownerPluginId = cardOwnership.get(card.id) ?? '';
          const pluginConfig  = getPluginConfig(ownerPluginId);
          return (
            <Section key={card.id} title={card.title}>
              <EntityProvider entity={sdkEntity}>
                <PluginConfigProvider config={pluginConfig}>
                  <card.component entity={sdkEntity} />
                </PluginConfigProvider>
              </EntityProvider>
            </Section>
          );
        })}
      </div>

      {/* Right column — SCM + Sources */}
      <div className="space-y-6">
        {scm && Object.keys(scm).length > 0 && (
          <Section title="SCM">
            <dl className="rounded-lg border border-gray-200 bg-white px-4 py-2 divide-y divide-gray-100">
              {scm['provider'] && (
                <KVRow
                  label="Provider"
                  value={
                    <span className="flex items-center gap-1.5">
                      {scm['provider'] === 'github' ? '🐙' : scm['provider'] === 'gitlab' ? '🦊' : '📁'}
                      {scm['provider']}
                    </span>
                  }
                />
              )}
              {scm['repoUrl'] && (
                <KVRow
                  label="Repo"
                  value={
                    <a href={scm['repoUrl']} target="_blank" rel="noopener noreferrer"
                      className="truncate text-indigo-600 hover:underline text-xs">
                      {scm['repoUrl']}
                    </a>
                  }
                />
              )}
              {scm['defaultBranch'] && (
                <KVRow label="Branch" value={<code className="text-xs bg-gray-100 px-1 rounded">{scm['defaultBranch']}</code>} />
              )}
            </dl>
          </Section>
        )}

        {sources.length > 0 && (
          <Section title="Sources">
            <ul className="space-y-2">
              {sources.map((source) => (
                <li key={source.id} className="rounded-lg border border-gray-200 bg-white p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-gray-700">
                    {source.provider === 'github' ? '🐙' : '🦊'}
                    {source.provider}
                  </div>
                  <a href={source.repo_url} target="_blank" rel="noopener noreferrer"
                    className="block truncate text-indigo-600 hover:underline">
                    {source.repo_url}
                  </a>
                  <div className="text-gray-400">
                    {source.last_seen_at
                      ? <>Last seen: <RelativeTime iso={source.last_seen_at} /></>
                      : 'Not yet seen'}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}
