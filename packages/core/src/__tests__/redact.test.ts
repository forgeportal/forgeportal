import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../redact.js';

describe('redactSecrets', () => {
  it('redacts GitHub PAT (ghp_)', () => {
    const token = 'ghp_' + 'a'.repeat(36);
    expect(redactSecrets(`token=${token}`)).toBe('token=[REDACTED:github-pat]');
  });

  it('redacts GitHub app token (ghs_)', () => {
    const token = 'ghs_' + 'B'.repeat(36);
    expect(redactSecrets(token)).toBe('[REDACTED:github-app-token]');
  });

  it('redacts GitHub OAuth token (gho_)', () => {
    const token = 'gho_' + 'C'.repeat(36);
    expect(redactSecrets(token)).toBe('[REDACTED:github-oauth]');
  });

  it('redacts GitHub fine-grained PAT (github_pat_)', () => {
    const token = 'github_pat_' + 'D'.repeat(22);
    expect(redactSecrets(token)).toBe('[REDACTED:github-fine-grained]');
  });

  it('redacts GitLab PAT (glpat-)', () => {
    const token = 'glpat-' + 'e'.repeat(20);
    expect(redactSecrets(token)).toBe('[REDACTED:gitlab-pat]');
  });

  it('redacts Bearer token', () => {
    const token = 'Bearer ' + 'f'.repeat(30);
    expect(redactSecrets(`Authorization: ${token}`)).toBe(
      'Authorization: Bearer [REDACTED]',
    );
  });

  it('leaves string without secrets unchanged', () => {
    const safe = 'just a normal log message with no secrets';
    expect(redactSecrets(safe)).toBe(safe);
  });

  it('redacts multiple secrets in one string', () => {
    const pat = 'ghp_' + 'a'.repeat(36);
    const glpat = 'glpat-' + 'b'.repeat(20);
    const input = `first=${pat} second=${glpat}`;
    expect(redactSecrets(input)).toBe(
      'first=[REDACTED:github-pat] second=[REDACTED:gitlab-pat]',
    );
  });

  it('handles repeated calls without regex state leakage', () => {
    const token = 'ghp_' + 'x'.repeat(36);
    expect(redactSecrets(token)).toBe('[REDACTED:github-pat]');
    expect(redactSecrets(token)).toBe('[REDACTED:github-pat]');
    expect(redactSecrets(token)).toBe('[REDACTED:github-pat]');
  });
});
