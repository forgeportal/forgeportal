import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from '../catalog.service.js';
import { NotFoundError } from '@forgeportal/core';
import type { EntityRow, EntityRelationRow, EntitySourceRow } from '../entity.types.js';

function makeEntityRow(overrides: Partial<EntityRow> = {}): EntityRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    kind: 'service',
    namespace: 'default',
    name: 'test-svc',
    owner_ref: null,
    lifecycle: null,
    tags: [],
    links: [],
    scm: {},
    spec: {},
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function mockEntityRepo() {
  return {
    create: vi.fn().mockResolvedValue(makeEntityRow()),
    findById: vi.fn().mockResolvedValue(makeEntityRow()),
    list: vi.fn().mockResolvedValue({ data: [makeEntityRow()], total: 1 }),
    update: vi.fn().mockResolvedValue(makeEntityRow()),
    delete: vi.fn().mockResolvedValue(true),
  };
}

function mockRelationRepo() {
  return {
    setRelations: vi.fn().mockResolvedValue(undefined),
    getRelationsForEntity: vi.fn().mockResolvedValue([]),
    getRelatedEntities: vi.fn().mockResolvedValue([]),
  };
}

function mockSourceRepo() {
  return {
    getSourcesForEntity: vi.fn().mockResolvedValue([] as EntitySourceRow[]),
    upsertSource: vi.fn(),
  };
}

describe('CatalogService', () => {
  let entityRepo: ReturnType<typeof mockEntityRepo>;
  let relationRepo: ReturnType<typeof mockRelationRepo>;
  let sourceRepo: ReturnType<typeof mockSourceRepo>;
  let service: CatalogService;

  beforeEach(() => {
    entityRepo = mockEntityRepo();
    relationRepo = mockRelationRepo();
    sourceRepo = mockSourceRepo();
    service = new CatalogService(
      entityRepo as never,
      relationRepo as never,
      sourceRepo as never,
    );
  });

  it('createEntity calls repo and sets relations', async () => {
    const result = await service.createEntity({
      kind: 'service',
      name: 'orders',
      namespace: 'default',
      tags: [],
      links: [],
      scm: {},
      spec: {},
      relations: [{ type: 'dependsOn', target_entity_id: 'e2' }],
    });
    expect(entityRepo.create).toHaveBeenCalled();
    expect(relationRepo.setRelations).toHaveBeenCalled();
    expect(result.entity.kind).toBe('service');
    expect(result.relations).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it('getEntity returns entity with relations and sources', async () => {
    const result = await service.getEntity('e1');
    expect(entityRepo.findById).toHaveBeenCalledWith('e1');
    expect(result.entity.kind).toBe('service');
  });

  it('getEntity throws NotFoundError when not found', async () => {
    entityRepo.findById.mockResolvedValue(null);
    await expect(service.getEntity('missing')).rejects.toThrow(NotFoundError);
  });

  it('updateEntity does partial update', async () => {
    const result = await service.updateEntity('e1', { lifecycle: 'production' });
    expect(entityRepo.update).toHaveBeenCalledWith('e1', {
      lifecycle: 'production',
    });
    expect(result.entity).toBeDefined();
  });

  it('deleteEntity calls repo and throws NotFoundError if not found', async () => {
    await service.deleteEntity('e1');
    expect(entityRepo.delete).toHaveBeenCalledWith('e1');

    entityRepo.delete.mockResolvedValue(false);
    await expect(service.deleteEntity('missing')).rejects.toThrow(NotFoundError);
  });
});
