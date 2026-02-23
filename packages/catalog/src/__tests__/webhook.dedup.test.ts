import { describe, it, expect } from 'vitest';
import { EventDedup } from '../webhook.dedup.js';

describe('EventDedup', () => {
  it('first event ID is not duplicate', () => {
    const dedup = new EventDedup(10);
    expect(dedup.isDuplicate('evt-1')).toBe(false);
  });

  it('same event ID second time is duplicate', () => {
    const dedup = new EventDedup(10);
    dedup.isDuplicate('evt-1');
    expect(dedup.isDuplicate('evt-1')).toBe(true);
  });

  it('after maxSize events, oldest is evicted', () => {
    const dedup = new EventDedup(3);
    dedup.isDuplicate('a');
    dedup.isDuplicate('b');
    dedup.isDuplicate('c');
    dedup.isDuplicate('d');
    expect(dedup.isDuplicate('a')).toBe(false);
    expect(dedup.isDuplicate('d')).toBe(true);
  });

  it('empty event ID is never duplicate', () => {
    const dedup = new EventDedup(10);
    expect(dedup.isDuplicate('')).toBe(false);
    expect(dedup.isDuplicate('')).toBe(false);
  });
});
