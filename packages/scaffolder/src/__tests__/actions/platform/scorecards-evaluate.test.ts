import { describe, it, expect, vi } from 'vitest';
import { ScorecardsEvaluateHandler } from '../../../actions/platform/scorecards-evaluate.handler.js';
import type { ActionContext } from '../../../types.js';

const ENTITY_ID = '00000000-0000-0000-0000-000000000001';
const SCORECARD_ID = '00000000-0000-0000-0000-000000000002';
const EVAL_ID = '00000000-0000-0000-0000-000000000003';

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

const baseEntity = {
  id: ENTITY_ID,
  kind: 'service',
  namespace: 'default',
  name: 'my-service',
  owner_ref: 'team:payments',
  lifecycle: 'production',
  tags: ['golang'],
  links: [{ title: 'Runbook', url: 'https://runbook.example.com' }],
  scm: { url: 'https://github.com/acme/my-service' },
  spec: {},
  created_at: new Date(),
  updated_at: new Date(),
};

const baseScorecard = {
  id: SCORECARD_ID,
  definition: {
    rules: [
      { id: 'r1', level: 'bronze', check: 'hasOwner' },
      { id: 'r2', level: 'bronze', check: 'hasLifecycle' },
    ],
  },
};

function makePool(opts: {
  cachedEval?: { age: number; ttl: number } | null;
  scorecardFound?: boolean;
  entityFound?: boolean;
}) {
  const now = Date.now();

  return {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('scorecard_evaluations') && sql.includes('SELECT')) {
        if (opts.cachedEval) {
          return Promise.resolve({
            rows: [{
              id: EVAL_ID,
              status: 'success',
              level: 'bronze',
              results: [],
              evaluated_at: new Date(now - opts.cachedEval.age * 1000),
              cache_ttl_seconds: opts.cachedEval.ttl,
            }],
          });
        }
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('FROM scorecards')) {
        if (opts.scorecardFound === false) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [baseScorecard] });
      }
      if (sql.includes('FROM entities')) {
        if (opts.entityFound === false) return Promise.resolve({ rows: [] });
        return Promise.resolve({ rows: [baseEntity] });
      }
      if (sql.includes('INSERT INTO scorecard_evaluations')) {
        return Promise.resolve({ rows: [{ id: EVAL_ID }] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

const baseInput = { entityId: ENTITY_ID, scorecardId: SCORECARD_ID };

describe('ScorecardsEvaluateHandler', () => {
  it('cache within TTL, force=false → cached result returned, no INSERT', async () => {
    const pool = makePool({ cachedEval: { age: 100, ttl: 3600 } });
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx({ ...baseInput, force: false });
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.outputs.cached).toBe(true);
    expect(result.outputs.evaluationId).toBe(EVAL_ID);
    const insertCalled = (pool.query as ReturnType<typeof vi.fn>).mock.calls.some(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO scorecard_evaluations'),
    );
    expect(insertCalled).toBe(false);
  });

  it('cache expired, force=false → fresh evaluation run', async () => {
    const pool = makePool({ cachedEval: { age: 7200, ttl: 3600 } });
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx({ ...baseInput, force: false });
    const result = await handler.execute(ctx);

    expect(result.outputs.cached).toBe(false);
    const insertCalled = (pool.query as ReturnType<typeof vi.fn>).mock.calls.some(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO scorecard_evaluations'),
    );
    expect(insertCalled).toBe(true);
  });

  it('force=true with valid cache → fresh evaluation run regardless', async () => {
    const pool = makePool({ cachedEval: { age: 10, ttl: 3600 } });
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx({ ...baseInput, force: true });
    const result = await handler.execute(ctx);

    expect(result.outputs.cached).toBe(false);
  });

  it('scorecard not found → NOT_FOUND', async () => {
    const pool = makePool({ scorecardFound: false });
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx(baseInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('entity not found → NOT_FOUND', async () => {
    const pool = makePool({ entityFound: false });
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx(baseInput);
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('stub evaluator — hasOwner rule passes when owner_ref set', async () => {
    const pool = makePool({});
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(result.outputs.cached).toBe(false);
    const results = result.outputs.results as Array<{ ruleId: string; pass: boolean }>;
    const ownerRule = results.find((r) => r.ruleId === 'r1');
    expect(ownerRule?.pass).toBe(true);
  });

  it('stub evaluator — all bronze rules pass → level=bronze', async () => {
    const pool = makePool({});
    const handler = new ScorecardsEvaluateHandler(pool as never);
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(result.outputs.level).toBe('bronze');
    expect(result.outputs.status).toBe('success');
  });
});
