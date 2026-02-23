import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@forgeportal/core';
import { requirePermission, requireOwnership } from '@forgeportal/auth';
import {
  createEntitySchema,
  updateEntitySchema,
  listEntitiesQuerySchema,
} from './entity.schema.js';
import { EntityRepository } from './entity.repository.js';
import { RelationRepository } from './relation.repository.js';
import { SourceRepository } from './source.repository.js';
import { CatalogService } from './catalog.service.js';

export interface CatalogRoutesOptions {
  pool: Pool;
}

export async function catalogRoutes(
  app: FastifyInstance,
  opts: CatalogRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const entityRepo = new EntityRepository(pool);
  const relationRepo = new RelationRepository(pool);
  const sourceRepo = new SourceRepository(pool);
  const service = new CatalogService(entityRepo, relationRepo, sourceRepo);

  async function getEntityOwner(
    request: FastifyRequest,
  ): Promise<string | null> {
    const params = request.params as { id?: string } | undefined;
    const id = params?.id;
    if (!id) return null;
    const entity = await entityRepo.findById(id);
    return entity?.owner_ref ?? null;
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof NotFoundError) {
      return reply
        .status(404)
        .send({ error: 'Not Found', message: error.message });
    }
    if (error instanceof ConflictError) {
      return reply
        .status(409)
        .send({ error: 'Conflict', message: error.message });
    }
    if (error instanceof ValidationError) {
      return reply
        .status(400)
        .send({ error: 'Bad Request', message: error.message });
    }
    if (error instanceof ZodError) {
      const first = error.errors[0];
      const message = first
        ? `${first.path.join('.')}: ${first.message}`
        : 'Validation failed';
      return reply
        .status(400)
        .send({ error: 'Bad Request', message });
    }
    throw error;
  });

  app.post(
    '/api/v1/catalog/entities',
    { preHandler: [requirePermission('entity:create')] },
    async (request, reply) => {
      const parsed = createEntitySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors[0]?.message ?? 'Validation failed',
        );
      }
      const result = await service.createEntity(parsed.data);
      return reply.status(201).send({ data: result });
    },
  );

  app.get(
    '/api/v1/catalog/entities',
    { preHandler: [requirePermission('entity:read')] },
    async (request, reply) => {
      const parsed = listEntitiesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors[0]?.message ?? 'Invalid query',
        );
      }
      const result = await service.listEntities(parsed.data);
      return reply.send({
        data: result.data,
        pagination: result.pagination,
      });
    },
  );

  app.get(
    '/api/v1/catalog/entities/:id',
    { preHandler: [requirePermission('entity:read')] },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const result = await service.getEntity(id);
      return reply.send({ data: result });
    },
  );

  app.put(
    '/api/v1/catalog/entities/:id',
    {
      preHandler: [
        requirePermission('entity:update'),
        requireOwnership((req) => getEntityOwner(req)),
      ],
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const parsed = updateEntitySchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors[0]?.message ?? 'Validation failed',
        );
      }
      const result = await service.updateEntity(id, parsed.data);
      return reply.send({ data: result });
    },
  );

  app.delete(
    '/api/v1/catalog/entities/:id',
    { preHandler: [requirePermission('entity:delete')] },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      await service.deleteEntity(id);
      return reply.status(204).send();
    },
  );
}
