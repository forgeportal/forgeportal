import type { RuleDefinition, RuleResult } from './types.js';

// Allow null pass values from the Map (RuleResult.pass is boolean | null)
type PassValue = boolean | null | undefined;

/**
 * Returns the highest level where ALL rules for that level AND all lower
 * levels pass (cumulative Bronze ≤ Silver ≤ Gold).
 *
 * Examples with levels = ["Bronze", "Silver", "Gold"]:
 *   - All Bronze pass, Silver has a failure → "Bronze"
 *   - All Bronze + Silver pass, Gold fails   → "Silver"
 *   - All rules pass                         → "Gold"
 *   - Bronze fails                           → null
 *   - Level has no rules defined             → auto-passes (only if previous levels passed)
 *
 * Level strings are compared case-insensitively against the `levels` array.
 * The original-cased string from `levels` is returned.
 */
export function calculateLevel(
  levels:  string[],
  rules:   RuleDefinition[],
  results: RuleResult[],
): string | null {
  const resultMap       = new Map<string, PassValue>(results.map((r) => [r.ruleId, r.pass]));
  const normalizedLevels = levels.map((l) => l.toLowerCase());

  let highestAchieved: string | null = null;

  for (let i = 0; i < normalizedLevels.length; i++) {
    const level         = normalizedLevels[i]!;
    const rulesForLevel = rules.filter((r) => r.level.toLowerCase() === level);

    if (rulesForLevel.length === 0) {
      // No rules for this level — auto-pass only if we've already achieved the previous level
      // (or this is the first level)
      if (highestAchieved !== null || i === 0) {
        highestAchieved = level;
      }
      continue;
    }

    // Null results are neutral — only non-null results count toward the level threshold.
    // A level passes when: all explicitly evaluated (non-null) rules pass, and
    // at least one rule was actually evaluated (or all were null → treat as auto-pass).
    const nonNullRules = rulesForLevel.filter((r) => {
      const v = resultMap.get(r.id);
      return v !== null && v !== undefined;
    });

    const allPass = nonNullRules.length === 0
      // All rules skipped (null) → neutral auto-pass for this level
      ? true
      : nonNullRules.every((r) => resultMap.get(r.id) === true);

    if (allPass) {
      highestAchieved = level;
    } else {
      // Cumulative: cannot achieve any higher level
      break;
    }
  }

  if (!highestAchieved) return null;

  // Return the original-cased level string from the `levels` array
  const idx = normalizedLevels.indexOf(highestAchieved);
  return idx >= 0 ? (levels[idx] ?? highestAchieved) : highestAchieved;
}
