import type { Result } from './types.js';
import type { Rule, RuleContext } from './rule.js';

export interface FailedRule {
  id: string;
  message: string;
}

/**
 * Run a set of rules against a shared context and collect their findings.
 * Rules are independent, so they run concurrently; results are flattened in
 * rule order for stable output. A rule that throws (sync or async) contributes
 * no results instead of taking the whole run down with it — dev tooling must
 * never throw — and is reported in `failedRules` instead.
 */
export async function runRules(
  rules: Rule[],
  ctx: RuleContext
): Promise<{ results: Result[]; examined: Record<string, Record<string, number>>; failedRules: FailedRule[] }> {
  const examined: Record<string, Record<string, number>> = {};
  // The engine supplies the sink rather than each caller: three call sites thread this context, and a
  // caller that forgot would drop the counts silently — the failure this feature exists to remove.
  // Each entry resolves to either its results or its failure — never rejects — so `Promise.all`
  // preserves rule order regardless of completion order, matching `results`' own ordering guarantee.
  const perRule = await Promise.all(
    rules.map(async (rule): Promise<Result[] | FailedRule> => {
      try {
        return await rule.check({ ...ctx, recordExamined: (counts) => void (examined[rule.id] = counts) });
      } catch (err) {
        return { id: rule.id, message: err instanceof Error ? err.message : String(err) };
      }
    })
  );
  const results: Result[] = [];
  const failedRules: FailedRule[] = [];
  for (const outcome of perRule) {
    if (Array.isArray(outcome)) results.push(...outcome);
    else failedRules.push(outcome);
  }
  return { results, examined, failedRules };
}
