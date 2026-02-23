import { z } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Regex for SCM owner or repo name (single segment: no slash).
 * Allows letters, digits, dot, underscore, hyphen.
 */
export const SCM_OWNER_REPO_REGEX = /^[a-zA-Z0-9._-]+$/;

export const scmOwnerRepoSchema = z
  .string()
  .min(1)
  .regex(SCM_OWNER_REPO_REGEX, 'owner/repo must match ^[a-zA-Z0-9._-]+$');

/**
 * Asserts that a path is a safe relative path: no "..", no leading slash (absolute),
 * no problematic segments. Use for user-supplied file paths before passing to SCM or filesystem.
 * @param path - Path to validate (will be normalized with forward slashes).
 * @param options - allowAbsolute: if true, leading slash is allowed (still no "..").
 * @throws ValidationError if the path is unsafe.
 */
export function assertSafeRelativePath(
  path: string,
  options?: { allowAbsolute?: boolean },
): void {
  const normalized = path.replace(/\\/g, '/').trim();
  if (normalized.includes('..')) {
    throw new ValidationError('Path traversal not allowed');
  }
  if (!options?.allowAbsolute && normalized.startsWith('/')) {
    throw new ValidationError('Absolute paths are not allowed');
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((s) => s === '.' || s === '..')) {
    throw new ValidationError('Path traversal not allowed');
  }
}
