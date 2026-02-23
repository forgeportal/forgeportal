import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { ScorecardEngine } from '@forgeportal/scorecards';

const scorecardsEvaluateInputSchema = z.object({
  entityId:    z.string().uuid(),
  scorecardId: z.string().uuid(),
  force:       z.boolean().default(false),
});

export class ScorecardsEvaluateHandler implements ActionHandler {
  readonly actionId = 'scorecards.evaluate@v1';

  constructor(private readonly engine: ScorecardEngine) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = scorecardsEvaluateInputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { entityId, scorecardId, force } = parsed.data;

    try {
      const result = await this.engine.evaluate({ scorecardId, entityId, force });

      if (result.cached) {
        await ctx.log('info', `Returning cached evaluation (age within ${result.cacheTtlSeconds}s TTL)`);
      } else {
        await ctx.log('info', `Evaluation complete — status: ${result.status}, level: ${result.level ?? 'none'}`);
      }

      return {
        status:  'success',
        outputs: {
          cached:       result.cached,
          evaluationId: result.evaluationId,
          status:       result.status,
          level:        result.level ?? null,
          results:      result.results,
        },
        links:    [],
        warnings: result.status === 'partial'
          ? [`${result.results.filter((r) => r.error).length} rule(s) errored — check SCM connectivity`]
          : [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('Not found')) {
        throw new ActionError('NOT_FOUND', msg);
      }
      throw new ActionError('INTERNAL_ERROR', msg);
    }
  }
}
