import crypto from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
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

export interface GitHubProviderOptions {
  appId?: string;
  privateKey?: string;
  installationId?: number;
  token?: string;
  baseUrl?: string;
}

export class GitHubProvider implements SCMProvider {
  readonly name = 'github' as const;
  private octokit: Octokit;
  private readonly opts: GitHubProviderOptions;
  private installationResolved = false;

  constructor(opts: GitHubProviderOptions) {
    this.opts = opts;
    if (opts.appId && opts.privateKey) {
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: opts.appId,
          privateKey: opts.privateKey,
          installationId: opts.installationId,
        },
        baseUrl: opts.baseUrl,
      });
      this.installationResolved = !!opts.installationId;
    } else if (opts.token) {
      this.octokit = new Octokit({
        auth: opts.token,
        baseUrl: opts.baseUrl,
      });
      this.installationResolved = true;
    } else {
      throw new Error(
        'GitHubProvider requires either appId+privateKey or token',
      );
    }
  }

  async resolveInstallation(org?: string): Promise<void> {
    if (this.installationResolved) return;
    if (!this.opts.appId || !this.opts.privateKey) return;

    const { data: installations } =
      await this.octokit.rest.apps.listInstallations();

    const installation = org
      ? installations.find(
          (i) =>
            i.account &&
            'login' in i.account &&
            i.account.login === org,
        )
      : installations[0];

    if (installation) {
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.opts.appId,
          privateKey: this.opts.privateKey,
          installationId: installation.id,
        },
        baseUrl: this.opts.baseUrl,
      });
    }
    this.installationResolved = true;
  }

  async *listRepos(scope: OrgScope): AsyncIterable<RepoSummary> {
    await this.resolveInstallation(scope.org);
    const iterator = this.octokit.paginate.iterator(
      this.octokit.rest.repos.listForOrg,
      { org: scope.org, per_page: 100 },
    );

    for await (const { data: repos } of iterator) {
      for (const repo of repos) {
        const summary = mapRepoSummary(repo);
        if (scope.topic && !summary.topics.includes(scope.topic)) continue;
        yield summary;
      }
    }
  }

  async getRepo(ref: RepoRef): Promise<RepoDetail> {
    await this.resolveInstallation(ref.owner);
    const { data } = await this.octokit.rest.repos.get({
      owner: ref.owner,
      repo: ref.repo,
    });
    return mapRepoDetail(data);
  }

  async getFile(
    ref: RepoRef,
    path: string,
    gitRef?: string,
  ): Promise<FileContent | null> {
    await this.resolveInstallation(ref.owner);
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: ref.owner,
        repo: ref.repo,
        path,
        ref: gitRef,
      });

      if (Array.isArray(data) || data.type !== 'file') return null;

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        path: data.path,
        content,
        sha: data.sha,
        encoding: 'utf-8',
      };
    } catch (err: unknown) {
      if (isHttpError(err) && err.status === 404) return null;
      throw err;
    }
  }

  async createRepo(input: CreateRepoInput): Promise<RepoDetail> {
    await this.resolveInstallation(input.org);
    const { data } = await this.octokit.rest.repos.createInOrg({
      org: input.org,
      name: input.name,
      description: input.description,
      private: input.private ?? true,
      auto_init: input.autoInit ?? false,
    });
    return mapRepoDetail(data);
  }

  async createOrUpdateFile(
    ref: RepoRef,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string,
  ): Promise<CommitResult> {
    await this.resolveInstallation(ref.owner);
    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: ref.owner,
      repo: ref.repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      sha,
    });
    return {
      sha: data.commit.sha ?? '',
      url: data.commit.html_url ?? '',
    };
  }

  async createPullRequest(ref: RepoRef, input: PRInput): Promise<PRResult> {
    await this.resolveInstallation(ref.owner);
    const { data } = await this.octokit.rest.pulls.create({
      owner: ref.owner,
      repo: ref.repo,
      title: input.title,
      body: input.body,
      head: input.head,
      base: input.base,
    });
    return {
      number: data.number,
      url: data.html_url,
      state: data.state,
    };
  }

  async listPullRequests(ref: RepoRef, head: string, base: string): Promise<PRResult[]> {
    await this.resolveInstallation(ref.owner);
    const { data } = await this.octokit.rest.pulls.list({
      owner: ref.owner,
      repo: ref.repo,
      head: `${ref.owner}:${head}`,
      base,
      state: 'open',
      per_page: 10,
    });
    return data.map((pr) => ({ number: pr.number, url: pr.html_url, state: pr.state }));
  }

  async ensureWebhook(
    ref: RepoRef,
    callbackUrl: string,
    events: string[],
  ): Promise<WebhookResult> {
    await this.resolveInstallation(ref.owner);
    const { data: hooks } = await this.octokit.rest.repos.listWebhooks({
      owner: ref.owner,
      repo: ref.repo,
    });

    const existing = hooks.find((h) => h.config.url === callbackUrl);

    if (existing) {
      if (!existing.active) {
        await this.octokit.rest.repos.updateWebhook({
          owner: ref.owner,
          repo: ref.repo,
          hook_id: existing.id,
          active: true,
        });
      }
      return { id: existing.id, url: callbackUrl, active: true };
    }

    const { data: created } = await this.octokit.rest.repos.createWebhook({
      owner: ref.owner,
      repo: ref.repo,
      config: { url: callbackUrl, content_type: 'json' },
      events,
      active: true,
    });
    return { id: created.id, url: callbackUrl, active: true };
  }

  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): boolean {
    const buf = typeof payload === 'string' ? Buffer.from(payload) : payload;
    const expected =
      'sha256=' + crypto.createHmac('sha256', secret).update(buf).digest('hex');
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  }

  async listFiles(ref: RepoRef, dirPath: string): Promise<string[]> {
    try {
      const { data: tree } = await this.octokit.request(
        'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
        {
          owner: ref.owner,
          repo: ref.repo,
          tree_sha: 'HEAD',
          recursive: '1',
        },
      );
      if ((tree as { truncated?: boolean }).truncated) {
        // Log warning but continue with partial results
      }
      return (
        (tree.tree as Array<{ type?: string; path?: string }>)
          .filter((item) => item.type === 'blob' && !!item.path)
          .filter(
            (item) =>
              item.path!.startsWith(dirPath) &&
              (item.path!.endsWith('.md') || item.path!.endsWith('.mdx')),
          )
          .map((item) => item.path!)
      );
    } catch (err) {
      if (isHttpError(err) && err.status === 404) return [];
      throw err;
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRepoSummary(repo: any): RepoSummary {
  return {
    ref: { owner: repo.owner?.login ?? '', repo: repo.name },
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    private: repo.private,
    url: repo.html_url,
    topics: repo.topics ?? [],
    updatedAt: repo.updated_at ?? new Date().toISOString(),
  };
}

function mapRepoDetail(repo: any): RepoDetail {
  return {
    ...mapRepoSummary(repo),
    description: repo.description ?? null,
    language: repo.language ?? null,
    archived: repo.archived ?? false,
  };
}

function isHttpError(err: unknown): err is { status: number } {
  return typeof err === 'object' && err !== null && 'status' in err;
}
