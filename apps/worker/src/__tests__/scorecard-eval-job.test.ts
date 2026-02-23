import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScorecardEngine, EvaluationResult } from '@forgeportal/scorecards';
import { createJobHandlers } from '../handlers.js';

// ── fixtures ───────────────────────────────────────────────────────────────

const noopLogger = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  child: vi.fn().mockReturnThis(), fatal: vi.fn(), trace: vi.fn(), silent: vi.fn(), level: 'info',
} as never;

const mockEvalResult: EvaluationResult = {
  evaluationId:    'eval-1',
  scorecardId:     'sc-1',
  entityId:        'e-1',
  status:          'success',
  level:           'Bronze',
  results:         [],
  cached:          false,
  evaluatedAt:     new Date(),
  cacheTtlSeconds: 3600,
};

function makeContext(evaluateFn: () => Promise<EvaluationResult>) {
  const scorecardEngine = {
    evaluate: vi.fn().mockImplementation(evaluateFn),
  } as unknown as ScorecardEngine;

  const handlers = createJobHandlers({
    pool:            {} as never,
    scmProviders:    {} as never,
    config:          {} as never,
    logger:          noopLogger,
    scorecardEngine,
  });

  return { handlers, scorecardEngine };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('scorecard-eval job handler', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls ScorecardEngine.evaluate with correct params', async () => {
    const { handlers, scorecardEngine } = makeContext(() => Promise.resolve(mockEvalResult));

    await handlers['scorecard-eval']!({ entityId: 'e-1', scorecardId: 'sc-1' });

    expect(scorecardEngine.evaluate).toHaveBeenCalledOnce();
    expect(scorecardEngine.evaluate).toHaveBeenCalledWith({
      entityId:    'e-1',
      scorecardId: 'sc-1',
      force:       false,
    });
  });

  it('passes force=true from payload', async () => {
    const { handlers, scorecardEngine } = makeContext(() => Promise.resolve(mockEvalResult));

    await handlers['scorecard-eval']!({ entityId: 'e-1', scorecardId: 'sc-1', force: true });

    expect(scorecardEngine.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ force: true }),
    );
  });

  it('re-throws when engine throws — so pollJobs marks job as failed', async () => {
    const { handlers } = makeContext(() => Promise.reject(new Error('Entity not found')));

    await expect(handlers['scorecard-eval']!({ entityId: 'e-1', scorecardId: 'sc-1' }))
      .rejects.toThrow('Entity not found');
  });

  it('returns without throwing when payload is missing required fields', async () => {
    const { handlers, scorecardEngine } = makeContext(() => Promise.resolve(mockEvalResult));

    // Should NOT throw — logs warning and returns early
    await expect(handlers['scorecard-eval']!({ })).resolves.toBeUndefined();
    expect(scorecardEngine.evaluate).not.toHaveBeenCalled();
  });
});
