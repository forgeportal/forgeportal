// ─── GitHub API response shapes (minimal subset) ────────────────────────────

export interface GHRepo {
  full_name:        string;
  description:      string | null;
  default_branch:   string;
  language:         string | null;
  stargazers_count: number;
  forks_count:      number;
  open_issues_count: number;
  html_url:         string;
  private:          boolean;
}

export interface GHPRLabel { name: string; color: string }

export interface GHPR {
  number:     number;
  title:      string;
  html_url:   string;
  state:      string;
  created_at: string;
  updated_at: string;
  user:       { login: string; avatar_url: string };
  labels:     GHPRLabel[];
  draft:      boolean;
  head:       { ref: string };
  base:       { ref: string };
}

export interface GHCommitAuthor {
  name:  string;
  email: string;
  date:  string;
}

export interface GHCommit {
  sha:       string;
  html_url:  string;
  commit: {
    message:   string;
    author:    GHCommitAuthor;
    committer: GHCommitAuthor;
  };
  author:    { login: string; avatar_url: string } | null;
}

export interface GHContributor {
  login:        string;
  avatar_url:   string;
  html_url:     string;
  contributions: number;
}

export interface GHWorkflowRun {
  id:           number;
  name:         string | null;
  display_title: string;
  status:       string | null;
  conclusion:   string | null;
  html_url:     string;
  created_at:   string;
  head_branch:  string | null;
}

// ─── Aggregated overview ─────────────────────────────────────────────────────

export interface GitHubOverview {
  repo:           GHRepo;
  openPRCount:    number;
  latestCommit:   GHCommit | null;
}

// ─── Plugin config ────────────────────────────────────────────────────────────

export interface GitHubInsightsConfig {
  token:          string;
  cacheTTLSeconds: number;
}

// ─── Cache entry ─────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}
