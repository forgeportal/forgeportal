import type {
  GHRepo,
  GHPR,
  GHCommit,
  GHContributor,
  GHWorkflowRun,
  GitHubInsightsConfig,
  CacheEntry,
} from './types.js';

const GITHUB_API = 'https://api.github.com';

/**
 * Minimal GitHub REST API client with in-process TTL cache.
 * Uses the standard GitHub token from config (falls back to SCM_GITHUB_TOKEN).
 * Respects Retry-After headers to avoid secondary rate limit penalties.
 */
export class GitHubInsightsClient {
  private readonly token:   string;
  private readonly ttlMs:   number;
  private readonly cache    = new Map<string, CacheEntry<unknown>>();

  constructor(config: GitHubInsightsConfig) {
    this.token = config.token;
    this.ttlMs = config.cacheTTLSeconds * 1000;
  }

  private async get<T>(path: string): Promise<T> {
    const cacheKey = path;

    if (this.ttlMs > 0) {
      const hit = this.cache.get(cacheKey);
      if (hit && Date.now() < hit.expiresAt) return hit.data as T;
    }

    const res = await (fetch as (url: string, init: Record<string, unknown>) => Promise<Response>)(
      `${GITHUB_API}${path}`,
      {
        headers: {
          Authorization:        `Bearer ${this.token}`,
          Accept:               'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (res.status === 403 || res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      throw new Error(
        `GitHub rate limit hit (${res.status}).${retryAfter ? ` Retry after ${retryAfter}s.` : ''}`,
      );
    }

    if (res.status === 404) {
      throw new Error(`GitHub resource not found: ${path}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`GitHub API ${res.status}: ${body || res.statusText}`);
    }

    const data = await res.json() as T;

    if (this.ttlMs > 0) {
      this.cache.set(cacheKey, { data, expiresAt: Date.now() + this.ttlMs });
    }

    return data;
  }

  /** GET /repos/{owner}/{repo} */
  getRepo(owner: string, repo: string): Promise<GHRepo> {
    return this.get<GHRepo>(`/repos/${owner}/${repo}`);
  }

  /** GET /repos/{owner}/{repo}/pulls?state=open&per_page=25 */
  getOpenPRs(owner: string, repo: string): Promise<GHPR[]> {
    return this.get<GHPR[]>(
      `/repos/${owner}/${repo}/pulls?state=open&per_page=25&sort=updated&direction=desc`,
    );
  }

  /** GET /repos/{owner}/{repo}/commits?per_page=20 */
  getRecentCommits(owner: string, repo: string): Promise<GHCommit[]> {
    return this.get<GHCommit[]>(
      `/repos/${owner}/${repo}/commits?per_page=20`,
    );
  }

  /** GET /repos/{owner}/{repo}/contributors?per_page=10&anon=false */
  getContributors(owner: string, repo: string): Promise<GHContributor[]> {
    return this.get<GHContributor[]>(
      `/repos/${owner}/${repo}/contributors?per_page=10&anon=false`,
    );
  }

  /** GET /repos/{owner}/{repo}/actions/runs?per_page=10 */
  getWorkflowRuns(owner: string, repo: string): Promise<{ workflow_runs: GHWorkflowRun[] }> {
    return this.get<{ workflow_runs: GHWorkflowRun[] }>(
      `/repos/${owner}/${repo}/actions/runs?per_page=10`,
    );
  }
}

/**
 * Parses a GitHub repo URL and returns { owner, repo } or null.
 * Handles: https://github.com/owner/repo and github.com/owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!parsed.hostname.endsWith('github.com')) return null;
    const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}
