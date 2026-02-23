import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubProvider } from '../github.js';
import { GitLabProvider } from '../gitlab.js';

// ── GitHub mock ─────────────────────────────────────────────────────────────

const mockRequest = vi.fn();
const mockGhRepos = {
  listForOrg: vi.fn(),
  get: vi.fn(),
  getContent: vi.fn(),
  createInOrg: vi.fn(),
  createOrUpdateFileContents: vi.fn(),
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { repos: mockGhRepos, pulls: { create: vi.fn() }, apps: { listInstallations: vi.fn() } },
    paginate: { iterator: vi.fn() },
    request: mockRequest,
  })),
}));

vi.mock('@octokit/auth-app', () => ({ createAppAuth: vi.fn() }));

// ── GitLab mock ──────────────────────────────────────────────────────────────

const mockRepositories = { allRepositoryTrees: vi.fn() };

vi.mock('@gitbeaker/rest', () => ({
  Gitlab: vi.fn().mockImplementation(() => ({
    Groups: { allProjects: vi.fn(), show: vi.fn() },
    Projects: { show: vi.fn(), create: vi.fn() },
    RepositoryFiles: { show: vi.fn(), create: vi.fn(), edit: vi.fn() },
    MergeRequests: { create: vi.fn() },
    ProjectHooks: { all: vi.fn(), add: vi.fn() },
    Repositories: mockRepositories,
  })),
}));

// ── helpers ──────────────────────────────────────────────────────────────────

const REF = { owner: 'org', repo: 'myrepo' };

beforeEach(() => vi.clearAllMocks());

// ── GitHub listFiles ─────────────────────────────────────────────────────────

describe('GitHubProvider.listFiles', () => {
  it('returns only .md/.mdx files under the given dirPath', async () => {
    mockRequest.mockResolvedValue({
      data: {
        truncated: false,
        tree: [
          { type: 'blob', path: 'docs/index.md' },
          { type: 'blob', path: 'docs/api.mdx' },
          { type: 'blob', path: 'docs/ignore.ts' },
          { type: 'tree', path: 'docs/sub' },
          { type: 'blob', path: 'README.md' },
        ],
      },
    });

    const provider = new GitHubProvider({ token: 'ghp_test' });
    const files = await provider.listFiles(REF, 'docs');

    expect(files).toEqual(['docs/index.md', 'docs/api.mdx']);
    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
      expect.objectContaining({ owner: 'org', repo: 'myrepo', recursive: '1' }),
    );
  });

  it('returns [] when GitHub returns 404', async () => {
    mockRequest.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    const provider = new GitHubProvider({ token: 'ghp_test' });
    const files = await provider.listFiles(REF, 'docs');
    expect(files).toEqual([]);
  });
});

// ── GitLab listFiles ─────────────────────────────────────────────────────────

describe('GitLabProvider.listFiles', () => {
  it('returns .md/.mdx files from a single page', async () => {
    mockRepositories.allRepositoryTrees.mockResolvedValue([
      { type: 'blob', name: 'index.md', path: 'docs/index.md' },
      { type: 'blob', name: 'guide.mdx', path: 'docs/guide.mdx' },
      { type: 'blob', name: 'script.ts', path: 'docs/script.ts' },
      { type: 'tree', name: 'sub', path: 'docs/sub' },
    ]);

    const provider = new GitLabProvider({ token: 'glpat-test' });
    const files = await provider.listFiles(REF, 'docs');

    expect(files).toEqual(['docs/index.md', 'docs/guide.mdx']);
  });

  it('paginates until a page with fewer than 100 items', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      type: 'blob',
      name: `doc${i}.md`,
      path: `docs/doc${i}.md`,
    }));
    const page2 = [{ type: 'blob', name: 'last.md', path: 'docs/last.md' }];

    mockRepositories.allRepositoryTrees
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const provider = new GitLabProvider({ token: 'glpat-test' });
    const files = await provider.listFiles(REF, 'docs');

    expect(files).toHaveLength(101);
    expect(mockRepositories.allRepositoryTrees).toHaveBeenCalledTimes(2);
  });
});
