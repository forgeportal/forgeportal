import { ActionError } from '../../types.js';

interface HttpError {
  status?: number;
  message?: string;
}

export function mapScmError(err: unknown, operation: string): ActionError {
  const e = err as HttpError;
  const status = e.status ?? 0;

  if (status === 401 || status === 403) {
    return new ActionError('AUTH_ERROR', `SCM auth error on ${operation}: ${e.message ?? status}`);
  }
  if (status === 404) {
    return new ActionError('NOT_FOUND', `Resource not found during ${operation}: ${e.message ?? ''}`);
  }
  if (status === 409 || status === 422) {
    return new ActionError('CONFLICT', `Conflict during ${operation}: ${e.message ?? status}`);
  }
  if (status === 429) {
    return new ActionError('RATE_LIMITED', `SCM rate limit hit during ${operation}`);
  }
  if (status >= 500) {
    return new ActionError('REMOTE_ERROR', `SCM API error ${status} during ${operation}: ${e.message ?? ''}`);
  }
  return new ActionError('INTERNAL_ERROR', `Unexpected error during ${operation}: ${String(err)}`);
}

export function buildRepoUrl(provider: 'github' | 'gitlab', owner: string, repo: string): string {
  if (provider === 'github') return `https://github.com/${owner}/${repo}`;
  return `https://gitlab.com/${owner}/${repo}`;
}
