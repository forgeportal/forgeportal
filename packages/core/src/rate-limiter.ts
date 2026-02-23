/**
 * In-memory sliding-window rate limiter.
 * Exposes getResetAt(key) for Retry-After header (seconds until window reset).
 */
export class RateLimiter {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  /**
   * Returns true if the key is under the limit and increments the count.
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.maxRequests) return false;
    entry.count++;
    return true;
  }

  /**
   * Returns the timestamp (ms) when the current window for this key resets.
   * Use with isAllowed: when isAllowed(key) is false, call getResetAt(key)
   * to compute Retry-After = Math.ceil((resetAt - Date.now()) / 1000).
   */
  getResetAt(key: string): number | undefined {
    const entry = this.windows.get(key);
    if (!entry || entry.resetAt <= Date.now()) return undefined;
    return entry.resetAt;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (entry.resetAt <= now) this.windows.delete(key);
    }
  }
}
