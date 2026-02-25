import type { Pool } from 'pg';
import type { SCMProvider } from '@forgeportal/scm';
import { EntityRepository } from '@forgeportal/catalog';
import type { EvaluationResult } from './types.js';
import { ScorecardRepository } from './scorecard.repository.js';
import { RuleEvaluator }        from './rule-evaluator.js';
import { ScmFileCache }         from './scm-file-cache.js';
import { calculateLevel }       from './level-calculator.js';

export interface EvaluateParams {
  scorecardId: string;
  entityId:    string;
  force?:      boolean;
}

export class ScorecardEngine {
  private readonly scorecardRepo: ScorecardRepository;
  private readonly entityRepo:    EntityRepository;
  private readonly ruleEvaluator: RuleEvaluator;

  constructor(
    pool:         Pool,
    scmProviders: Map<string, SCMProvider>,
    fileCache:    ScmFileCache = new ScmFileCache(),
  ) {
    this.scorecardRepo = new ScorecardRepository(pool);
    this.entityRepo    = new EntityRepository(pool);
    this.ruleEvaluator = new RuleEvaluator(scmProviders, fileCache);
  }

  async evaluate(params: EvaluateParams): Promise<EvaluationResult> {
    const { scorecardId, entityId, force = false } = params;

    // ── 1. Cache check (AC: 7) ────────────────────────────────────────────────
    if (!force) {
      const cached = await this.scorecardRepo.findLatestEvaluation(entityId, scorecardId);
      if (cached) {
        const ageSeconds = (Date.now() - cached.evaluated_at.getTime()) / 1000;
        if (ageSeconds < cached.cache_ttl_seconds) {
          return {
            evaluationId:    cached.id,
            scorecardId:     cached.scorecard_id,
            entityId:        cached.entity_id,
            status:          cached.status,
            level:           cached.level,
            results:         cached.results,
            cached:          true,
            evaluatedAt:     cached.evaluated_at,
            cacheTtlSeconds: cached.cache_ttl_seconds,
          };
        }
      }
    }

    // ── 2. Load scorecard definition ─────────────────────────────────────────
    const scorecard = await this.scorecardRepo.findById(scorecardId);
    if (!scorecard) {
      throw new Error(`Scorecard not found: ${scorecardId}`);
    }
    const definition = scorecard.definition;

    // ── 3. Load entity (AC: 8) ────────────────────────────────────────────────
    const entity = await this.entityRepo.findById(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    // ── 4. Evaluate all rules (AC: 1-4) ──────────────────────────────────────
    const results = await Promise.all(
      definition.rules.map((rule) => this.ruleEvaluator.evaluate(rule, entity)),
    );

    // ── 5. Determine evaluation status ───────────────────────────────────────
    // 'success' = all rules evaluated (pass or fail), no skipped rules
    // 'partial' = some rules returned null (SCM not configured) or errors
    // 'failed'  = evaluation threw unexpected errors
    const hasErrors = results.some((r) => r.error !== undefined);
    const hasNulls  = results.some((r) => r.pass === null && !r.error);
    const status = hasErrors ? 'failed' : hasNulls ? 'partial' : 'success';

    // ── 6. Calculate level (AC: 5) ────────────────────────────────────────────
    const level = calculateLevel(definition.levels, definition.rules, results);

    // ── 7. Persist (AC: 6) ────────────────────────────────────────────────────
    const stored = await this.scorecardRepo.insertEvaluation({
      scorecardId,
      entityId,
      status,
      level,
      results,
      cacheTtlSeconds: 3600,
    });

    return {
      evaluationId:    stored.id,
      scorecardId,
      entityId,
      status,
      level,
      results,
      cached:          false,
      evaluatedAt:     stored.evaluated_at,
      cacheTtlSeconds: 3600,
    };
  }
}
