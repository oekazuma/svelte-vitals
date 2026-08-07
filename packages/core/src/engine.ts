import type { Result } from './types.js';
import type { Rule, RuleContext } from './rule.js';

/**
 * Run a set of rules against a shared context and collect their findings.
 * Rules are independent, so they run concurrently; results are flattened in
 * rule order for stable output.
 */
export async function runRules(
  rules: Rule[],
  ctx: RuleContext
): Promise<{ results: Result[]; examined: Record<string, Record<string, number>> }> {
  const examined: Record<string, Record<string, number>> = {};
  // The engine supplies the sink rather than each caller: three call sites thread this context, and a
  // caller that forgot would drop the counts silently — the failure this feature exists to remove.
  const perRule = await Promise.all(
    rules.map((rule) => rule.check({ ...ctx, recordExamined: (counts) => void (examined[rule.id] = counts) }))
  );
  return { results: perRule.flat(), examined };
}
