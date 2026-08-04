import type { Category, Config, Scope, Severity } from '../types.js';
import type { Rule } from '../rule.js';
import { selectRules, settingSeverity } from '../config-apply.js';
import { allRules } from '../rules/index.js';

const DEDUCTION: Record<Severity, number> = { critical: 15, warning: 5, info: 1 };

export type PairKey = `${Category}::${Scope}`;

export function pairKey(category: Category, scope: Scope): PairKey {
  return `${category}::${scope}`;
}

/** A rule's severity as configured, matching how `selectRules` reads `config.rules`. */
function severityOf(rule: Rule, config: Config): Severity {
  const setting = settingSeverity(config.rules[rule.id]);
  return setting !== undefined && setting !== 'off' ? setting : rule.severity;
}

/**
 * Total severity weight per `(category, scope)` pair — the denominator a key of that pair is measured
 * against. Defaults to the selected registry so `computeScore` needs no new argument; the parameter exists
 * for tests and for scoring against a rule set that is not the registry.
 */
export function buildInventory(
  config: Config,
  rules: readonly Rule[] = selectRules(allRules, config)
): Map<PairKey, number> {
  const out = new Map<PairKey, number>();
  for (const rule of rules) {
    // A rule list passed directly (as tests do) bypasses `selectRules`, so an 'off' setting
    // must be re-checked here rather than trusted to have been filtered upstream.
    if (settingSeverity(config.rules[rule.id]) === 'off') continue;
    const key = pairKey(rule.category, rule.scope);
    out.set(key, (out.get(key) ?? 0) + DEDUCTION[severityOf(rule, config)]);
  }
  return out;
}

/** Rule id to its pair, so a result can be attributed to the inventory entry it was measured against. */
export function ruleScopes(rules: readonly Rule[]): Map<string, PairKey> {
  return new Map(rules.map((r) => [r.id, pairKey(r.category, r.scope)]));
}
