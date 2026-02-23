import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntityRow } from '@forgeportal/catalog';
import type { EvaluationRow, ScorecardRow, RuleResult } from '../types.js';
import { ScorecardEngine }     from '../scorecard-engine.js';
import { ScorecardRepository } from '../scorecard.repository.js';
import { RuleEvaluator }       from '../rule-evaluator.js';
import { ScmFileCache }        from '../scm-file-cache.js';
import { EntityRepository }    from '@forgeportal/catalog';

vi.mock('../scorecard.repository.js');
vi.mock('../rule-evaluator.js');
vi.mock('@forgeportal/catalog', () => ({
  EntityRepository: vi.fn(),
}));

// ── fixtures ────────────────────────────────────────────────────────────────

const ENTITY: EntityRow = {
  id:        'ent-1',
  kind:      'service',
  namespace: 'default',
  name:      'my-service',
  owner_ref: 'team:payments',
  lifecycle: 'production',
  tags:      ['node'],
  links:     [],
  scm:       { provider: 'github', owner: 'myorg', repo: 'my-service' },
  spec:      {},
  created_at: new Date(),
  updated_at: new Date(),
};

const SCORECARD: ScorecardRow = {
  id:              'sc-1',
  name:            'service-maturity',
  applies_to_kind: 'service',
  version:         'v1',
  enabled:         true,
  definition:      {
    name:   'service-maturity',
    levels: ['Bronze', 'Silver', 'Gold'],
    rules:  [
      { id: 'owner', title: 'Owner is set', level: 'Bronze', type: 'entity.field.exists', params: { field: 'owner_ref' } },
      { id: 'docs',  title: 'Docs exist',   level: 'Gold',   type: 'scm.anyOf',          params: { paths: ['docs/index.md'] } },
    ],
  },
  created_at: new Date(),
};

const PASS_RESULTS: RuleResult[] = [
  { ruleId: 'owner', ruleTitle: 'Owner is set', level: 'Bronze', pass: true,  details: {} },
  { ruleId: 'docs',  ruleTitle: 'Docs exist',   level: 'Gold',   pass: true,  details: {} },
];

