import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { requirePermission } from '@forgeportal/auth';
import { ValidationError, type Logger } from '@forgeportal/core';
import { TemplateRunRepository } from './template-run.repository.js';
import { ActionRunRepository } from './action-run.repository.js';
import { TemplateOrchestrator } from './template-orchestrator.js';
import type { TemplateDefinition } from './template-parser.js';
import { buildStepContext, renderObjectDeep } from './template-engine.js';

export interface TemplateRoutesOptions {
  pool: Pool;
}

const runTemplateBodySchema = z.object({
  templateId: z.string().uuid(),
  inputs:     z.record(z.unknown()).default({}),
});

const templateRunsQuerySchema = z.object({
  status: z.enum(['running', 'success', 'failed', 'canceled']).optional(),
  limit:  z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function templateRoutes(
  app: FastifyInstance,
  opts: TemplateRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const templateRunRepo = new TemplateRunRepository(pool);
  const actionRunRepo   = new ActionRunRepository(pool);
  const orchestrator    = new TemplateOrchestrator(
    pool,
    templateRunRepo,
    actionRunRepo,
    app.log as Logger,
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error:   'ValidationError',
        message: 'Invalid request body',
        details: error.issues,
      });
    }
    if (error instanceof ValidationError) {
      return reply.code(400).send({
        error:   'ValidationError',
        message: error.message,
      });
    }
    reply.send(error);
  });

  // GET /api/v1/templates  (AC: 4)
  app.get(
    '/api/v1/templates',
    { preHandler: [requirePermission('template:read')] },
    async (_request, reply) => {
      const result = await pool.query<{
        id:      string;
        name:    string;
        version: string;
        schema:  TemplateDefinition;
      }>('SELECT id, name, version, schema FROM templates ORDER BY name');

      const templates = result.rows.map((row) => ({
        id:          row.id,
        name:        row.name,
        version:     row.version,
        title:       row.schema?.metadata?.title ?? row.name,
        description: row.schema?.metadata?.description ?? '',
        tags:        row.schema?.metadata?.tags ?? [],
        parameters:  row.schema?.spec?.parameters ?? [],
      }));

      return reply.send({ data: { templates } });
    },
  );

  // GET /api/v1/templates/:id  (AC: 4)
  app.get(
    '/api/v1/templates/:id',
    { preHandler: [requirePermission('template:read')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await pool.query<{
        id:      string;
        name:    string;
        version: string;
        schema:  TemplateDefinition;
      }>('SELECT id, name, version, schema FROM templates WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'NotFound', message: 'Template not found' });
      }
      const row = result.rows[0]!;
      return reply.send({
        data: {
          id:          row.id,
          name:        row.name,
          version:     row.version,
          title:       row.schema?.metadata?.title ?? row.name,
          description: row.schema?.metadata?.description ?? '',
          tags:        row.schema?.metadata?.tags ?? [],
          parameters:  row.schema?.spec?.parameters ?? [],
          steps:       row.schema?.spec?.steps ?? [],
          outputs:     row.schema?.spec?.outputs ?? {},
        },
      });
    },
  );

  // POST /api/v1/templates/run  (AC: 3)
  app.post(
    '/api/v1/templates/run',
    { preHandler: [requirePermission('template:run')] },
    async (request, reply) => {
      const parsed = runTemplateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error:   'ValidationError',
          message: 'Invalid request body',
          details: parsed.error.issues,
        });
      }
      const { templateId, inputs } = parsed.data;
      const requestedBy = request.user?.email ?? 'unknown';

      // Per-user rate limit: max 5 template runs per minute
      const recentCount = await actionRunRepo.countRecentByUser(requestedBy);
      if (recentCount >= 5) {
        return reply.code(429).send({
          error:       'RateLimited',
          message:     'Maximum 5 template runs per minute',
          retryAfter:  60,
        });
      }

      const templateRun = await orchestrator.startTemplateRun(templateId, requestedBy, inputs);

      return reply.code(202).send({
        data: { runId: templateRun.id, status: 'running' },
      });
    },
  );

  // GET /api/v1/templates/runs/:runId  (AC: 5)
  app.get(
    '/api/v1/templates/runs/:runId',
    { preHandler: [requirePermission('template:read')] },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const templateRun = await templateRunRepo.getById(runId);
      if (!templateRun) {
        return reply.code(404).send({ error: 'NotFound', message: 'Template run not found' });
      }

      // Fetch all action_runs for this template run
      const actionRunsResult = await pool.query<{
        id:          string;
        step_id:     string | null;
        action_id:   string | null;
        status:      string;
        output:      Record<string, unknown>;
        started_at:  Date | null;
        finished_at: Date | null;
      }>(
        `SELECT id, step_id, action_id, status, output, started_at, finished_at
         FROM action_runs
         WHERE template_run_id = $1
         ORDER BY created_at ASC`,
        [runId],
      );

      const steps = actionRunsResult.rows.map((row) => ({
        stepId:     row.step_id,
        actionId:   row.action_id,
        status:     row.status,
        outputs:    row.output ?? {},
        startedAt:  row.started_at,
        finishedAt: row.finished_at,
      }));

      // Resolve template-level outputs from the step_outputs context
      let resolvedOutputs: Record<string, unknown> = {};
      const templateRow = await pool.query<{ schema: { spec?: { outputs?: Record<string, string> } } }>(
        'SELECT schema FROM templates WHERE id = $1',
        [templateRun.template_id],
      );
      if (templateRow.rows.length > 0) {
        const outputsTemplate = templateRow.rows[0]!.schema?.spec?.outputs ?? {};
        const ctx = buildStepContext(templateRun.user_inputs, templateRun.step_outputs);
        resolvedOutputs = renderObjectDeep(outputsTemplate, ctx) as Record<string, unknown>;
      }

      return reply.send({
        data: {
          runId:       templateRun.id,
          templateId:  templateRun.template_id,
          requestedBy: templateRun.requested_by,
          status:      templateRun.status,
          currentStep: templateRun.current_step,
          steps,
          outputs:     resolvedOutputs,
          createdAt:   templateRun.created_at,
          finishedAt:  templateRun.finished_at,
        },
      });
    },
  );

  // POST /api/v1/templates/runs/:runId/cancel
  app.post(
    '/api/v1/templates/runs/:runId/cancel',
    { preHandler: [requirePermission('template:run')] },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };
      const templateRun = await templateRunRepo.getById(runId);
      if (!templateRun) {
        return reply.code(404).send({ error: 'NotFound', message: 'Template run not found' });
      }
      if (templateRun.status !== 'running') {
        return reply.code(409).send({
          error:   'Conflict',
          message: `Template run ${runId} cannot be canceled (status: ${templateRun.status})`,
        });
      }

      // Cancel all queued action_runs for this template run
      await pool.query(
        `UPDATE action_runs SET status = 'canceled', finished_at = now()
         WHERE template_run_id = $1 AND status = 'queued'`,
        [runId],
      );
      await templateRunRepo.markCanceled(runId);

      return reply.send({ data: { runId, status: 'canceled' } });
    },
  );

  // GET /api/v1/templates/runs  (AC: 5)
  app.get(
    '/api/v1/templates/runs',
    { preHandler: [requirePermission('template:read')] },
    async (request, reply) => {
      const parsed = templateRunsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'ValidationError', details: parsed.error.issues,
        });
      }
      const { status, limit, offset } = parsed.data;
      const result = await templateRunRepo.list({ status, limit, offset });
      return reply.send({ data: { runs: result.runs, total: result.total } });
    },
  );
}
