import type { Detection, Result, Severity } from '../../types.js';
import type { A11yOccurrenceInfo, ResolvedA11y } from '../../a11y.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

/**
 * Per-rule Result builder for the route-scoped a11y rules — the one place their shared
 * shape lives. `line` is emitted only when positive: PASS results deliberately carry no
 * line (callers pass `line: 0`), matching `seo/heading-level-skip`'s attribution.
 */
export function resultFactory(id: string, recommendation: string, severity: Severity) {
  const docsUrl = docsUrlFor(id);
  return (route: string, detection: Detection, occ: { file: string; line: number }, message: string): Result => ({
    id,
    category: 'a11y',
    severity,
    detection,
    route,
    location: occ.file,
    ...(occ.line > 0 ? { line: occ.line } : {}),
    message,
    recommendation,
    docsUrl
  });
}

/**
 * Shared engine behind `a11y/duplicate-landmark` and `a11y/id-duplication`: for each entry of
 * `map(route)` (already branch-aware-folded, deterministically ordered representatives),
 * every representative beyond the first is one PENALIZED finding; a route with entries but no
 * surplus emits one PASS at the first entry's first representative; no entries emits nothing.
 * `map` returns ORDERED entries (a Record's own-key enumeration reorders integer-like keys,
 * so it cannot carry the order): their order is emission order and picks the PASS anchor.
 */
export function surplusRule(spec: {
  id: string;
  title: string;
  rationale: string;
  recommendation: string;
  map: (route: ResolvedA11y) => [string, A11yOccurrenceInfo[]][];
  message: (key: string, i: number, n: number, first: A11yOccurrenceInfo) => string;
  passMessage: string;
}): Rule {
  const result = resultFactory(spec.id, spec.recommendation, 'warning');
  return {
    id: spec.id,
    title: spec.title,
    passLabel: spec.passMessage,
    category: 'a11y',
    severity: 'warning',
    scope: 'route',
    rationale: spec.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const route of ctx.a11y ?? []) {
        let first: A11yOccurrenceInfo | undefined;
        let surplus = false;
        for (const [key, reps] of spec.map(route)) {
          first ??= reps[0];
          for (let i = 1; i < reps.length; i++) {
            surplus = true;
            out.push(result(route.route, PENALIZED, reps[i]!, spec.message(key, i, reps.length, reps[0]!)));
          }
        }
        if (first && !surplus) out.push(result(route.route, PASS, { file: first.file, line: 0 }, spec.passMessage));
      }
      return out;
    }
  };
}
