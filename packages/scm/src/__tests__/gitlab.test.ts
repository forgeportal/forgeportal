import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitLabProvider } from '../gitlab.js';

const mockGroups = {
  allProjects: vi.fn(),
  show: vi.fn(),
};
const mockProjects = {
  show: vi.fn(),
  create: vi.fn(),
};
const mockRepoFiles = {
  show: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
};
const mockMergeRequests = { create: vi.fn() };
const mockProjectHooks = {
  all: vi.fn(),
  add: vi.fn(),
};

vi.mock('@gitbeaker/rest', () => ({
  Gitlab: vi.fn().mockImplementation(() => ({
    Groups: mockGroups,
    Projects: mockProjects,
    RepositoryFiles: mockRepoFiles,
    MergeRequests: mockMergeRequests,
    ProjectHooks: mockProjectHooks,
  })),
}));

function makeProvider(): GitLabProvider {
  return new GitLabProvider({ token: 'glpat-test' });
}

describe('GitLabProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listRepos yields projects from group', async () => {
    mockGroups.allProjects.mockResolvedValue([
      {
        path_with_namespace: 'mygroup/project-a',
        path: 'project-a',
        namespace: { full_path: 'mygroup' },
        default_branch: 'main',
        visibility: 'public',
        web_url: 'https://gitlab.com/mygroup/project-a',
        topics: ['backend'],
        last_activity_at: '2025-01-01T00:00:00Z',
      },
    ]);

    const provider = makeProvider();
    const repos = [];
    for await (const repo of provider.listRepos({ org: 'mygroup' })) {
      repos.push(repo);
    }
    expect(repos).toHaveLength(1);
    expect(repos[0].ref.repo).toBe('project-a');
    expect(repos[0].fullName).toBe('mygroup/project-a');
  });

  it('listRepos paginates across multiple pages', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      path_with_namespace: `mygroup/project-${i}`,
      path: `project-${i}`,
      namespace: { full_path: 'mygroup' },
      default_branch: 'main',
      visibility: 'public',
      web_url: `https://gitlab.com/mygroup/project-${i}`,
      topics: [],
      last_activity_at: '2025-01-01T00:00:00Z',
    }));
    const page2 = [
      {
        path_with_namespace: 'mygroup/project-100',
        path: 'project-100',
        namespace: { full_path: 'mygroup' },
        default_branch: 'main',
        visibility: 'public',
        web_url: 'https://gitlab.com/mygroup/project-100',
        topics: [],
        last_activity_at: '2025-01-01T00:00:00Z',
      },
    ];

    mockGroups.allProjects
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const provider = makeProvider();
    const repos = [];
    for await (const repo of provider.listRepos({ org: 'mygroup' })) {
      repos.push(repo);
    }
    expect(repos).toHaveLength(101);
    expect(repos[100].ref.repo).toBe('project-100');
    expect(mockGroups.allProjects).toHaveBeenCalledTimes(2);
  });

  it('getRepo returns mapped RepoDetail', async () => {
    mockProjects.show.mockResolvedValue({
      path_with_namespace: 'mygroup/project-a',
      path: 'project-a',
      namespace: { full_path: 'mygroup' },
      default_branch: 'main',
      visibility: 'private',
      web_url: 'https://gitlab.com/mygroup/project-a',
      topics: [],
      last_activity_at: '2025-01-01T00:00:00Z',
      description: 'GL project',
      archived: false,
    });

    const provider = makeProvider();
    const detail = await provider.getRepo({ owner: 'mygroup', repo: 'project-a' });
    expect(detail.description).toBe('GL project');
    expect(detail.private).toBe(true);
  });

  it('getFile with existing file returns decoded content', async () => {
    const content = Buffer.from('hello gitlab').toString('base64');
    mockRepoFiles.show.mockResolvedValue({
      file_path: 'README.md',
      content,
      blob_id: 'blob123',
    });

    const provider = makeProvider();
    const file = await provider.getFile({ owner: 'mygroup', repo: 'project-a' }, 'README.md');
    expect(file).not.toBeNull();
    expect(file!.content).toBe('hello gitlab');
    expect(file!.sha).toBe('blob123');
  });

  it('getFile with 404 returns null', async () => {
    mockRepoFiles.show.mockRejectedValue({ statusCode: 404, message: '404 Not Found' });

    const provider = makeProvider();
    const file = await provider.getFile({ owner: 'mygroup', repo: 'project-a' }, 'missing.txt');
    expect(file).toBeNull();
  });

  it('createOrUpdateFile creates new file (no sha)', async () => {
    mockRepoFiles.create.mockResolvedValue({ blob_id: 'new-blob' });

    const provider = makeProvider();
    const result = await provider.createOrUpdateFile(
      { owner: 'mygroup', repo: 'project-a' }, 'file.txt', 'content', 'add file', 'main',
    );
    expect(result.sha).toBe('new-blob');
    expect(mockRepoFiles.create).toHaveBeenCalled();
    expect(mockRepoFiles.edit).not.toHaveBeenCalled();
  });

  it('createOrUpdateFile updates existing file (with sha)', async () => {
    mockRepoFiles.edit.mockResolvedValue({ blob_id: 'updated-blob' });

    const provider = makeProvider();
    const result = await provider.createOrUpdateFile(
      { owner: 'mygroup', repo: 'project-a' }, 'file.txt', 'new content', 'update', 'main', 'old-sha',
    );
    expect(result.sha).toBe('updated-blob');
    expect(mockRepoFiles.edit).toHaveBeenCalled();
    expect(mockRepoFiles.create).not.toHaveBeenCalled();
  });

  it('createPullRequest returns PRResult (merge request)', async () => {
    mockMergeRequests.create.mockResolvedValue({
      iid: 7,
      web_url: 'https://gitlab.com/mygroup/project-a/-/merge_requests/7',
      state: 'opened',
    });

    const provider = makeProvider();
    const pr = await provider.createPullRequest(
      { owner: 'mygroup', repo: 'project-a' },
      { title: 'feat', body: 'desc', head: 'feature', base: 'main' },
    );
    expect(pr.number).toBe(7);
    expect(pr.state).toBe('opened');
  });

  it('ensureWebhook creates project hook when none exist', async () => {
    mockProjectHooks.all.mockResolvedValue([]);
    mockProjectHooks.add.mockResolvedValue({ id: 10 });

    const provider = makeProvider();
    const result = await provider.ensureWebhook(
      { owner: 'mygroup', repo: 'project-a' }, 'https://example.com/webhook', ['push'],
    );
    expect(result.id).toBe(10);
    expect(mockProjectHooks.add).toHaveBeenCalled();
  });

  it('verifyWebhookSignature valid → true', () => {
    const provider = makeProvider();
    expect(provider.verifyWebhookSignature('ignored', 'my-secret', 'my-secret')).toBe(true);
  });

  it('verifyWebhookSignature invalid → false', () => {
    const provider = makeProvider();
    expect(provider.verifyWebhookSignature('ignored', 'wrong-token', 'my-secret')).toBe(false);
  });
});
