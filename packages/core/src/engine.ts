import type { Result } from './types.js';
import type { Rule, RuleContext } from './rule.js';

/**
 * Run a set of rules against a shared context and collect their findings.
 * Rules are independent, so they run concurrently; results are flattened in
 * rule order for stable output.
 */
export async function runRules(rules: Rule[], ctx: RuleContext): Promise<Result[]> {
  const perRule = await Promise.all(rules.map((rule) => rule.check(ctx)));
  return perRule.flat();
}
