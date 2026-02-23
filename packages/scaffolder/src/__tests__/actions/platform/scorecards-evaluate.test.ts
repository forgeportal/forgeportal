import { describe, it, expect, vi } from 'vitest';
import { ScorecardsEvaluateHandler } from '../../../actions/platform/scorecards-evaluate.handler.js';
import type { ActionContext } from '../../../types.js';
import type { EvaluationResult } from '@forgeportal/scorecards';

const ENTITY_ID    = '00000000-0000-0000-0000-000000000001';
const SCORECARD_ID = '00000000-0000-0000-0000-000000000002';
const EVAL_ID      = '00000000-0000-0000-0000-000000000003';

function makeCtx(input: Record<string, unknown> = {}): ActionContext {
  return {
    runId: 'run-1',
    entityId: null,
    requestedBy: 'user',
    input,
    acquireRepoLock: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

const baseInput = { entityId: ENTITY_ID, scorecardId: SCORECARD_ID };

function makeResult(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    evaluationId:    EVAL_ID,
    scorecardId:     SCORECARD_ID,
    entityId:        ENTITY_ID,
    status:          'success',
    level:           'bronze',
    results:         [],
    cached:          false,
    evaluatedAt:     new Date(),
    cacheTtlSeconds: 3600,
    ...overrides,
  };
}

function makeEngine(evaluate: (...args: unknown[]) => unknown) {
  return { evaluate } as never;
}

describe('ScorecardsEvaluateHandler', () => {
  it('cache within TTL, force=false → cached result returned, no INSERT', async () => {
    const engine = makeEngine(vi.fn().mockResolvedValue(makeResult({ cached: true })));
    const handler = new ScorecardsEvaluateHandler(engine);
    const result = await handler.execute(makeCtx({ ...baseInput, force: false }));

    expect(result.status).toBe('success');
    expect(result.outputs.cached).toBe(true);
    expect(result.outputs.evaluationId).toBe(EVAL_ID);
  });

  it('cache expired, force=false → fresh evaluation run', async () => {
    const engine = makeEngine(vi.fn().mockResolvedValue(makeResult({ cached: false })));
    const handler = new ScorecardsEvaluateHandler(engine);
    const result = await handler.execute(makeCtx({ ...baseInput, force: false }));

    expect(result.outputs.cached).toBe(false);
  });

  it('force=true with valid cache → fresh evaluation run regardless', async () => {
    const engine = makeEngine(vi.fn().mockResolvedValue(makeResult({ cached: false })));
    const handler = new ScorecardsEvaluateHandler(engine);
    const result = await handler.execute(makeCtx({ ...baseInput, force: true }));

    expect(result.outputs.cached).toBe(false);
  });

  it('scorecard not found → NOT_FOUND', async () => {
    const engine = makeEngine(vi.fn().mockRejectedValue(new Error(`Scorecard not found: ${SCORECARD_ID}`)));
    const handler = new ScorecardsEvaluateHandler(engine);
    await expect(handler.execute(makeCtx(baseInput))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('entity not found → NOT_FOUND', async () => {
    const engine = makeEngine(vi.fn().mockRejectedValue(new Error(`Entity not found: ${ENTITY_ID}`)));
    const handler = new ScorecardsEvaluateHandler(engine);
    await expect(handler.execute(makeCtx(baseInput))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('stub evaluator — hasOwner rule passes when owner_ref set', async () => {
    const results = [
      { ruleId: 'r1', ruleTitle: 'Has owner', level: 'bronze', pass: true, details: {} },
      { ruleId: 'r2', ruleTitle: 'Has lifecycle', level: 'bronze', pass: true, details: {} },
    ];
    const engine = makeEngine(vi.fn().mockResolvedValue(makeResult({ results })));
    const handler = new ScorecardsEvaluateHandler(engine);
    const result = await handler.execute(makeCtx(baseInput));

    expect(result.outputs.cached).toBe(false);
    const ruleResults = result.outputs.results as Array<{ ruleId: string; pass: boolean }>;
    expect(ruleResults.find((r) => r.ruleId === 'r1')?.pass).toBe(true);
  });

  it('stub evaluator — all bronze rules pass → level=bronze', async () => {
    const engine = makeEngine(vi.fn().mockResolvedValue(makeResult({ status: 'success', level: 'bronze' })));
    const handler = new ScorecardsEvaluateHandler(engine);
    const result = await handler.execute(makeCtx(baseInput));

    expect(result.outputs.level).toBe('bronze');
    expect(result.outputs.status).toBe('success');
  });
});
