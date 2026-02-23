import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { ZodError } from 'zod';
import { requirePermission } from '@forgeportal/auth';
import { RateLimiter } from '@forgeportal/core';
import { searchQuerySchema } from './search.schema.js';
import { search } from './search.service.js';

export interface SearchRoutesOptions {
  pool: Pool;
}

export async function searchRoutes(
  app: FastifyInstance,
  opts: SearchRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const searchLimiter = new RateLimiter(60, 60_000);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const first = error.errors[0];
      const message = first
        ? `${first.path.join('.') || first.path}: ${first.message}`
        : 'Validation failed';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
    throw error;
  });

  app.get(
    '/api/v1/search',
    { preHandler: [requirePermission('entity:read')] },
    async (request, reply) => {
      const key =
        request.user?.email ?? request.user?.sub ?? request.ip ?? 'unknown';
      if (!searchLimiter.isAllowed(key)) {
        const resetAt = searchLimiter.getResetAt(key);
        const retryAfterSec =
          resetAt != null
            ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            : 60;
        return reply
          .header('Retry-After', String(retryAfterSec))
          .status(429)
          .send({
            error: 'Too Many Requests',
            message: 'Search rate limit exceeded: 60 req/min',
          });
      }

      const parsed = searchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        const message = first
          ? `${first.path.join('.') || 'q'}: ${first.message}`
          : 'Validation failed';
        return reply.status(400).send({ error: 'Bad Request', message });
      }

      const result = await search(pool, parsed.data);

      reply.header('Cache-Control', 'private, max-age=10');
      return reply.send(result);
    },
  );
}
