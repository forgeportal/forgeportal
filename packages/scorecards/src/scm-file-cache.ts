interface CacheEntry {
  exists:    boolean;
  expiresAt: number;    // Date.now() + ttlMs
}

/**
 * Simple TTL-based in-memory cache for SCM file existence checks.
 * Eviction policy: oldest insertion when at capacity (Map insertion order).
 * This approximates LRU for a TTL-based cache at low scale.
 */
export class ScmFileCache {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs:      number = 60_000,
    private readonly maxEntries: number = 500,
  ) {}

  private key(owner: string, repo: string, path: string): string {
    return `${owner}/${repo}::${path}`;
  }

  get(owner: string, repo: string, path: string): boolean | undefined {
    const k     = this.key(owner, repo, path);
    const entry = this.cache.get(k);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(k);
      return undefined;
    }
    return entry.exists;
  }

  set(owner: string, repo: string, path: string, exists: boolean): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(this.key(owner, repo, path), {
      exists,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(owner: string, repo: string, path?: string): void {
    if (path) {
      this.cache.delete(this.key(owner, repo, path));
    } else {
      const prefix = `${owner}/${repo}::`;
      for (const k of this.cache.keys()) {
        if (k.startsWith(prefix)) this.cache.delete(k);
      }
    }
  }

  get size(): number { return this.cache.size; }
}