function makeStoredEval(overrides: Partial<EvaluationRow> = {}): EvaluationRow {
  return {
    id:                'eval-1',
    scorecard_id:      'sc-1',
    entity_id:         'ent-1',
    status:            'success',
    level:             'Gold',
    results:           PASS_RESULTS,
    evaluated_at:      new Date(Date.now() - 60_000),   // 60s ago
    cache_ttl_seconds: 3600,
    ...overrides,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('ScorecardEngine', () => {
  let engine:         ScorecardEngine;
  let mockScRepo:     ReturnType<typeof vi.mocked<ScorecardRepository>>;
  let mockEntityRepo: ReturnType<typeof vi.mocked<EntityRepository>>;
  let mockEvaluator:  ReturnType<typeof vi.mocked<RuleEvaluator>>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScRepo     = vi.mocked(new (ScorecardRepository as unknown as new (...args: unknown[]) => ScorecardRepository)());
    mockEntityRepo = vi.mocked(new (EntityRepository as unknown as new (...args: unknown[]) => EntityRepository)());
    mockEvaluator  = vi.mocked(new (RuleEvaluator as unknown as new (...args: unknown[]) => RuleEvaluator)());

    vi.mocked(ScorecardRepository).mockReturnValue(mockScRepo);
    vi.mocked(EntityRepository).mockReturnValue(mockEntityRepo);
    vi.mocked(RuleEvaluator).mockReturnValue(mockEvaluator);

    engine = new ScorecardEngine({} as never, new Map(), new ScmFileCache());
  });

  it('cache hit within TTL + force=false → returns cached result (AC: 7)', async () => {
    const cached = makeStoredEval({ evaluated_at: new Date(Date.now() - 30_000) });
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(cached);

    const result = await engine.evaluate({ scorecardId: 'sc-1', entityId: 'ent-1', force: false });
    expect(result.cached).toBe(true);
    expect(result.evaluationId).toBe('eval-1');
    expect(mockScRepo.insertEvaluation).not.toHaveBeenCalled();
  });

  it('cache hit but force=true → re-evaluates (AC: 7)', async () => {
    const cached = makeStoredEval({ evaluated_at: new Date(Date.now() - 30_000) });
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(cached);
    mockScRepo.findById             = vi.fn().mockResolvedValue(SCORECARD);
    mockEntityRepo.findById         = vi.fn().mockResolvedValue(ENTITY);
    mockEvaluator.evaluate          = vi.fn().mockResolvedValue(PASS_RESULTS[0]);
    const newEval = makeStoredEval({ id: 'eval-2' });
    mockScRepo.insertEvaluation     = vi.fn().mockResolvedValue(newEval);

    const result = await engine.evaluate({ scorecardId: 'sc-1', entityId: 'ent-1', force: true });
    expect(result.cached).toBe(false);
    expect(mockScRepo.insertEvaluation).toHaveBeenCalledTimes(1);
  });

  it('cache miss → evaluates and stores result (AC: 6)', async () => {
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(null);
    mockScRepo.findById             = vi.fn().mockResolvedValue(SCORECARD);
    mockEntityRepo.findById         = vi.fn().mockResolvedValue(ENTITY);
    mockEvaluator.evaluate          = vi.fn()
      .mockResolvedValueOnce(PASS_RESULTS[0])
      .mockResolvedValueOnce(PASS_RESULTS[1]);
    const stored = makeStoredEval({ id: 'eval-new' });
    mockScRepo.insertEvaluation     = vi.fn().mockResolvedValue(stored);

    const result = await engine.evaluate({ scorecardId: 'sc-1', entityId: 'ent-1' });
    expect(result.cached).toBe(false);
    expect(mockScRepo.insertEvaluation).toHaveBeenCalledTimes(1);
  });

  it('entity not found → throws (AC: 8)', async () => {
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(null);
    mockScRepo.findById             = vi.fn().mockResolvedValue(SCORECARD);
    mockEntityRepo.findById         = vi.fn().mockResolvedValue(null);

    await expect(engine.evaluate({ scorecardId: 'sc-1', entityId: 'missing' }))
      .rejects.toThrow('Entity not found');
  });

  it('scorecard not found → throws (AC: 8)', async () => {
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(null);
    mockScRepo.findById             = vi.fn().mockResolvedValue(null);

    await expect(engine.evaluate({ scorecardId: 'missing', entityId: 'ent-1' }))
      .rejects.toThrow('Scorecard not found');
  });

  it('SCM rule errors → status=partial (AC: 8)', async () => {
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(null);
    mockScRepo.findById             = vi.fn().mockResolvedValue(SCORECARD);
    mockEntityRepo.findById         = vi.fn().mockResolvedValue(ENTITY);
    mockEvaluator.evaluate          = vi.fn()
      .mockResolvedValueOnce({ ...PASS_RESULTS[0]! })
      .mockResolvedValueOnce({ ...PASS_RESULTS[1]!, pass: false, error: 'GitHub 503' });
    mockScRepo.insertEvaluation     = vi.fn().mockResolvedValue(makeStoredEval({ status: 'partial', level: 'Bronze' }));

    const result = await engine.evaluate({ scorecardId: 'sc-1', entityId: 'ent-1' });
    expect(mockScRepo.insertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'partial' }),
    );
    expect(result).toBeDefined();
  });

  it('all rules pass → status=success, level=Gold (AC: 1-6)', async () => {
    mockScRepo.findLatestEvaluation = vi.fn().mockResolvedValue(null);
    mockScRepo.findById             = vi.fn().mockResolvedValue(SCORECARD);
    mockEntityRepo.findById         = vi.fn().mockResolvedValue(ENTITY);
    mockEvaluator.evaluate          = vi.fn()
      .mockResolvedValueOnce(PASS_RESULTS[0])
      .mockResolvedValueOnce(PASS_RESULTS[1]);
    const stored = makeStoredEval({ status: 'success', level: 'Gold' });
    mockScRepo.insertEvaluation     = vi.fn().mockResolvedValue(stored);

    const result = await engine.evaluate({ scorecardId: 'sc-1', entityId: 'ent-1' });
    expect(mockScRepo.insertEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', level: 'Gold' }),
    );
    expect(result.level).toBe('Gold');
  });
});
