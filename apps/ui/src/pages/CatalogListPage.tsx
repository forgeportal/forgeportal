import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEntities } from '../hooks/useEntities.js';
import { useSearch } from '../hooks/useSearch.js';
import Badge from '../components/Badge.js';
import SkeletonRow from '../components/SkeletonRow.js';
import ErrorMessage from '../components/ErrorMessage.js';
import Spinner from '../components/Spinner.js';
import SetupChecklist from '../components/SetupChecklist.js';
import type { Entity, SearchResultItem } from '../lib/types.js';

const KINDS = [
  'service', 'library', 'website', 'api', 'component',
  'resource', 'system', 'domain', 'group', 'user', 'template',
];
const LIFECYCLES = ['experimental', 'production', 'deprecated'];
const PAGE_SIZE = 20;

function FilterBar() {
  const [searchParams, setSearchParams] = useSearchParams();

  const kind = searchParams.get('kind') ?? '';
  const lifecycle = searchParams.get('lifecycle') ?? '';
  const owner = searchParams.get('owner') ?? '';
  const tag = searchParams.get('tag') ?? '';

  function set(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('offset');
      return next;
    });
  }

  function clearAll() {
    setSearchParams({});
  }

  const hasFilters = kind || lifecycle || owner || tag;

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Kind</label>
        <select
          value={kind}
          onChange={(e) => set('kind', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Lifecycle</label>
        <select
          value={lifecycle}
          onChange={(e) => set('lifecycle', e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All lifecycles</option>
          {LIFECYCLES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Owner</label>
        <input
          type="text"
          value={owner}
          onChange={(e) => set('owner', e.target.value)}
          placeholder="team:platform"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Tag</label>
        <input
          type="text"
          value={tag}
          onChange={(e) => set('tag', e.target.value)}
          placeholder="payments"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
        />
      </div>

      {hasFilters && (
        <button
          onClick={clearAll}
          className="self-end rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function EntityTable({
  entities,
  isLoading,
  isError,
  error,
  refetch,
}: {
  entities: Entity[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}) {
  const navigate = useNavigate();

  if (isError) {
    const msg = error instanceof Error ? error.message : 'Failed to load entities';
    return <ErrorMessage message={msg} onRetry={refetch} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Kind', 'Owner', 'Lifecycle', 'Tags'].map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : entities.length === 0
              ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      No entities found
                    </div>
                  </td>
                </tr>
              )
              : entities.map((entity) => (
                <tr
                  key={entity.id}
                  onClick={() => navigate(`/catalog/${entity.id}`)}
                  className="cursor-pointer hover:bg-indigo-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-indigo-600 hover:text-indigo-800 text-sm">
                        {entity.name}
                      </span>
                      {entity.description && (
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                          {entity.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge label={entity.kind} variant="kind" />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entity.owner_ref ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {entity.lifecycle
                      ? <Badge label={entity.lifecycle} variant="lifecycle" />
                      : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {entity.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} label={tag} variant="tag" />
                      ))}
                      {entity.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{entity.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

function SearchResults({ results, query }: { results: SearchResultItem[]; query: string }) {
  const navigate = useNavigate();

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-600 mb-1">
          No results for &ldquo;{query}&rdquo;
        </p>
        {query.length >= 3 && (
          <p className="text-xs text-gray-400">
            Try: searching by service name, tag (e.g.&nbsp;&ldquo;java&rdquo;), or team name.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((item) => (
        <div
          key={`${item.type}-${item.id}`}
          onClick={() => navigate(item.url)}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  label={item.type}
                  variant={item.type === 'entity' ? 'kind' : 'tag'}
                />
                <span className="font-medium text-gray-900 text-sm truncate">{item.title}</span>
              </div>
              {item.excerpt && (
                <p
                  className="text-xs text-gray-500 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: item.excerpt }}
                />
              )}
            </div>
            <svg className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CatalogListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const kind = searchParams.get('kind') ?? undefined;
  const lifecycle = searchParams.get('lifecycle') ?? undefined;
  const owner = searchParams.get('owner') ?? undefined;
  const tag = searchParams.get('tag') ?? undefined;
  const offset = Number(searchParams.get('offset') ?? 0);

  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(inputValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(inputValue);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (inputValue) next.set('q', inputValue);
        else next.delete('q');
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const filters = { kind, lifecycle, owner, tag, offset, limit: PAGE_SIZE };
  const { data, isLoading, isError, error, refetch } = useEntities(filters);
  const { data: searchData, isLoading: isSearchLoading } = useSearch(debouncedQ);

  const isSearchMode = debouncedQ.length > 0;

  const total = data?.pagination.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function goToPage(newOffset: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newOffset === 0) next.delete('offset');
      else next.set('offset', String(newOffset));
      return next;
    });
  }

  return (
    <div>
      <SetupChecklist />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse and discover all services, libraries, and components.
        </p>
      </div>

      {/* Search input */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Filter by name, tags, owner…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {isSearchLoading && debouncedQ.length > 0 && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <Spinner size="sm" />
            </div>
          )}
        </div>
      </div>

      {isSearchMode ? (
        <>
          <div className="mb-2 text-sm text-gray-500">
            {searchData ? `${searchData.data.length} result${searchData.data.length !== 1 ? 's' : ''} for "${debouncedQ}"` : null}
          </div>
          <SearchResults results={searchData?.data ?? []} query={debouncedQ} />
        </>
      ) : (
        <>
          <FilterBar />
          <EntityTable
            entities={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            error={error}
            refetch={refetch}
          />

          {/* Pagination */}
          {!isLoading && total > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}{' '}
                {total === 1 ? 'entity' : 'entities'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => goToPage(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <span className="flex items-center px-2 text-sm text-gray-500">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => goToPage(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
