import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requirePermission } from '@forgeportal/auth';
import { enqueueJob, getLatestJob, listJobsByType } from '@forgeportal/db';
import { scmOwnerRepoSchema } from '@forgeportal/core';

export interface ScanRoutesOptions {
  pool: Pool;
}

export async function scanRoutes(
  app: FastifyInstance,
  opts: ScanRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const guard = requirePermission('admin:settings');

  const scanBodySchema = z.object({ org: scmOwnerRepoSchema.optional() });

  app.post(
    '/api/v1/admin/scan',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = scanBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid org format; must match ^[a-zA-Z0-9._-]+$',
        });
      }
      const payload: Record<string, unknown> = {};
      if (parsed.data.org) payload['org'] = parsed.data.org;

      const job = await enqueueJob(pool, 'repo-scan', payload);
      return reply.status(202).send({
        jobId: job.id,
        status: 'queued',
      });
    },
  );

  app.get(
    '/api/v1/admin/scan/status',
    { preHandler: [guard] },
    async (_request, _reply) => {
      const job = await getLatestJob(pool, 'repo-scan');
      return { job: job ?? null };
    },
  );

  app.get(
    '/api/v1/admin/scan/jobs',
    { preHandler: [guard] },
    async (request, _reply) => {
      const limit = Math.min(
        Math.max(1, Number((request.query as { limit?: string }).limit) || 20),
        100,
      );
      const jobs = await listJobsByType(pool, 'repo-scan', limit);
      return { data: jobs };
    },
  );
}
