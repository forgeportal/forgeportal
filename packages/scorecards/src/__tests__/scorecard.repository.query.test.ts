import { describe, it, expect, vi } from 'vitest';
import { ScorecardRepository } from '../scorecard.repository.js';
import type { ScorecardRow, EvaluationRow } from '../types.js';

// ── helpers ────────────────────────────────────────────────────────────────

function makeScorecardRow(overrides: Partial<ScorecardRow> = {}): Record<string, unknown> {
  return {
    id:              'sc-1',
    name:            'service-maturity',
    applies_to_kind: 'service',
    version:         'v1',
    enabled:         true,
    definition:      { name: 'service-maturity', levels: ['Bronze', 'Silver'], rules: [] },
    created_at:      new Date(),
    ...overrides,
  };
}

function makeEvalRow(overrides: Partial<EvaluationRow> = {}): Record<string, unknown> {
  return {
    id:                'eval-1',
    scorecard_id:      'sc-1',
    entity_id:         'entity-1',
    status:            'success',
    level:             'Bronze',
    results:           [],
    evaluated_at:      new Date(),
    cache_ttl_seconds: 3600,
    ...overrides,
  };
}

function mockPool(rows: Record<string, unknown>[]) {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('ScorecardRepository', () => {
  describe('findByKind', () => {
    it("returns scorecards matching 'service' kind", async () => {
      const rows = [makeScorecardRow({ applies_to_kind: 'service' })];
      const pool = mockPool(rows);
      const repo = new ScorecardRepository(pool as never);

      const result = await repo.findByKind('service');

      expect(result).toHaveLength(1);
      expect(result[0]!.applies_to_kind).toBe('service');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('applies_to_kind = $1'),
        ['service'],
      );
    });

    it("returns empty array when no scorecards match 'library' kind", async () => {
      const pool = mockPool([]);
      const repo = new ScorecardRepository(pool as never);

      const result = await repo.findByKind('library');

      expect(result).toHaveLength(0);
    });
  });

  describe('findAll', () => {
    it('returns all enabled scorecards', async () => {
      const rows = [
        makeScorecardRow({ id: 'sc-1', name: 'maturity-a' }),
        makeScorecardRow({ id: 'sc-2', name: 'maturity-b' }),
      ];
      const pool = mockPool(rows);
      const repo = new ScorecardRepository(pool as never);

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('enabled = true'),
      );
    });
  });

  describe('findLatestPerScorecardForEntity', () => {
    it('returns one row per scorecard for an entity', async () => {
      const rows = [
        makeEvalRow({ scorecard_id: 'sc-1', entity_id: 'entity-1' }),
        makeEvalRow({ id: 'eval-2', scorecard_id: 'sc-2', entity_id: 'entity-1' }),
      ];
      const pool = mockPool(rows);
      const repo = new ScorecardRepository(pool as never);

      const result = await repo.findLatestPerScorecardForEntity('entity-1');

      expect(result).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT ON'),
        ['entity-1'],
      );
    });

    it('returns only the latest row when entity has multiple evaluations for same scorecard', async () => {
      // The SQL uses DISTINCT ON — in tests we just verify correct SQL is issued
      // (the DB guarantees dedup; mock returns what we tell it)
      const latestRow = makeEvalRow({ id: 'eval-latest', scorecard_id: 'sc-1', entity_id: 'entity-1' });
      const pool = mockPool([latestRow]);  // mock returns 1 row (as DB would)
      const repo = new ScorecardRepository(pool as never);

      const result = await repo.findLatestPerScorecardForEntity('entity-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('eval-latest');
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY scorecard_id, evaluated_at DESC'),
        ['entity-1'],
      );
    });

    it('returns empty array when entity has no evaluations', async () => {
      const pool = mockPool([]);
      const repo = new ScorecardRepository(pool as never);

      const result = await repo.findLatestPerScorecardForEntity('entity-1');

      expect(result).toHaveLength(0);
    });
  });
});
