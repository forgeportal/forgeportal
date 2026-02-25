import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { z } from 'zod';
import { NotFoundError, ValidationError, scmOwnerRepoSchema, assertSafeRelativePath } from '@forgeportal/core';
import { requirePermission } from '@forgeportal/auth';
import { DocsRepository } from './docs.repository.js';
import { DocsService } from './docs.service.js';
import { parseRepoRef } from './scm-utils.js';
import { docsCSPHook } from './csp.middleware.js';

export interface DocsRoutesOptions {
  pool: Pool;
}

const bindingBodySchema = z.object({
  repoUrl: z.string().url(),
  docsPath: z.string().default('docs'),
}).refine(
  (data) => {
    const ref = parseRepoRef(data.repoUrl);
    if (!ref) return false;
    const ownerOk = scmOwnerRepoSchema.safeParse(ref.owner).success;
    const repoOk = scmOwnerRepoSchema.safeParse(ref.repo).success;
    return ownerOk && repoOk;
  },
  { message: 'owner and repo from repoUrl must match ^[a-zA-Z0-9._-]+$' },
);

export async function docsRoutes(
  app: FastifyInstance,
  opts: DocsRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const config = (app as unknown as { config: AppConfig }).config;
  const scmProviders = (app as unknown as { scmProviders: SCMProviders }).scmProviders;
  const repository = new DocsRepository(pool);
  const service = new DocsService(repository, scmProviders, config);

  app.addHook('onSend', docsCSPHook);

  app.setErrorHandler((error: Error, _request, reply) => {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: 'Not Found', message: error.message });
    }
    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: 'Bad Request', message: error.message });
    }
    throw error;
  });

  // GET /api/v1/docs/:entityId — list indexed pages for entity (AC: 1, 8)
  app.get(
    '/api/v1/docs/:entityId',
    { preHandler: [requirePermission('docs:read')] },
    async (request, reply) => {
      const { entityId } = request.params as { entityId: string };
      const result = await service.listPages(entityId);
      return reply.send({ data: result });
    },
  );

  // GET /api/v1/docs/:entityId/page?path=... — render Markdown page (AC: 2, 5, 7)
  app.get(
    '/api/v1/docs/:entityId/page',
    { preHandler: [requirePermission('docs:read')] },
    async (request, reply) => {
      const { entityId } = request.params as { entityId: string };
      const query = request.query as Record<string, string>;
      const filePath = query['path'];

      if (!filePath) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'path query parameter is required',
        });
      }

      const result = await service.renderPage(entityId, filePath);
      reply.header('Cache-Control', 'private, max-age=60');
      return reply.send({ data: result });
    },
  );

  // POST /api/v1/docs/:entityId/binding — create/update docs binding (AC: 6.1)
  app.post(
    '/api/v1/docs/:entityId/binding',
    { preHandler: [requirePermission('entity:update')] },
    async (request, reply) => {
      const { entityId } = request.params as { entityId: string };
      const parsed = bindingBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Validation failed',
        });
      }
      try {
        assertSafeRelativePath(parsed.data.docsPath);
      } catch (err) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: err instanceof Error ? err.message : 'Invalid docs path',
        });
      }
      const binding = await repository.upsertBinding({
        entityId,
        repoUrl: parsed.data.repoUrl,
        docsPath: parsed.data.docsPath,
      });
      return reply.status(201).send({ data: binding });
    },
  );

  // GET /api/v1/docs/:entityId/binding — get docs binding (AC: 6.2)
  app.get(
    '/api/v1/docs/:entityId/binding',
    { preHandler: [requirePermission('docs:read')] },
    async (request, reply) => {
      const { entityId } = request.params as { entityId: string };
      const binding = await repository.getBinding(entityId);
      if (!binding) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `No docs binding for entity ${entityId}`,
        });
      }
      return reply.send({ data: binding });
    },
  );
}
