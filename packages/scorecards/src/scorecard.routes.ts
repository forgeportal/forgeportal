import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { enqueueJob } from '@forgeportal/db';
import { requirePermission } from '@forgeportal/auth';
import type { EntityRow } from '@forgeportal/catalog';
import { EntityRepository } from '@forgeportal/catalog';
import { ScorecardRepository } from './scorecard.repository.js';
import { resolveFixAction } from './fix-action-resolver.js';
import { FixOrchestrator, FixNotAvailableError } from './fix-orchestrator.js';
import type { ITemplateRunner } from './types.js';

export interface ScorecardRoutesOptions {
  pool:           Pool;
  templateRunner: ITemplateRunner;
}

export const scorecardRoutes: FastifyPluginAsync<ScorecardRoutesOptions> = async (app, opts) => {
  const { pool } = opts;
  // Construct once per plugin registration — shared across all routes
  const scorecardRepo  = new ScorecardRepository(pool);
  const entityRepo     = new EntityRepository(pool);
  const fixOrchestrator = new FixOrchestrator(pool, opts.templateRunner);

  /**
   * GET /api/v1/scorecards/dashboard
   * Aggregated scorecard stats: level distribution + worst-performing entities + per-scorecard breakdown.
   * Registered BEFORE :entityId routes to prevent "dashboard" matching as a param.
   */
  app.get('/api/v1/scorecards/dashboard', async (_request, reply) => {
    // Latest level per entity across all scorecards
    const levelStats = await pool.query<{ level: string | null; count: string }>(
      `SELECT
         COALESCE(ev.level, 'none') AS level,
         COUNT(DISTINCT e.id)       AS count
       FROM entities e
       LEFT JOIN LATERAL (
         SELECT level FROM scorecard_evaluations ev2
         WHERE ev2.entity_id = e.id
         ORDER BY evaluated_at DESC
         LIMIT 1
       ) ev ON true
       GROUP BY COALESCE(ev.level, 'none')`,
    );

    const totals: Record<string, number> = { Gold: 0, Silver: 0, Bronze: 0, none: 0 };
    let total = 0;
    for (const row of levelStats.rows) {
      const lvl = row.level ?? 'none';
      totals[lvl] = (totals[lvl] ?? 0) + Number(row.count);
      total += Number(row.count);
    }

    // Worst: entities with level = null or 'Bronze'
    const worst = await pool.query<{ id: string; name: string; kind: string; level: string | null }>(
      `SELECT e.id, e.name, e.kind,
              COALESCE(ev.level, null) AS level
       FROM entities e
       LEFT JOIN LATERAL (
         SELECT level FROM scorecard_evaluations ev2
         WHERE ev2.entity_id = e.id
         ORDER BY evaluated_at DESC LIMIT 1
       ) ev ON true
       WHERE COALESCE(ev.level, 'none') IN ('none', 'Bronze')
       ORDER BY e.name
       LIMIT 20`,
    );

    // Per scorecard breakdown
    const byScorecard = await pool.query<{
      scorecard_name:  string;
      applies_to_kind: string;
      level:           string | null;
      count:           string;
    }>(
      `SELECT sc.name AS scorecard_name, sc.applies_to_kind,
              COALESCE(ev.level, 'none') AS level,
              COUNT(DISTINCT ev.entity_id) AS count
       FROM scorecards sc
       LEFT JOIN scorecard_evaluations ev ON ev.scorecard_id = sc.id
       WHERE sc.enabled = true
       GROUP BY sc.name, sc.applies_to_kind, COALESCE(ev.level, 'none')
       ORDER BY sc.name, level`,
    );

    const byScorecardMap = new Map<string, { appliesToKind: string; levelBreakdown: Record<string, number> }>();
    for (const row of byScorecard.rows) {
      if (!byScorecardMap.has(row.scorecard_name)) {
        byScorecardMap.set(row.scorecard_name, { appliesToKind: row.applies_to_kind, levelBreakdown: {} });
      }
      byScorecardMap.get(row.scorecard_name)!.levelBreakdown[row.level ?? 'none'] = Number(row.count);
    }

    return reply.send({
      data: {
        totals: { ...totals, total },
        worst: worst.rows.map((r) => ({
          entityId:   r.id,
          entityName: r.name,
          entityKind: r.kind,
          level:      r.level,
        })),
        byScorecardName: Array.from(byScorecardMap.entries()).map(([name, v]) => ({
          scorecardName:  name,
          appliesToKind:  v.appliesToKind,
          levelBreakdown: v.levelBreakdown,
        })),
      },
    });
  });

  /**
   * GET /api/v1/scorecards
   * List all enabled scorecards. Optional ?kind=<kind> filter.
   * Accessible to all authenticated users (viewer+).
   */
  app.get<{
    Querystring: { kind?: string };
  }>(
    '/api/v1/scorecards',
    async (request, reply) => {
      const { kind } = request.query;
      const rows = kind
        ? await scorecardRepo.findByKind(kind)
        : await scorecardRepo.findAll();

      return reply.send({
        data: {
          scorecards: rows.map((sc) => ({
            id:            sc.id,
            name:          sc.name,
            version:       sc.version,
            appliesToKind: sc.applies_to_kind,
            levels:        sc.definition.levels,
            rules:         sc.definition.rules.map((r) => ({
              id:    r.id,
              title: r.title,
              level: r.level,
              type:  r.type,
              // params intentionally omitted (internal implementation detail)
            })),
            createdAt: sc.created_at,
          })),
        },
      });
    },
  );

  /**
   * GET /api/v1/scorecards/:entityId/latest
   * Latest evaluation per scorecard for a specific entity.
   * Returns all applicable scorecards, marking unevaluated ones as "pending".
   * Accessible to all authenticated users (viewer+).
   */
  app.get<{
    Params: { entityId: string };
  }>(
    '/api/v1/scorecards/:entityId/latest',
    async (request, reply) => {
      const { entityId } = request.params;

      // Verify entity exists (AC: 5)
      const entityRes = await pool.query<EntityRow>(
        'SELECT * FROM entities WHERE id = $1',
        [entityId],
      );
      if (entityRes.rows.length === 0) {
        return reply.status(404).send({
          error:   'Not Found',
          message: `Entity not found: ${entityId}`,
        });
      }
      const entity = entityRes.rows[0] as EntityRow;

      // Load all applicable scorecards (ensures pending entries for unevaluated ones — AC: 4)
      const applicableScorecards = await scorecardRepo.findByKind(entity.kind);

      // Load latest evaluations (one per scorecard via DISTINCT ON)
      const evaluations = await scorecardRepo.findLatestPerScorecardForEntity(entityId);
      const evalByScorecardId = new Map(evaluations.map((e) => [e.scorecard_id, e]));

      const result = applicableScorecards.map((sc) => {
        const eval_ = evalByScorecardId.get(sc.id);

        if (!eval_) {
          // No evaluation yet → status: pending (AC: 4)
          return {
            scorecardId:     sc.id,
            scorecardName:   sc.name,
            version:         sc.version,
            status:          'pending' as const,
            level:           null,
            evaluatedAt:     null,
            cacheTtlSeconds: null,
            rules:           sc.definition.rules.map((r) => ({
              ruleId:    r.id,
              ruleTitle: r.title,
              level:     r.level,
              pass:      null,
              details:   {},
              fixAction: null,
            })),
          };
        }

        return {
          scorecardId:     sc.id,
          scorecardName:   sc.name,
          version:         sc.version,
          status:          eval_.status,
          level:           eval_.level,
          evaluatedAt:     eval_.evaluated_at,
          cacheTtlSeconds: eval_.cache_ttl_seconds,
          rules: eval_.results.map((ruleResult) => {
            // Resolve fixAction only for failing rules (AC: 3)
            const ruleDef  = sc.definition.rules.find((r) => r.id === ruleResult.ruleId);
            const fixAction = (!ruleResult.pass && ruleDef)
              ? resolveFixAction(ruleDef, entity)
              : null;

            return {
              ruleId:    ruleResult.ruleId,
              ruleTitle: ruleResult.ruleTitle,
              level:     ruleResult.level,
              pass:      ruleResult.pass,
              details:   ruleResult.details,
              error:     ruleResult.error ?? null,
              fixAction,
            };
          }),
        };
      });

      return reply.send({
        data: {
          entityId,
          evaluations: result,
        },
      });
    },
  );

  /**
   * POST /api/v1/scorecards/:entityId/evaluate
   * Manually trigger scorecard evaluation for a specific entity.
   * Enqueues `scorecard-eval` jobs for all applicable scorecards.
   * Requires: platform-admin or template-admin role (scorecard:evaluate permission).
   */
  app.post<{
    Params: { entityId: string };
    Body:   { force?: boolean } | undefined;
  }>(
    '/api/v1/scorecards/:entityId/evaluate',
    {
      preHandler: requirePermission('scorecard:evaluate'),
    },
    async (request, reply) => {
      const { entityId } = request.params;
      const force = (request.body as { force?: boolean } | undefined)?.force ?? true;

      // Verify entity exists
      const entityRes = await pool.query<{ id: string; kind: string }>(
        'SELECT id, kind FROM entities WHERE id = $1',
        [entityId],
      );
      if (entityRes.rows.length === 0) {
        return reply.status(404).send({
          error:   'Not Found',
          message: `Entity not found: ${entityId}`,
        });
      }

      const entityKind = entityRes.rows[0]!.kind;

      // Find applicable enabled scorecards
      const scorecards = await pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM scorecards WHERE applies_to_kind = $1 AND enabled = true`,
        [entityKind],
      );

      if (scorecards.rows.length === 0) {
        return reply.send({ data: { jobsEnqueued: 0, scorecards: [] } });
      }

      const enqueued: Array<{ scorecardId: string; name: string; jobId: string }> = [];

      for (const sc of scorecards.rows) {
        const job = await enqueueJob(pool, 'scorecard-eval', {
          entityId,
          scorecardId: sc.id,
          force,
        });
        enqueued.push({ scorecardId: sc.id, name: sc.name, jobId: job.id });
      }

      return reply.status(202).send({
        data: {
          jobsEnqueued: enqueued.length,
          scorecards:   enqueued,
        },
      });
    },
  );

  /**
   * POST /api/v1/scorecards/:entityId/fix
   * Trigger an automated fix for a failing scorecard rule.
   * Creates a file on a fix branch and opens a PR via the forge-fix-file template.
   * Requires: action:run permission (developer role or above).
   */
  app.post<{
    Params: { entityId: string };
    Body:   { scorecardId: string; ruleId: string };
  }>(
    '/api/v1/scorecards/:entityId/fix',
    {
      preHandler: requirePermission('action:run'),
    },
    async (request, reply) => {
      const { entityId }                 = request.params;
      const { scorecardId, ruleId }      = request.body;
      const requestedBy                  = request.user?.email ?? 'unknown';

      // 1. Load entity
      const entity = await entityRepo.findById(entityId);
      if (!entity) {
        return reply.status(404).send({ error: 'Not Found', message: `Entity not found: ${entityId}` });
      }

      // 2. Load scorecard definition
      const scorecard = await scorecardRepo.findById(scorecardId);
      if (!scorecard) {
        return reply.status(404).send({ error: 'Not Found', message: `Scorecard not found: ${scorecardId}` });
      }

      // 3. Find the rule
      const rule = scorecard.definition.rules.find((r) => r.id === ruleId);
      if (!rule) {
        return reply.status(404).send({ error: 'Not Found', message: `Rule not found: ${ruleId}` });
      }

      // 4. Check rule is not already passing (AC: 8)
      const latestEval = await scorecardRepo.findLatestEvaluation(entityId, scorecardId);
      if (latestEval) {
        const ruleResult = latestEval.results.find((r) => r.ruleId === ruleId);
        if (ruleResult?.pass === true) {
          return reply.status(422).send({
            error:   'Unprocessable Entity',
            message: `Rule "${rule.title}" is already passing — no fix needed.`,
          });
        }
      }
      // No evaluation yet → allow fix attempt (rule assumed failing)

      // 5. Start fix (AC: 7 — throws FixNotAvailableError if no fix available)
      try {
        const result = await fixOrchestrator.startFix(entity, rule, requestedBy);
        return reply.status(202).send({
          data: {
            templateRunId: result.templateRunId,
            statusUrl:     result.statusUrl,
            branch:        result.branch,
            prTitle:       result.prTitle,
          },
        });
      } catch (err) {
        if (err instanceof FixNotAvailableError) {
          return reply.status(422).send({
            error:   'Unprocessable Entity',
            message: err.message,
          });
        }
        throw err;
      }
    },
  );
};
