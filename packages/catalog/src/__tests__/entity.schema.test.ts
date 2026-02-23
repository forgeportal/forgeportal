import { describe, it, expect } from 'vitest';
import {
  createEntitySchema,
  updateEntitySchema,
  listEntitiesQuerySchema,
} from '../entity.schema.js';

describe('createEntitySchema', () => {
  it('valid entity passes', () => {
    const result = createEntitySchema.safeParse({
      kind: 'service',
      name: 'orders-api',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.namespace).toBe('default');
      expect(result.data.tags).toEqual([]);
      expect(result.data.relations).toEqual([]);
    }
  });

  it('missing name fails', () => {
    const result = createEntitySchema.safeParse({ kind: 'service' });
    expect(result.success).toBe(false);
  });

  it('invalid kind fails', () => {
    const result = createEntitySchema.safeParse({
      kind: 'not-a-kind',
      name: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('empty relations defaults to []', () => {
    const result = createEntitySchema.safeParse({
      kind: 'library',
      name: 'utils',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relations).toEqual([]);
    }
  });

  it('valid relation passes', () => {
    const result = createEntitySchema.safeParse({
      kind: 'service',
      name: 'orders',
      relations: [
        {
          type: 'dependsOn',
          target_entity_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('invalid relation type fails', () => {
    const result = createEntitySchema.safeParse({
      kind: 'service',
      name: 'orders',
      relations: [{ type: 'invalidRelation', target_entity_id: 'not-uuid' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateEntitySchema', () => {
  it('rejects kind field', () => {
    const result = updateEntitySchema.safeParse({ kind: 'library' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('kind' in result.data).toBe(false);
    }
  });

  it('allows partial update with only tags', () => {
    const result = updateEntitySchema.safeParse({
      tags: ['backend', 'go'],
    });
    expect(result.success).toBe(true);
  });
});

describe('listEntitiesQuerySchema', () => {
  it('defaults offset=0, limit=20', () => {
    const result = listEntitiesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offset).toBe(0);
      expect(result.data.limit).toBe(20);
    }
  });

  it('coerces string offset/limit to numbers', () => {
    const result = listEntitiesQuerySchema.safeParse({
      offset: '5',
      limit: '50',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offset).toBe(5);
      expect(result.data.limit).toBe(50);
    }
  });

  it('rejects limit > 100', () => {
    const result = listEntitiesQuerySchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });
});
