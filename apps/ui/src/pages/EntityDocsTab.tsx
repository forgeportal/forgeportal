import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchDocsList, fetchDocsPage } from '../lib/docs.api.js';
import { ApiError } from '../lib/api.js';
import ErrorMessage from '../components/ErrorMessage.js';

interface EntityDocsTabProps {
  entityId: string;
}

function SidebarSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200" style={{ width: `${60 + i * 8}%` }} />
      ))}
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-7 w-48 rounded bg-gray-200" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-gray-200" style={{ width: `${90 - i * 10}%` }} />
      ))}
    </div>
  );
}

export default function EntityDocsTab({ entityId }: EntityDocsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
  } = useQuery({
    queryKey: ['docs-list', entityId],
    queryFn: () => fetchDocsList(entityId),
  });

  const pages = listData?.data.pages ?? [];

  // URL-driven selected page (AC: 2, 3, 4)
  const selectedPath = searchParams.get('doc');
  const activePath   = selectedPath ?? pages[0]?.path ?? null;

  // Auto-select first page when none is set in URL (AC: 2)
  useEffect(() => {
    if (pages.length > 0 && !searchParams.get('doc')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('doc', pages[0]!.path);
          return next;
        },
        { replace: true },
      );
    }
  }, [pages]);

  function handlePageSelect(path: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('doc', path);
      return next;
    });
  }

  const {
    data: pageData,
    isLoading: pageLoading,
    isError: pageError,
    error: pageErr,
  } = useQuery({
    queryKey: ['docs-page', entityId, activePath],
    queryFn:  () => fetchDocsPage(entityId, activePath!),
    enabled:  !!activePath,
  });

  // Scroll-to-top on page change (AC: 6)
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activePath]);

  // Update browser <title> (AC: 1 / Task 6)
  useEffect(() => {
    if (pageData?.data.title) {
      document.title = `${pageData.data.title} — ForgePortal`;
    }
    return () => {
      document.title = 'ForgePortal';
    };
  }, [pageData?.data.title]);

  // No binding configured → 404 from API
  if (listError) {
    const err = listErr as Error;
    const is404 = (listErr instanceof ApiError && listErr.status === 404) ||
                  err.message?.includes('404') ||
                  err.message?.toLowerCase().includes('not found');
    if (is404) {
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="max-w-sm text-sm text-gray-500">
            No docs configured for this entity — add a{' '}
            <code className="rounded bg-gray-100 px-1 text-xs">docs_bindings</code>{' '}
            entry to get started.
          </p>
        </div>
      );
    }
    return (
      <ErrorMessage
        message={listErr instanceof Error ? listErr.message : 'Failed to load docs'}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Mobile: page selector dropdown (AC: 5) */}
      <div className="md:hidden">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Page
        </label>
        {listLoading ? (
          <div className="h-9 animate-pulse rounded-md bg-gray-200" />
        ) : (
          <select
            value={activePath ?? ''}
            onChange={(e) => handlePageSelect(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            {pages.map((page) => (
              <option key={page.path} value={page.path}>
                {page.title ?? page.path}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Desktop: sidebar — page list (AC: 5) */}
      <aside className="hidden w-56 shrink-0 md:block">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Pages
        </h3>
        {listLoading ? (
          <SidebarSkeleton />
        ) : pages.length === 0 ? (
          <p className="text-xs text-gray-400">No indexed pages yet.</p>
        ) : (
          <nav className="space-y-0.5">
            {pages.map((page) => (
              <button
                key={page.path}
                onClick={() => handlePageSelect(page.path)}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  activePath === page.path
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {page.title ?? page.path}
              </button>
            ))}
          </nav>
        )}
      </aside>

      {/* Main content — rendered markdown (AC: 1) */}
      <main ref={contentRef} className="min-w-0 flex-1 overflow-auto">
        {!activePath ? (
          <p className="text-sm text-gray-400">Select a page from the sidebar.</p>
        ) : pageLoading ? (
          <ContentSkeleton />
        ) : pageError ? (
          <ErrorMessage
            message={pageErr instanceof Error ? pageErr.message : 'Failed to load page'}
          />
        ) : pageData ? (
          <>
            {pageData.data.title && (
              <h1 className="mb-4 border-b border-gray-100 pb-3 text-xl font-bold text-gray-900">
                {pageData.data.title}
              </h1>
            )}
            {/* HTML is server-sanitized via rehype-sanitize (GitHub allowlist) — safe to render */}
            <article className="prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: pageData.data.html }} />
            </article>
          </>
        ) : null}
      </main>
    </div>
  );
}
