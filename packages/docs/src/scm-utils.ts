/**
 * Shared SCM utility helpers used by both DocsService and DocsIndexer.
 */

export function parseRepoRef(
  repoUrl: string,
): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .split('/');
    if (parts.length < 2) return null;
    const repo = parts.pop()!;
    const owner = parts.join('/');
    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Detect SCM provider from a repo URL.
 * Checks github.com first, then falls back to any configured GitLab host or defaults to 'gitlab'.
 */
export function detectProvider(
  repoUrl: string,
  gitlabBaseUrl?: string,
): 'github' | 'gitlab' | null {
  if (repoUrl.includes('github.com')) return 'github';
  try {
    const host = gitlabBaseUrl
      ? new URL(gitlabBaseUrl).hostname
      : 'gitlab.com';
    if (repoUrl.includes(host)) return 'gitlab';
  } catch {
    // ignore bad config
  }
  return null;
}
