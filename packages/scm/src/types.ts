export interface OrgScope {
  org: string;
  topic?: string;
}

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface RepoSummary {
  ref: RepoRef;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
  topics: string[];
  updatedAt: string;
}

export interface RepoDetail extends RepoSummary {
  description: string | null;
  language: string | null;
  archived: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: 'utf-8';
}

export interface CreateRepoInput {
  org: string;
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

export interface CommitResult {
  sha: string;
  url: string;
}

export interface PRInput {
  title: string;
  body: string;
  head: string;
  base: string;
}

export interface PRResult {
  number: number;
  url: string;
  state: string;
}

export interface WebhookResult {
  id: number | string;
  url: string;
  active: boolean;
}
