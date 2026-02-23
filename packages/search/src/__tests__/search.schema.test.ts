import { describe, it, expect } from 'vitest';
import { searchQuerySchema } from '../search.schema.js';

describe('searchQuerySchema', () => {
  it('valid query string → passes', () => {
    const result = searchQuerySchema.safeParse({ q: 'orders' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe('orders');
      expect(result.data.scope).toBe('all');
      expect(result.data.offset).toBe(0);
      expect(result.data.limit).toBe(20);
    }
  });

  it('missing q → fails', () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('blank q (empty string) → fails', () => {
    const result = searchQuerySchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toMatch(/empty/i);
    }
  });

  it('q too long (>200 chars) → fails', () => {
    const result = searchQuerySchema.safeParse({ q: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('valid scope=entities → passes', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', scope: 'entities' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scope).toBe('entities');
    }
  });

  it('invalid scope value → fails', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', scope: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('limit coercion from string → passes with number', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(typeof result.data.limit).toBe('number');
    }
  });

  it('limit > 50 → fails', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', limit: '51' });
    expect(result.success).toBe(false);
  });
});
