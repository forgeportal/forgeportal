import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { requirePermission } from '@forgeportal/auth';
import { redactSecrets, RateLimiter } from '@forgeportal/core';
import { ActionRunRepository } from './action-run.repository.js';
import { ActionRunLogRepository } from './action-run-log.repository.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { redactActionInput } from './input-redactor.js';

export interface ActionRoutesOptions {
  pool: Pool;
}

const runActionBodySchema = z.object({
  input: z.record(z.unknown()).default({}),
  entityId: z.string().uuid().optional(),
  idempotencyKey: z.string().max(255).optional(),
});

const auditLogsQuerySchema = z.object({
  targetId: z.string().optional(),
  actor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function actionRoutes(
  app: FastifyInstance,
  opts: ActionRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const runRepo = new ActionRunRepository(pool);
  const logRepo = new ActionRunLogRepository(pool);
  const auditRepo = new AuditLogRepository(pool);
  const actionRunLimiter = new RateLimiter(10, 60_000);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'ValidationError',
        message: 'Invalid request body',
        details: error.issues,
      });
    }
    reply.send(error);
  });

  // POST /api/v1/actions/:actionId/run
  app.post(
    '/api/v1/actions/:actionId/run',
    { preHandler: [requirePermission('action:run')] },
    async (request, reply) => {
      const { actionId } = request.params as { actionId: string };
      const requestedBy = request.user?.email ?? request.user?.sub ?? request.ip ?? 'unknown';

      // Per-user rate limit (10 runs/minute) — checked in handler for stable key
      const runLimitKey = requestedBy;
      if (!actionRunLimiter.isAllowed(runLimitKey)) {
        const resetAt = actionRunLimiter.getResetAt(runLimitKey);
        const retryAfterSec =
          resetAt != null
            ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            : 60;
        return reply
          .header('Retry-After', String(retryAfterSec))
          .code(429)
          .send({
            error: 'RateLimited',
            message: 'Maximum 10 action runs per minute',
            retryAfter: retryAfterSec,
          });
      }

      const parsed = runActionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'ValidationError',
          message: 'Invalid request body',
          details: parsed.error.issues,
        });
      }
      const body = parsed.data;

      // Idempotency check (AC: 9)
      if (body.idempotencyKey) {
        const existing = await runRepo.findByIdempotencyKey(body.idempotencyKey);
        if (existing) {
          return reply.code(200).send({
            data: {
              runId: existing.id,
              cached: true,
              status: existing.status,
              output: existing.output,
            },
          });
        }
      }

      // Fetch action row including definition for redaction (AC: 2)
      const actionRow = await pool.query<{
        id: string;
        name: string;
        version: string;
        definition: Record<string, unknown>;
      }>('SELECT id, name, version, definition FROM actions WHERE id = $1', [
        actionId,
      ]);
      if (actionRow.rows.length === 0) {
        return reply.code(404).send({
          error: 'NotFound',
          message: `Action not found: ${actionId}`,
        });
      }
      const action = actionRow.rows[0];

      // Double-pass redaction: schema-driven then pattern-driven (AC: 2)
      const schemaRedacted = redactActionInput(body.input, action.definition);
      const doubleRedacted = JSON.parse(
        redactSecrets(JSON.stringify(schemaRedacted)),
      ) as Record<string, unknown>;

      const run = await runRepo.create({
        action_id: actionId,
        entity_id: body.entityId,
        requested_by: requestedBy,
        input: doubleRedacted,
        idempotency_key: body.idempotencyKey,
      });

      return reply.code(202).send({ data: { runId: run.id, status: 'queued' } });
    },
  );

  // GET /api/v1/actions/runs/:runId  (AC: 3, 5)
  app.get(
    '/api/v1/actions/runs/:runId',
    { preHandler: [requirePermission('action:read')] },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const run = await runRepo.getById(runId);
      if (!run) {
        return reply.code(404).send({ error: 'NotFound', message: 'Run not found' });
      }
      const links = Array.isArray(
        (run.output as Record<string, unknown> | null)?.['links'],
      )
        ? ((run.output as Record<string, unknown>)['links'] as unknown[])
        : [];
      return reply.send({
        data: {
          runId: run.id,
          actionId: run.action_id,
          entityId: run.entity_id,
          requestedBy: run.requested_by,
          status: run.status,
          input: run.input,
          output: run.output,
          links,
          retryCount: run.retry_count,
          maxRetries: run.max_retries,
          startedAt: run.started_at,
          finishedAt: run.finished_at,
          createdAt: run.created_at,
        },
      });
    },
  );

  // GET /api/v1/actions/runs/:runId/logs  (AC: 4)
  app.get(
    '/api/v1/actions/runs/:runId/logs',
    { preHandler: [requirePermission('action:read')] },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const run = await runRepo.getById(runId);
      if (!run) {
        return reply.code(404).send({ error: 'NotFound', message: 'Run not found' });
      }
      const logs = await logRepo.getLogsForRun(runId);
      return reply.send({ data: { logs } });
    },
  );

  // GET /api/v1/actions/runs
  app.get(
    '/api/v1/actions/runs',
    { preHandler: [requirePermission('action:read')] },
    async (request, reply) => {
      const query = request.query as {
        entityId?: string;
        requestedBy?: string;
        limit?: string;
      };
      const limit = Math.min(parseInt(query.limit ?? '20', 10), 100);

      let runs;
      if (query.entityId) {
        runs = await runRepo.listByEntity(query.entityId, limit);
      } else if (query.requestedBy) {
        runs = await runRepo.listByUser(query.requestedBy, limit);
      } else {
        const requestedBy = request.user?.email ?? 'unknown';
        runs = await runRepo.listByUser(requestedBy, limit);
      }

      return reply.send({ data: { runs, total: runs.length } });
    },
  );

  // GET /api/v1/action-runs  — paginated listing with filters
  app.get(
    '/api/v1/action-runs',
    { preHandler: [requirePermission('action:read')] },
    async (request, reply) => {
      const q = request.query as {
        status?: string;
        entityId?: string;
        templateId?: string;
        limit?: string;
        offset?: string;
      };
      const limit  = Math.min(parseInt(q.limit  ?? '20', 10), 200);
      const offset = Math.max(parseInt(q.offset ?? '0',  10), 0);
      const filter = { status: q.status, entityId: q.entityId, templateId: q.templateId };
      const [runs, total] = await Promise.all([
        runRepo.list({ ...filter, limit, offset }),
        runRepo.count(filter),
      ]);
      const serialized = runs.map((r) => ({
        id:            r.id,
        actionId:      r.action_id,
        stepId:        r.step_id,
        templateRunId: r.template_run_id,
        requestedBy:   r.requested_by,
        status:        r.status,
        retryCount:    r.retry_count,
        startedAt:     r.started_at,
        finishedAt:    r.finished_at,
        createdAt:     r.created_at,
      }));
      return reply.send({
        data:       serialized,
        pagination: { limit, offset, total },
      });
    },
  );

  // GET /api/v1/action-runs/:runId  — full run detail
  app.get(
    '/api/v1/action-runs/:runId',
    { preHandler: [requirePermission('action:read')] },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const run = await runRepo.getById(runId);
      if (!run) return reply.code(404).send({ error: 'Not Found' });
      return reply.send({ data: run });
    },
  );

  // POST /api/v1/actions/runs/:runId/cancel
  app.post(
    '/api/v1/actions/runs/:runId/cancel',
    { preHandler: [requirePermission('action:run')] },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const run = await runRepo.getById(runId);
      if (!run) {
        return reply.code(404).send({ error: 'NotFound', message: 'Run not found' });
      }
      const canceled = await runRepo.cancel(runId);
      if (!canceled) {
        return reply.code(409).send({
          error: 'Conflict',
          message: `Run ${runId} cannot be canceled (status: ${run.status})`,
        });
      }
      return reply.send({ data: { runId, status: 'canceled' } });
    },
  );

  // GET /api/v1/audit-logs  (AC: 6)
  app.get(
    '/api/v1/audit-logs',
    { preHandler: [requirePermission('audit:read')] },
    async (request, reply) => {
      const parsed = auditLogsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'ValidationError',
          details: parsed.error.issues,
        });
      }
      const { targetId, actor, limit, offset } = parsed.data;
      const result = await auditRepo.list({ targetId, actor, limit, offset });
      return reply.send({
        data: {
          entries: result.entries,
          total: result.total,
          limit,
          offset,
        },
      });
    },
  );

  // GET /api/v1/audit-logs/:id  (AC: 6)
  app.get(
    '/api/v1/audit-logs/:id',
    { preHandler: [requirePermission('audit:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const entry = await auditRepo.getById(id);
      if (!entry) {
        return reply.code(404).send({ error: 'NotFound', message: 'Audit log entry not found' });
      }
      return reply.send({ data: entry });
    },
  );
}
