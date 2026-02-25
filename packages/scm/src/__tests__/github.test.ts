import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { GitHubProvider } from '../github.js';

const mockRepos = {
  listForOrg: vi.fn(),
  listForUser: vi.fn(),
  get: vi.fn(),
  getContent: vi.fn(),
  createInOrg: vi.fn(),
  createForAuthenticatedUser: vi.fn(),
  createOrUpdateFileContents: vi.fn(),
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
};
const mockPulls = { create: vi.fn() };
const mockApps = { listInstallations: vi.fn() };
const mockPaginate = { iterator: vi.fn() };

/** Returns an async iterable that throws the given error on first next() call. */
function throwingAsyncIterable(err: unknown) {
  return {
    [Symbol.asyncIterator]() {
      return { async next(): Promise<IteratorResult<never>> { throw err; } };
    },
  };
}

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { repos: mockRepos, pulls: mockPulls, apps: mockApps },
    paginate: mockPaginate,
  })),
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

function makeProvider(): GitHubProvider {
  return new GitHubProvider({ token: 'ghp_test' });
}

describe('GitHubProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when neither appId+privateKey nor token provided', () => {
    expect(() => new GitHubProvider({})).toThrow(
      'GitHubProvider requires either appId+privateKey or token',
    );
  });

  it('listRepos yields repos from paginated API response', async () => {
    mockPaginate.iterator.mockReturnValue([
      {
        data: [
          {
            owner: { login: 'org1' },
            name: 'repo-a',
            full_name: 'org1/repo-a',
            default_branch: 'main',
            private: false,
            html_url: 'https://github.com/org1/repo-a',
            topics: ['backend'],
            updated_at: '2025-01-01T00:00:00Z',
          },
          {
            owner: { login: 'org1' },
            name: 'repo-b',
            full_name: 'org1/repo-b',
            default_branch: 'main',
            private: true,
            html_url: 'https://github.com/org1/repo-b',
            topics: ['frontend'],
            updated_at: '2025-01-02T00:00:00Z',
          },
        ],
      },
    ]);

    const provider = makeProvider();
    const repos = [];
    for await (const repo of provider.listRepos({ org: 'org1' })) {
      repos.push(repo);
    }
    expect(repos).toHaveLength(2);
    expect(repos[0].ref.repo).toBe('repo-a');
    expect(repos[1].ref.repo).toBe('repo-b');
  });

  it('listRepos with topic filter filters client-side', async () => {
    mockPaginate.iterator.mockReturnValue([
      {
        data: [
          {
            owner: { login: 'org1' }, name: 'repo-a', full_name: 'org1/repo-a',
            default_branch: 'main', private: false, html_url: '', topics: ['backend'], updated_at: '2025-01-01T00:00:00Z',
          },
          {
            owner: { login: 'org1' }, name: 'repo-b', full_name: 'org1/repo-b',
            default_branch: 'main', private: true, html_url: '', topics: ['frontend'], updated_at: '2025-01-02T00:00:00Z',
          },
        ],
      },
    ]);

    const provider = makeProvider();
    const repos = [];
    for await (const repo of provider.listRepos({ org: 'org1', topic: 'backend' })) {
      repos.push(repo);
    }
    expect(repos).toHaveLength(1);
    expect(repos[0].ref.repo).toBe('repo-a');
  });

  it('getRepo returns mapped RepoDetail', async () => {
    mockRepos.get.mockResolvedValue({
      data: {
        owner: { login: 'org1' }, name: 'repo-a', full_name: 'org1/repo-a',
        default_branch: 'main', private: false, html_url: 'https://github.com/org1/repo-a',
        topics: [], updated_at: '2025-01-01T00:00:00Z',
        description: 'A test repo', language: 'TypeScript', archived: false,
      },
    });

    const provider = makeProvider();
    const detail = await provider.getRepo({ owner: 'org1', repo: 'repo-a' });
    expect(detail.description).toBe('A test repo');
    expect(detail.language).toBe('TypeScript');
    expect(detail.archived).toBe(false);
  });

  it('getFile with existing file returns decoded content', async () => {
    const content = Buffer.from('hello world').toString('base64');
    mockRepos.getContent.mockResolvedValue({
      data: { type: 'file', path: 'README.md', content, sha: 'abc123', encoding: 'base64' },
    });

    const provider = makeProvider();
    const file = await provider.getFile({ owner: 'org1', repo: 'repo-a' }, 'README.md');
    expect(file).not.toBeNull();
    expect(file!.content).toBe('hello world');
    expect(file!.sha).toBe('abc123');
  });

  it('getFile with 404 returns null', async () => {
    mockRepos.getContent.mockRejectedValue({ status: 404 });

    const provider = makeProvider();
    const file = await provider.getFile({ owner: 'org1', repo: 'repo-a' }, 'missing.txt');
    expect(file).toBeNull();
  });

  it('createOrUpdateFile encodes content as base64', async () => {
    mockRepos.createOrUpdateFileContents.mockResolvedValue({
      data: { commit: { sha: 'commit-sha', html_url: 'https://github.com/...' } },
    });

    const provider = makeProvider();
    const result = await provider.createOrUpdateFile(
      { owner: 'org1', repo: 'repo-a' }, 'file.txt', 'test content', 'add file', 'main',
    );
    expect(result.sha).toBe('commit-sha');
    const call = mockRepos.createOrUpdateFileContents.mock.calls[0][0];
    expect(call.content).toBe(Buffer.from('test content').toString('base64'));
  });

  it('createPullRequest returns PRResult', async () => {
    mockPulls.create.mockResolvedValue({
      data: { number: 42, html_url: 'https://github.com/org1/repo-a/pull/42', state: 'open' },
    });

    const provider = makeProvider();
    const pr = await provider.createPullRequest(
      { owner: 'org1', repo: 'repo-a' },
      { title: 'feat', body: 'description', head: 'feature', base: 'main' },
    );
    expect(pr.number).toBe(42);
    expect(pr.state).toBe('open');
  });

  it('ensureWebhook creates webhook when none exists', async () => {
    mockRepos.listWebhooks.mockResolvedValue({ data: [] });
    mockRepos.createWebhook.mockResolvedValue({ data: { id: 1 } });

    const provider = makeProvider();
    const result = await provider.ensureWebhook(
      { owner: 'org1', repo: 'repo-a' }, 'https://example.com/webhook', ['push'],
    );
    expect(result.id).toBe(1);
    expect(result.active).toBe(true);
    expect(mockRepos.createWebhook).toHaveBeenCalled();
  });

  it('ensureWebhook reuses existing active webhook', async () => {
    mockRepos.listWebhooks.mockResolvedValue({
      data: [{ id: 5, config: { url: 'https://example.com/webhook' }, active: true }],
    });

    const provider = makeProvider();
    const result = await provider.ensureWebhook(
      { owner: 'org1', repo: 'repo-a' }, 'https://example.com/webhook', ['push'],
    );
    expect(result.id).toBe(5);
    expect(mockRepos.createWebhook).not.toHaveBeenCalled();
    expect(mockRepos.updateWebhook).not.toHaveBeenCalled();
  });

  it('verifyWebhookSignature valid → true', () => {
    const secret = 'my-secret';
    const payload = '{"action":"push"}';
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const provider = makeProvider();
    expect(provider.verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it('verifyWebhookSignature invalid → false', () => {
    const provider = makeProvider();
    expect(provider.verifyWebhookSignature('payload', 'sha256=wrong', 'secret')).toBe(false);
  });

  it('resolveInstallation finds installation by org for GitHub App', async () => {
    mockApps.listInstallations.mockResolvedValue({
      data: [
        { id: 100, account: { login: 'my-org' } },
        { id: 200, account: { login: 'other-org' } },
      ],
    });

    const provider = new GitHubProvider({ appId: '123', privateKey: 'fake-pem' });
    await provider.resolveInstallation('my-org');
    const { Octokit } = await import('@octokit/rest');
    const calls = (Octokit as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.auth.installationId).toBe(100);
  });

  it('resolveInstallation is no-op for PAT auth', async () => {
    const provider = makeProvider();
    await provider.resolveInstallation('org1');
    expect(mockApps.listInstallations).not.toHaveBeenCalled();
  });

  describe('user vs org fallback', () => {
    it('listRepos falls back to listForUser when listForOrg returns 404', async () => {
      mockPaginate.iterator
        .mockReturnValueOnce(throwingAsyncIterable({ status: 404 }))
        .mockReturnValueOnce([
          {
            data: [
              {
                owner: { login: 'john' },
                name: 'personal-repo',
                full_name: 'john/personal-repo',
                default_branch: 'main',
                private: false,
                html_url: 'https://github.com/john/personal-repo',
                topics: [],
                updated_at: '2025-01-01T00:00:00Z',
              },
            ],
          },
        ]);

      const provider = makeProvider();
      const repos: import('../types.js').RepoSummary[] = [];
      for await (const repo of provider.listRepos({ org: 'john' })) {
        repos.push(repo);
      }

      expect(repos).toHaveLength(1);
      expect(repos[0].ref.repo).toBe('personal-repo');
      expect(mockPaginate.iterator).toHaveBeenCalledTimes(2);
      // Second call must use listForUser with username param
      expect(mockPaginate.iterator.mock.calls[1][0]).toBe(mockRepos.listForUser);
      expect(mockPaginate.iterator.mock.calls[1][1]).toEqual({ username: 'john', per_page: 100 });
    });

    it('listRepos re-throws non-404 errors from org endpoint', async () => {
      mockPaginate.iterator.mockReturnValueOnce(throwingAsyncIterable({ status: 403 }));

      const provider = makeProvider();
      const iter = provider.listRepos({ org: 'org1' })[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toMatchObject({ status: 403 });
    });

    it('createRepo falls back to createForAuthenticatedUser when createInOrg returns 404', async () => {
      mockRepos.createInOrg.mockRejectedValue({ status: 404 });
      mockRepos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          owner: { login: 'john' },
          name: 'personal-repo',
          full_name: 'john/personal-repo',
          default_branch: 'main',
          private: true,
          html_url: 'https://github.com/john/personal-repo',
          topics: [],
          updated_at: '2025-01-01T00:00:00Z',
          description: null,
          language: null,
          archived: false,
        },
      });

      const provider = makeProvider();
      const result = await provider.createRepo({
        org: 'john',
        name: 'personal-repo',
        description: '',
        private: true,
        autoInit: false,
      });

      expect(result.ref.repo).toBe('personal-repo');
      expect(mockRepos.createInOrg).toHaveBeenCalledOnce();
      expect(mockRepos.createForAuthenticatedUser).toHaveBeenCalledOnce();
      expect(mockRepos.createForAuthenticatedUser.mock.calls[0][0]).toMatchObject({
        name: 'personal-repo',
        private: true,
      });
    });

    it('createRepo re-throws non-404 errors from createInOrg', async () => {
      mockRepos.createInOrg.mockRejectedValue({ status: 422, message: 'already exists' });

      const provider = makeProvider();
      await expect(
        provider.createRepo({ org: 'org1', name: 'repo', description: '', private: true, autoInit: false }),
      ).rejects.toMatchObject({ status: 422 });
      expect(mockRepos.createForAuthenticatedUser).not.toHaveBeenCalled();
    });
  });
});
