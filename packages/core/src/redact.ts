const SECRET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /github_pat_[A-Za-z0-9_]{22,}/g, label: 'github-fine-grained' },
  { pattern: /ghp_[A-Za-z0-9_]{36,}/g, label: 'github-pat' },
  { pattern: /ghs_[A-Za-z0-9_]{36,}/g, label: 'github-app-token' },
  { pattern: /gho_[A-Za-z0-9_]{36,}/g, label: 'github-oauth' },
  { pattern: /glpat-[A-Za-z0-9_-]{20,}/g, label: 'gitlab-pat' },
  { pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/g, label: 'bearer' },
];

export function redactSecrets(value: string): string {
  let result = value;
  for (const { pattern, label } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(
      pattern,
      label === 'bearer' ? 'Bearer [REDACTED]' : `[REDACTED:${label}]`,
    );
  }
  return result;
}
