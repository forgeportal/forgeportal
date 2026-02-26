import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubInsightsClient, parseGitHubUrl } from '../api-client.js';
import type { GitHubInsightsConfig } from '../types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONFIG: GitHubInsightsConfig = {
  token:           'ghp_test_token',
  cacheTTLSeconds: 0, // disable cache for tests
};

const REPO_FIXTURE = {
  full_name:        'acme/payments-api',
  description:      'The payments API',
  default_branch:   'main',
  stargazers_count: 42,
  forks_count:      7,
  open_issues_count: 3,
  language:         'TypeScript',
  html_url:         'https://github.com/acme/payments-api',
  pushed_at:        '2026-02-20T10:00:00Z',
};

const PR_FIXTURE = [{
  number:     99,
  title:      'feat: add webhook support',
  html_url:   'https://github.com/acme/payments-api/pull/99',
  state:      'open',
  user:       { login: 'alice', avatar_url: 'https://avatars.githubusercontent.com/alice' },
  created_at: '2026-02-18T09:00:00Z',
  updated_at: '2026-02-19T14:00:00Z',
  labels:     [],
}];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({
    ok:         status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers:    { get: () => null },
    json:       () => Promise.resolve(body),
    text:       () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

// ── parseGitHubUrl ────────────────────────────────────────────────────────────

describe('parseGitHubUrl', () => {
  it('parses a standard HTTPS GitHub URL', () => {
    expect(parseGitHubUrl('https://github.com/acme/payments-api')).toEqual({
      owner: 'acme',
      repo:  'payments-api',
    });
  });

  it('strips .git suffix', () => {
    expect(parseGitHubUrl('https://github.com/acme/payments-api.git')).toEqual({
      owner: 'acme',
      repo:  'payments-api',
    });
  });

  it('parses URL without protocol prefix', () => {
    expect(parseGitHubUrl('github.com/acme/my-repo')).toEqual({
      owner: 'acme',
      repo:  'my-repo',
    });
  });

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/acme/repo')).toBeNull();
    expect(parseGitHubUrl('https://bitbucket.org/acme/repo')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseGitHubUrl('not-a-url')).toBeNull();
    expect(parseGitHubUrl('')).toBeNull();
  });

  it('returns null when owner or repo is missing', () => {
    expect(parseGitHubUrl('https://github.com/acme')).toBeNull();
    expect(parseGitHubUrl('https://github.com/')).toBeNull();
  });
});

// ── GitHubInsightsClient.getRepo ──────────────────────────────────────────────

describe('GitHubInsightsClient.getRepo', () => {
  const client = new GitHubInsightsClient(CONFIG);

  it('fetches repository metadata', async () => {
    mockFetch(REPO_FIXTURE);
    const repo = await client.getRepo('acme', 'payments-api');
    expect(repo.full_name).toBe('acme/payments-api');
    expect(repo.stargazers_count).toBe(42);
  });

  it('sends the Authorization header', async () => {
    const fetchMock = mockFetch(REPO_FIXTURE);
    await client.getRepo('acme', 'payments-api');
    const [, init] = fetchMock.mock.calls[0] as [string, Record<string, Record<string, string>>];
    expect(init.headers['Authorization']).toBe('Bearer ghp_test_token');
  });

  it('sends Accept: application/vnd.github+json', async () => {
    const fetchMock = mockFetch(REPO_FIXTURE);
    await client.getRepo('acme', 'payments-api');
    const [, init] = fetchMock.mock.calls[0] as [string, Record<string, Record<string, string>>];
    expect(init.headers['Accept']).toBe('application/vnd.github+json');
  });

  it('throws "not found" on 404', async () => {
    mockFetch({ message: 'Not Found' }, 404);
    await expect(client.getRepo('acme', 'ghost-repo')).rejects.toThrow('not found');
  });

  it('throws rate limit error on 403', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false, status: 403,
      headers: { get: (h: string) => h === 'Retry-After' ? '60' : null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('rate limit'),
    });
    vi.stubGlobal('fetch', mock);
    await expect(client.getRepo('acme', 'payments-api')).rejects.toThrow(/rate limit/i);
  });

  it('throws rate limit error on 429', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false, status: 429,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('too many'),
    });
    vi.stubGlobal('fetch', mock);
    await expect(client.getRepo('acme', 'payments-api')).rejects.toThrow(/rate limit/i);
  });
});

// ── GitHubInsightsClient.getOpenPRs ───────────────────────────────────────────

describe('GitHubInsightsClient.getOpenPRs', () => {
  const client = new GitHubInsightsClient(CONFIG);

  it('returns open pull requests', async () => {
    mockFetch(PR_FIXTURE);
    const prs = await client.getOpenPRs('acme', 'payments-api');
    expect(prs).toHaveLength(1);
    expect(prs[0]?.number).toBe(99);
    expect(prs[0]?.title).toBe('feat: add webhook support');
  });

  it('requests the correct query parameters', async () => {
    const fetchMock = mockFetch(PR_FIXTURE);
    await client.getOpenPRs('acme', 'payments-api');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('state=open');
    expect(url).toContain('per_page=25');
  });
});

// ── TTL cache ─────────────────────────────────────────────────────────────────

describe('GitHubInsightsClient TTL cache', () => {
  it('serves cached data on second request when TTL > 0', async () => {
    const cachedClient = new GitHubInsightsClient({ ...CONFIG, cacheTTLSeconds: 300 });
    const fetchMock = mockFetch(REPO_FIXTURE);

    await cachedClient.getRepo('acme', 'payments-api');
    await cachedClient.getRepo('acme', 'payments-api');

    // fetch should only be called once — second call is from cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when TTL is 0', async () => {
    const noCache = new GitHubInsightsClient({ ...CONFIG, cacheTTLSeconds: 0 });
    const fetchMock = mockFetch(REPO_FIXTURE);

    await noCache.getRepo('acme', 'payments-api');
    await noCache.getRepo('acme', 'payments-api');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
