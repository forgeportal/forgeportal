import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimiter } from '@forgeportal/core';

describe('RateLimiter', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('under limit → allowed', () => {
    const rl = new RateLimiter(5, 60_000);
    expect(rl.isAllowed('ip1')).toBe(true);
    expect(rl.isAllowed('ip1')).toBe(true);
  });

  it('exactly at limit → not allowed', () => {
    const rl = new RateLimiter(3, 60_000);
    rl.isAllowed('ip1');
    rl.isAllowed('ip1');
    rl.isAllowed('ip1');
    expect(rl.isAllowed('ip1')).toBe(false);
  });

  it('after window expires → allowed again', () => {
    const rl = new RateLimiter(2, 100);
    rl.isAllowed('ip1');
    rl.isAllowed('ip1');
    expect(rl.isAllowed('ip1')).toBe(false);

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);
    expect(rl.isAllowed('ip1')).toBe(true);
  });

  it('different IPs have separate limits', () => {
    const rl = new RateLimiter(1, 60_000);
    rl.isAllowed('ip1');
    expect(rl.isAllowed('ip1')).toBe(false);
    expect(rl.isAllowed('ip2')).toBe(true);
  });

  it('cleanup removes expired entries', () => {
    const rl = new RateLimiter(10, 100);
    rl.isAllowed('ip1');

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);
    rl.cleanup();
    expect(rl.isAllowed('ip1')).toBe(true);
  });

  it('getResetAt returns window reset when at limit', () => {
    const rl = new RateLimiter(2, 60_000);
    rl.isAllowed('k');
    rl.isAllowed('k');
    expect(rl.isAllowed('k')).toBe(false);
    const resetAt = rl.getResetAt('k');
    expect(resetAt).toBeDefined();
    expect(resetAt! > Date.now()).toBe(true);
  });
});
