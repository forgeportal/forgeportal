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

export interface SCMProvider {
  readonly name: 'github' | 'gitlab';

  listRepos(scope: OrgScope): AsyncIterable<RepoSummary>;
  getRepo(ref: RepoRef): Promise<RepoDetail>;
  getFile(
    ref: RepoRef,
    path: string,
    gitRef?: string,
  ): Promise<FileContent | null>;
  createRepo(input: CreateRepoInput): Promise<RepoDetail>;
  createOrUpdateFile(
    ref: RepoRef,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string,
  ): Promise<CommitResult>;
  createPullRequest(ref: RepoRef, input: PRInput): Promise<PRResult>;
  /**
   * List open pull requests / merge requests for a given head → base.
   * Returns empty array if none found.
   */
  listPullRequests(ref: RepoRef, head: string, base: string): Promise<PRResult[]>;
  ensureWebhook(
    ref: RepoRef,
    callbackUrl: string,
    events: string[],
  ): Promise<WebhookResult>;
  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): boolean;

  /**
   * List all files under a given directory path in the repo.
   * Returns file paths relative to repo root (e.g. "docs/index.md").
   * Only returns .md and .mdx files.
   */
  listFiles(ref: RepoRef, dirPath: string): Promise<string[]>;
}
