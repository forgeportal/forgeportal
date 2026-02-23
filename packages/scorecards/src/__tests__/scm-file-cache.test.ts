import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScmFileCache } from '../scm-file-cache.js';

describe('ScmFileCache', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('set and get within TTL returns cached value', () => {
    const cache = new ScmFileCache(60_000);
    cache.set('myorg', 'myrepo', 'README.md', true);
    expect(cache.get('myorg', 'myrepo', 'README.md')).toBe(true);
  });

  it('returns undefined after TTL expires', () => {
    const cache = new ScmFileCache(1_000);
    cache.set('myorg', 'myrepo', 'README.md', true);
    vi.advanceTimersByTime(1_001);
    expect(cache.get('myorg', 'myrepo', 'README.md')).toBeUndefined();
  });

  it('evicts oldest entry when maxEntries reached', () => {
    const cache = new ScmFileCache(60_000, 2);
    cache.set('org', 'repo', 'a.md', true);
    cache.set('org', 'repo', 'b.md', true);
    cache.set('org', 'repo', 'c.md', true); // triggers eviction of 'a.md'
    expect(cache.get('org', 'repo', 'a.md')).toBeUndefined();
    expect(cache.get('org', 'repo', 'b.md')).toBe(true);
    expect(cache.get('org', 'repo', 'c.md')).toBe(true);
  });

  it('invalidate by path removes specific entry', () => {
    const cache = new ScmFileCache(60_000);
    cache.set('org', 'repo', 'a.md', true);
    cache.set('org', 'repo', 'b.md', true);
    cache.invalidate('org', 'repo', 'a.md');
    expect(cache.get('org', 'repo', 'a.md')).toBeUndefined();
    expect(cache.get('org', 'repo', 'b.md')).toBe(true);
  });

  it('invalidate by repo removes all entries for that repo', () => {
    const cache = new ScmFileCache(60_000);
    cache.set('org', 'repo1', 'a.md', true);
    cache.set('org', 'repo1', 'b.md', false);
    cache.set('org', 'repo2', 'c.md', true);
    cache.invalidate('org', 'repo1');
    expect(cache.get('org', 'repo1', 'a.md')).toBeUndefined();
    expect(cache.get('org', 'repo1', 'b.md')).toBeUndefined();
    expect(cache.get('org', 'repo2', 'c.md')).toBe(true);
  });
});
