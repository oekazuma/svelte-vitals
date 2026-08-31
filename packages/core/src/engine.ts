import type { Config, Result } from './types.js';
import type { Rule, RuleContext } from './rule.js';
import { applyRuleSeverities, applyOverrides, withFailedRulesOff } from './config-apply.js';
import { applyInlineDirectives, type DirectiveIndex } from './inline-directives.js';

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

/**
 * Run rules and apply the correction sequence every pipeline owes its results: configured
 * severities, overrides, inline directives, then the failed-rule weight correction — a failed
 * rule examined nothing, so its weight must not stay in the Health denominator, and every
 * downstream consumer must score against the returned `scoringConfig` so they agree.
 * A caller with no directive sources passes an empty index, which makes the directive pass
 * identity; the severity and override passes are config-governed and run regardless.
 */
export async function runAnalysis(
  rules: Rule[],
  ctx: RuleContext,
  directives: DirectiveIndex
): Promise<{
  results: Result[];
  examined: Record<string, Record<string, number>>;
  failedRules: FailedRule[];
  failedRuleIds: string[];
  scoringConfig: Config;
}> {
  const { results: raw, examined, failedRules } = await runRules(rules, ctx);
  const results = applyInlineDirectives(
    applyOverrides(applyRuleSeverities(raw, ctx.config), ctx.config),
    directives,
    rules,
    ctx.config
  );
  const failedRuleIds = failedRules.map((f) => f.id);
  return {
    results,
    examined,
    failedRules,
    failedRuleIds,
    scoringConfig: withFailedRulesOff(ctx.config, failedRuleIds)
  };
}
