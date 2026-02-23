import { NotFoundError } from '@forgeportal/core';
import type { EntityRow, EntityRelationRow, EntitySourceRow } from './entity.types.js';
import type { CreateEntityInput, ListEntitiesQuery, UpdateEntityInput } from './entity.schema.js';
import { EntityRepository } from './entity.repository.js';
import { RelationRepository } from './relation.repository.js';
import { SourceRepository } from './source.repository.js';

export interface EntityWithRelations {
  entity: EntityRow;
  relations: EntityRelationRow[];
  sources: EntitySourceRow[];
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: { offset: number; limit: number; total: number };
}

export class CatalogService {
  constructor(
    private readonly entityRepo: EntityRepository,
    private readonly relationRepo: RelationRepository,
    private readonly sourceRepo: SourceRepository,
  ) {}

  async createEntity(
    input: CreateEntityInput,
  ): Promise<EntityWithRelations> {
    const entity = await this.entityRepo.create(input);
    if (input.relations && input.relations.length > 0) {
      await this.relationRepo.setRelations(entity.id, input.relations);
    }
    const relations = await this.relationRepo.getRelationsForEntity(entity.id);
    const sources = await this.sourceRepo.getSourcesForEntity(entity.id);
    return {
      entity,
      relations: relations.map(({ id, from_entity_id, type, to_entity_id, created_at }) => ({
        id,
        from_entity_id,
        type,
        to_entity_id,
        created_at,
      })),
      sources,
    };
  }

  async getEntity(id: string): Promise<EntityWithRelations> {
    const entity = await this.entityRepo.findById(id);
    if (!entity) {
      throw new NotFoundError('Entity not found');
    }
    const relations = await this.relationRepo.getRelationsForEntity(id);
    const sources = await this.sourceRepo.getSourcesForEntity(id);
    return {
      entity,
      relations: relations.map(({ id: rid, from_entity_id, type, to_entity_id, created_at }) => ({
        id: rid,
        from_entity_id,
        type,
        to_entity_id,
        created_at,
      })),
      sources,
    };
  }

  async listEntities(
    query: ListEntitiesQuery,
  ): Promise<PaginatedResult<EntityRow>> {
    const { data, total } = await this.entityRepo.list(query);
    return {
      data,
      pagination: {
        offset: query.offset,
        limit: query.limit,
        total,
      },
    };
  }

  async updateEntity(
    id: string,
    input: UpdateEntityInput,
  ): Promise<EntityWithRelations> {
    const relationsInput = input.relations;
    const { relations: _r, ...rest } = input;
    const entity = await this.entityRepo.update(id, rest);
    if (relationsInput !== undefined) {
      await this.relationRepo.setRelations(entity.id, relationsInput);
    }
    const relations = await this.relationRepo.getRelationsForEntity(entity.id);
    const sources = await this.sourceRepo.getSourcesForEntity(entity.id);
    return {
      entity,
      relations: relations.map(({ id: rid, from_entity_id, type, to_entity_id, created_at }) => ({
        id: rid,
        from_entity_id,
        type,
        to_entity_id,
        created_at,
      })),
      sources,
    };
  }

  async deleteEntity(id: string): Promise<void> {
    const deleted = await this.entityRepo.delete(id);
    if (!deleted) {
      throw new NotFoundError('Entity not found');
    }
  }
}
