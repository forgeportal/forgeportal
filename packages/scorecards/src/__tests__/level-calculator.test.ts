import { describe, it, expect } from 'vitest';
import { calculateLevel } from '../level-calculator.js';
import type { RuleDefinition, RuleResult } from '../types.js';

const LEVELS = ['Bronze', 'Silver', 'Gold'];

function makeRule(id: string, level: string): RuleDefinition {
  return { id, title: id, level, type: 'entity.field.exists', params: { field: id } };
}

function makeResult(ruleId: string, pass: boolean): RuleResult {
  return { ruleId, ruleTitle: ruleId, level: '', pass, details: {} };
}

describe('calculateLevel', () => {
  it('all Bronze pass, Silver fails → "Bronze"', () => {
    const rules   = [makeRule('owner', 'Bronze'), makeRule('runbook', 'Silver')];
    const results = [makeResult('owner', true), makeResult('runbook', false)];
    expect(calculateLevel(LEVELS, rules, results)).toBe('Bronze');
  });

  it('all Bronze + Silver pass, Gold fails → "Silver"', () => {
    const rules   = [makeRule('owner', 'Bronze'), makeRule('runbook', 'Silver'), makeRule('docs', 'Gold')];
    const results = [makeResult('owner', true), makeResult('runbook', true), makeResult('docs', false)];
    expect(calculateLevel(LEVELS, rules, results)).toBe('Silver');
  });

  it('all rules pass → "Gold"', () => {
    const rules   = [makeRule('owner', 'Bronze'), makeRule('runbook', 'Silver'), makeRule('docs', 'Gold')];
    const results = [makeResult('owner', true), makeResult('runbook', true), makeResult('docs', true)];
    expect(calculateLevel(LEVELS, rules, results)).toBe('Gold');
  });

  it('all fail → null', () => {
    const rules   = [makeRule('owner', 'Bronze')];
    const results = [makeResult('owner', false)];
    expect(calculateLevel(LEVELS, rules, results)).toBeNull();
  });

  it('no rules for Gold → auto-passes Gold when Bronze + Silver pass', () => {
    const rules   = [makeRule('owner', 'Bronze'), makeRule('runbook', 'Silver')];
    const results = [makeResult('owner', true), makeResult('runbook', true)];
    expect(calculateLevel(LEVELS, rules, results)).toBe('Gold');
  });

  it('case-insensitive level comparison', () => {
    // Rule level is lowercase 'bronze'; levels array is PascalCase — should match
    const rules   = [
      { ...makeRule('owner', 'bronze') },   // lowercase, should match 'Bronze'
      makeRule('runbook', 'Silver'),         // Silver rule that fails → stops at Bronze
    ];
    const results = [makeResult('owner', true), makeResult('runbook', false)];
    expect(calculateLevel(LEVELS, rules, results)).toBe('Bronze');
  });

  it('returns original-cased level string from levels array', () => {
    const levels  = ['BRONZE', 'SILVER', 'GOLD'];
    const rules   = [
      makeRule('owner', 'bronze'),          // lowercase level → should match 'BRONZE'
      makeRule('runbook', 'silver'),         // Silver rule that fails → stops at Bronze
    ];
    const results = [makeResult('owner', true), makeResult('runbook', false)];
    expect(calculateLevel(levels, rules, results)).toBe('BRONZE');
  });
});
