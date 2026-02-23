import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { GitHubProvider } from '../github.js';
import { GitLabProvider } from '../gitlab.js';

import { vi } from 'vitest';

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    rest: { repos: {}, pulls: {} },
    paginate: { iterator: vi.fn() },
  })),
}));

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(),
}));

vi.mock('@gitbeaker/rest', () => ({
  Gitlab: vi.fn().mockImplementation(() => ({})),
}));

describe('webhook signature verification', () => {
  describe('GitHub (HMAC-SHA256)', () => {
    const provider = new GitHubProvider({ token: 'ghp_test' });

    it('valid payload → true', () => {
      const secret = 'webhook-secret-123';
      const payload = '{"ref":"refs/heads/main"}';
      const sig =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(provider.verifyWebhookSignature(payload, sig, secret)).toBe(true);
    });

    it('tampered payload → false', () => {
      const secret = 'webhook-secret-123';
      const payload = '{"ref":"refs/heads/main"}';
      const sig =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(
        provider.verifyWebhookSignature(payload + 'tampered', sig, secret),
      ).toBe(false);
    });

    it('empty signature → false', () => {
      expect(
        provider.verifyWebhookSignature('payload', '', 'secret'),
      ).toBe(false);
    });
  });

  describe('GitLab (token header comparison)', () => {
    const provider = new GitLabProvider({ token: 'glpat-test' });

    it('matching token → true', () => {
      expect(
        provider.verifyWebhookSignature('payload-ignored', 'my-secret', 'my-secret'),
      ).toBe(true);
    });

    it('mismatched token → false', () => {
      expect(
        provider.verifyWebhookSignature('payload-ignored', 'wrong', 'my-secret'),
      ).toBe(false);
    });
  });
});
