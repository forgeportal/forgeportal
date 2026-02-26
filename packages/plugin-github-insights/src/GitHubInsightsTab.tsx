import React, { useState } from 'react';
import { useApi } from '@forgeportal/plugin-sdk/react';
import type { Entity } from '@forgeportal/plugin-sdk';
import type { GHRepo, GHPR, GHCommit, GHContributor } from './types.js';
import { parseGitHubUrl } from './api-client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewResponse {
  data: { repo: GHRepo; openPRCount: number; latestCommit: GHCommit | null };
}
interface PRsResponse          { data: GHPR[] }
interface CommitsResponse      { data: GHCommit[] }
interface ContributorsResponse { data: GHContributor[] }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts GitHub owner/repo from:
 *   1. entity.annotations['forgeportal.dev/github-repo'] (explicit override)
 *   2. entity.links — first link pointing to github.com
 *   3. entity.spec.scmUrl — if it's a github.com URL
 */
function extractGitHubRef(entity: Entity): { owner: string; repo: string } | null {
  // 1. Explicit annotation: forgeportal.dev/github-repo = owner/repo
  const annotationRepo = entity.annotations?.['forgeportal.dev/github-repo'];
  if (annotationRepo) {
    const parts = annotationRepo.replace(/^https?:\/\/github\.com\//, '').split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  // 2. Links — first github.com URL
  for (const link of entity.links ?? []) {
    const ref = parseGitHubUrl(link.url);
    if (ref) return ref;
  }

  // 3. spec.scmUrl
  const scmUrl = entity.spec?.['scmUrl'];
  if (typeof scmUrl === 'string') {
    const ref = parseGitHubUrl(scmUrl);
    if (ref) return ref;
  }

  return null;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

function truncateSha(sha: string): string {
  return sha.slice(0, 7);
}

function truncateMessage(msg: string, max = 72): string {
  const first = msg.split('\n')[0] ?? msg;
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-gray-700">{children}</h3>
      {count !== undefined && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{count}</span>
      )}
    </div>
  );
}

function PRStatusBadge({ draft, labels }: { draft: boolean; labels: { name: string; color: string }[] }): React.ReactElement {
  if (draft) {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Draft</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l.name}
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: `#${l.color}22`, color: `#${l.color}` }}
        >
          {l.name}
        </span>
      ))}
      {labels.length === 0 && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Open</span>
      )}
    </div>
  );
}

// ─── Tab views ────────────────────────────────────────────────────────────────

type ActiveView = 'overview' | 'prs' | 'commits' | 'contributors';

// ─── Main Tab ────────────────────────────────────────────────────────────────

interface GitHubInsightsTabProps { entity: Entity }

