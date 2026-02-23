export class EventDedup {
  private readonly seen = new Set<string>();
  private readonly ring: string[];
  private idx = 0;

  constructor(private readonly maxSize = 1000) {
    this.ring = new Array<string>(maxSize).fill('');
  }

  isDuplicate(eventId: string): boolean {
    if (!eventId) return false;
    if (this.seen.has(eventId)) return true;
    const evicted = this.ring[this.idx];
    if (evicted) this.seen.delete(evicted);
    this.ring[this.idx] = eventId;
    this.seen.add(eventId);
    this.idx = (this.idx + 1) % this.maxSize;
    return false;
  }
}
