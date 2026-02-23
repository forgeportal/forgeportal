import crypto from 'node:crypto';
import { Gitlab } from '@gitbeaker/rest';
import type { SCMProvider } from './provider.js';
import type {
  OrgScope,
  RepoRef,
  RepoSummary,
  RepoDetail,
  FileContent,
  CreateRepoInput,
  CommitResult,
  PRInput,
  PRResult,
  WebhookResult,
} from './types.js';

export interface GitLabProviderOptions {
  token: string;
  baseUrl?: string;
}

export class GitLabProvider implements SCMProvider {
  readonly name = 'gitlab' as const;
  private readonly api: InstanceType<typeof Gitlab>;

  constructor(opts: GitLabProviderOptions) {
    this.api = new Gitlab({
      token: opts.token,
      host: opts.baseUrl ?? 'https://gitlab.com',
    });
  }

  async *listRepos(scope: OrgScope): AsyncIterable<RepoSummary> {
    let page = 1;
    const perPage = 100;

    while (true) {
      const options: Record<string, unknown> = { perPage, page, simple: true };
      if (scope.topic) options['topic'] = scope.topic;

      const result = await this.api.Groups.allProjects(
        scope.org,
        options as unknown as Parameters<typeof this.api.Groups.allProjects>[1],
      );

      const projects = Array.isArray(result)
        ? result
        : (result as { data?: unknown[] }).data ?? [];

      if (projects.length === 0) break;

      for (const project of projects) {
        yield mapProjectSummary(project);
      }

      if (projects.length < perPage) break;
      page++;
    }
  }

  async getRepo(ref: RepoRef): Promise<RepoDetail> {
    const projectId = encodeProject(ref);
    const project = await this.api.Projects.show(projectId);
    return mapProjectDetail(project);
  }

  async getFile(
    ref: RepoRef,
    path: string,
    gitRef?: string,
  ): Promise<FileContent | null> {
    try {
      const projectId = encodeProject(ref);
      const file = await this.api.RepositoryFiles.show(
        projectId,
        path,
        gitRef ?? 'main',
      );
      const content = Buffer.from(
        file.content as string,
        'base64',
      ).toString('utf-8');
      return {
        path: file.file_path as string,
        content,
        sha: file.blob_id as string,
        encoding: 'utf-8',
      };
    } catch (err: unknown) {
      if (isGitLabNotFound(err)) return null;
      throw err;
    }
  }

  async createRepo(input: CreateRepoInput): Promise<RepoDetail> {
    const group = await this.api.Groups.show(input.org);
    const project = await this.api.Projects.create({
      name: input.name,
      namespaceId: group.id,
      description: input.description,
      visibility: input.private === false ? 'public' : 'private',
      initializeWithReadme: input.autoInit ?? false,
    } as Parameters<typeof this.api.Projects.create>[0]);
    return mapProjectDetail(project);
  }

  async createOrUpdateFile(
    ref: RepoRef,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string,
  ): Promise<CommitResult> {
    const projectId = encodeProject(ref);
    if (sha) {
      const result = await this.api.RepositoryFiles.edit(
        projectId,
        path,
        branch,
        content,
        message,
      );
      return {
        sha: (result as Record<string, unknown>)['blob_id'] as string ?? '',
        url: '',
      };
    }
    const result = await this.api.RepositoryFiles.create(
      projectId,
      path,
      branch,
      content,
      message,
    );
    return {
      sha: (result as Record<string, unknown>)['blob_id'] as string ?? '',
      url: '',
    };
  }

  async createPullRequest(ref: RepoRef, input: PRInput): Promise<PRResult> {
    const projectId = encodeProject(ref);
    const mr = await this.api.MergeRequests.create(
      projectId,
      input.head,
      input.base,
      input.title,
      { description: input.body },
    );
    return {
      number: mr.iid,
      url: mr.web_url as string,
      state: mr.state as string,
    };
  }

  async listPullRequests(ref: RepoRef, head: string, base: string): Promise<PRResult[]> {
    const projectId = encodeProject(ref);
    const mrs = await this.api.MergeRequests.all({
      projectId,
      sourceBranch: head,
      targetBranch: base,
      state: 'opened',
      perPage: 10,
    } as Parameters<typeof this.api.MergeRequests.all>[0]);
    return (mrs as Array<{ iid: number; web_url: string; state: string }>).map((mr) => ({
      number: mr.iid,
      url: mr.web_url,
      state: mr.state,
    }));
  }

  async ensureWebhook(
    ref: RepoRef,
    callbackUrl: string,
    events: string[],
  ): Promise<WebhookResult> {
    const projectId = encodeProject(ref);
    const hooks = await this.api.ProjectHooks.all(projectId);

    const existing = hooks.find(
      (h) => (h as Record<string, unknown>)['url'] === callbackUrl,
    );

    if (existing) {
      return {
        id: existing.id,
        url: callbackUrl,
        active: true,
      };
    }

    const eventFlags: Record<string, boolean> = {};
    for (const event of events) {
      eventFlags[`${event}_events`] = true;
    }

    const created = await this.api.ProjectHooks.add(
      projectId,
      callbackUrl,
      eventFlags,
    );
    return { id: created.id, url: callbackUrl, active: true };
  }

  verifyWebhookSignature(
    _payload: Buffer | string,
    headerToken: string,
    secret: string,
  ): boolean {
    if (headerToken.length !== secret.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(headerToken),
      Buffer.from(secret),
    );
  }

  async listFiles(ref: RepoRef, dirPath: string): Promise<string[]> {
    const files: string[] = [];
    let page = 1;
    const projectPath = encodeProject(ref);

    while (true) {
      let items: Array<{ type: string; name: string; path: string }>;
      try {
        items = (await this.api.Repositories.allRepositoryTrees(
          projectPath,
          {
            path: dirPath,
            recursive: true,
            perPage: 100,
            page,
          } as Parameters<typeof this.api.Repositories.allRepositoryTrees>[1],
        )) as Array<{ type: string; name: string; path: string }>;
      } catch (err) {
        if (isGitLabNotFound(err)) return [];
        throw err;
      }

      if (!Array.isArray(items) || items.length === 0) break;

      const mdFiles = items
        .filter((item) => item.type === 'blob')
        .filter(
          (item) => item.name.endsWith('.md') || item.name.endsWith('.mdx'),
        )
        .map((item) => item.path);

      files.push(...mdFiles);
      if (items.length < 100) break;
      page++;
    }
    return files;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProjectSummary(project: any): RepoSummary {
  const pathParts = (project.path_with_namespace ?? '').split('/');
  const owner = pathParts.slice(0, -1).join('/') || project.namespace?.full_path || '';
  const repo = project.path || project.name;
  return {
    ref: { owner, repo },
    fullName: project.path_with_namespace ?? `${owner}/${repo}`,
    defaultBranch: project.default_branch ?? 'main',
    private: project.visibility === 'private',
    url: project.web_url ?? '',
    topics: project.topics ?? project.tag_list ?? [],
    updatedAt: project.last_activity_at ?? new Date().toISOString(),
  };
}

function mapProjectDetail(project: any): RepoDetail {
  return {
    ...mapProjectSummary(project),
    description: project.description ?? null,
    language: null,
    archived: project.archived ?? false,
  };
}

function encodeProject(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

function isGitLabNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const status = (err as Record<string, unknown>)['statusCode'] ??
    (err as Record<string, unknown>)['status'] ??
    (err as Record<string, unknown>)['cause'];
  if (status === 404) return true;
  const msg = (err as Record<string, unknown>)['message'];
  return typeof msg === 'string' && msg.includes('404');
}