export function GitHubInsightsTab({ entity }: GitHubInsightsTabProps): React.ReactElement {
  const [activeView, setActiveView] = useState<ActiveView>('overview');

  const ghRef = extractGitHubRef(entity);

  // Not configured state
  if (!ghRef) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">No GitHub repository linked</p>
        <p className="text-xs text-gray-500 mb-4">
          Add a GitHub link to your{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">entity.yaml</code>{' '}
          or set the annotation{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">forgeportal.dev/github-repo</code>.
        </p>
        <pre className="mx-auto max-w-md rounded bg-gray-800 p-3 text-left text-xs text-green-300">
          {`metadata:\n  links:\n    - title: GitHub\n      url: https://github.com/owner/repo`}
        </pre>
      </div>
    );
  }

  const { owner, repo } = ghRef;
  const baseUrl = `/api/v1/plugins/github-insights/entities/${entity.id}`;
  const q = `owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;

  const { data: overviewData, isPending: overviewLoading, error: overviewError } =
    useApi<OverviewResponse>(`${baseUrl}/overview?${q}`, { staleTime: 60_000 });

  const { data: prsData, isPending: prsLoading } =
    useApi<PRsResponse>(`${baseUrl}/prs?${q}`, {
      enabled: activeView === 'prs',
      staleTime: 60_000,
    });

  const { data: commitsData, isPending: commitsLoading } =
    useApi<CommitsResponse>(`${baseUrl}/commits?${q}`, {
      enabled: activeView === 'commits',
      staleTime: 60_000,
    });

  const { data: contributorsData, isPending: contributorsLoading } =
    useApi<ContributorsResponse>(`${baseUrl}/contributors?${q}`, {
      enabled: activeView === 'contributors',
      staleTime: 300_000,
    });

  const overview      = overviewData?.data;
  const prs           = prsData?.data ?? [];
  const commits       = commitsData?.data ?? [];
  const contributors  = contributorsData?.data ?? [];

  const views: { id: ActiveView; label: string }[] = [
    { id: 'overview',      label: 'Overview'      },
    { id: 'prs',           label: `PRs${overview ? ` (${overview.openPRCount})` : ''}` },
    { id: 'commits',       label: 'Commits'       },
    { id: 'contributors',  label: 'Contributors'  },
  ];

  return (
    <div className="space-y-4">
      {/* Repo header */}
      <div className="flex items-center justify-between">
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:underline"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.046.138 3.006.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .322.218.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          {owner}/{repo}
        </a>
        {overview && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>⭐ {overview.repo.stargazers_count.toLocaleString()}</span>
            <span>🍴 {overview.repo.forks_count.toLocaleString()}</span>
            {overview.repo.language && <span>🔵 {overview.repo.language}</span>}
          </div>
        )}
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              activeView === v.id
                ? 'border-b-2 border-indigo-500 text-indigo-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {overviewError && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <span className="font-medium">Limited access: </span>
          {overviewError instanceof Error ? overviewError.message : 'GitHub API error'}
        </div>
      )}

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          {overviewLoading && (
            <p className="text-xs text-gray-400 animate-pulse">Loading repository overview…</p>
          )}

          {overview && (
            <>
              {/* Repo stats cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Open PRs',    value: overview.openPRCount,           icon: '🔀' },
                  { label: 'Open Issues', value: overview.repo.open_issues_count, icon: '🐛' },
                  { label: 'Stars',       value: overview.repo.stargazers_count,  icon: '⭐' },
                  { label: 'Forks',       value: overview.repo.forks_count,       icon: '🍴' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">{stat.icon} {stat.label}</p>
                    <p className="mt-1 text-lg font-semibold text-gray-800">
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Repo details */}
              {overview.repo.description && (
                <p className="text-xs text-gray-600 italic">{overview.repo.description}</p>
              )}

              {/* Latest commit */}
              {overview.latestCommit && (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Latest Commit</p>
                  <div className="flex items-start gap-3">
                    {overview.latestCommit.author && (
                      <img
                        src={overview.latestCommit.author.avatar_url}
                        alt={overview.latestCommit.author.login}
                        className="h-6 w-6 rounded-full"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-800 font-medium truncate">
                        {truncateMessage(overview.latestCommit.commit.message)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <a
                          href={overview.latestCommit.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-indigo-600 hover:underline"
                        >
                          {truncateSha(overview.latestCommit.sha)}
                        </a>
                        {' · '}
                        {overview.latestCommit.commit.author.name}
                        {' · '}
                        {relativeTime(overview.latestCommit.commit.author.date)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Pull Requests ────────────────────────────────────────────────────── */}
      {activeView === 'prs' && (
        <div>
          <SectionTitle count={prs.length}>Open Pull Requests</SectionTitle>
          {prsLoading && <p className="text-xs text-gray-400 animate-pulse">Loading PRs…</p>}
          {!prsLoading && prs.length === 0 && (
            <p className="text-xs text-gray-400">No open pull requests. 🎉</p>
          )}
          <div className="space-y-2">
            {prs.map((pr) => (
              <div key={pr.number} className="rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
                <div className="flex items-start gap-2">
                  <img src={pr.user.avatar_url} alt={pr.user.login} className="h-5 w-5 rounded-full mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-gray-800 hover:text-indigo-600 hover:underline line-clamp-1"
                    >
                      {pr.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">
                        #{pr.number} · {pr.user.login} · {relativeTime(pr.created_at)}
                      </span>
                    </div>
                  </div>
                  <PRStatusBadge draft={pr.draft} labels={pr.labels} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Commits ──────────────────────────────────────────────────────────── */}
      {activeView === 'commits' && (
        <div>
          <SectionTitle count={commits.length}>Recent Commits</SectionTitle>
          {commitsLoading && <p className="text-xs text-gray-400 animate-pulse">Loading commits…</p>}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">SHA</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Message</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Author</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {commits.map((c) => (
                  <tr key={c.sha} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <a href={c.html_url} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 hover:underline">
                        {truncateSha(c.sha)}
                      </a>
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <p className="truncate text-gray-800">{truncateMessage(c.commit.message, 60)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {c.author && (
                          <img src={c.author.avatar_url} alt={c.author.login} className="h-4 w-4 rounded-full" />
                        )}
                        <span className="text-gray-600">{c.commit.author.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {relativeTime(c.commit.author.date)}
                    </td>
                  </tr>
                ))}
                {!commitsLoading && commits.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">No commits found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Contributors ─────────────────────────────────────────────────────── */}
      {activeView === 'contributors' && (
        <div>
          <SectionTitle count={contributors.length}>Top Contributors</SectionTitle>
          {contributorsLoading && <p className="text-xs text-gray-400 animate-pulse">Loading contributors…</p>}
          {contributors.length > 0 && (() => {
            const max = contributors[0]?.contributions ?? 1;
            return (
              <div className="space-y-3">
                {contributors.map((c) => (
                  <div key={c.login} className="flex items-center gap-3">
                    <img src={c.avatar_url} alt={c.login} className="h-7 w-7 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <a
                          href={c.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-gray-800 hover:text-indigo-600 hover:underline"
                        >
                          {c.login}
                        </a>
                        <span className="text-xs text-gray-500">{c.contributions} commits</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-indigo-500"
                          style={{ width: `${Math.round((c.contributions / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
          {!contributorsLoading && contributors.length === 0 && (
            <p className="text-xs text-gray-400">No contributors data available.</p>
          )}
        </div>
      )}
    </div>
  );
}
