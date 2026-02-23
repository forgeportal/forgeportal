import { describe, it, expect } from 'vitest';
import {
  SCM_OWNER_REPO_REGEX,
  scmOwnerRepoSchema,
  assertSafeRelativePath,
  ValidationError,
} from '../validation.js';

describe('SCM_OWNER_REPO_REGEX', () => {
  it('allows valid owner/repo strings', () => {
    expect(SCM_OWNER_REPO_REGEX.test('org')).toBe(true);
    expect(SCM_OWNER_REPO_REGEX.test('my-repo')).toBe(true);
    expect(SCM_OWNER_REPO_REGEX.test('a.b_c-1')).toBe(true);
  });

  it('rejects slash and backslash', () => {
    expect(SCM_OWNER_REPO_REGEX.test('org/team')).toBe(false);
    expect(SCM_OWNER_REPO_REGEX.test('my\\repo')).toBe(false);
  });
});

describe('scmOwnerRepoSchema', () => {
  it('parses valid strings', () => {
    expect(scmOwnerRepoSchema.parse('owner')).toBe('owner');
    expect(scmOwnerRepoSchema.parse('repo-name')).toBe('repo-name');
  });

  it('rejects invalid strings', () => {
    expect(() => scmOwnerRepoSchema.parse('a/b')).toThrow();
    expect(() => scmOwnerRepoSchema.parse('')).toThrow();
  });
});

describe('assertSafeRelativePath', () => {
  it('accepts safe relative paths', () => {
    expect(() => assertSafeRelativePath('docs/index.md')).not.toThrow();
    expect(() => assertSafeRelativePath('a/b/c')).not.toThrow();
  });

  it('rejects path traversal', () => {
    expect(() => assertSafeRelativePath('..')).toThrow(ValidationError);
    expect(() => assertSafeRelativePath('docs/../../etc/passwd')).toThrow(ValidationError);
  });

  it('rejects absolute paths by default', () => {
    expect(() => assertSafeRelativePath('/etc/passwd')).toThrow(ValidationError);
  });

  it('accepts absolute when allowAbsolute', () => {
    expect(() => assertSafeRelativePath('/allowed', { allowAbsolute: true })).not.toThrow();
  });
});
