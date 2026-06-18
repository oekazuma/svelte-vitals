import type { Config, Result } from './types.js';
import type { Rule } from './rule.js';

/** Drop rules disabled via config (design §6). */
export function selectRules(rules: Rule[], config: Config): Rule[] {
  return rules.filter((rule) => config.rules[rule.id] !== 'off');
}

/** Apply per-rule severity overrides to results (design §6). */
export function applyRuleSeverities(results: Result[], config: Config): Result[] {
  return results.map((result) => {
    const setting = config.rules[result.id];
    return setting && setting !== 'off' ? { ...result, severity: setting } : result;
  });
}
