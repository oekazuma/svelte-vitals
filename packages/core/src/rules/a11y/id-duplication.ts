import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

const docsUrl = docsUrlFor('a11y/id-duplication');
const recommendation = 'Every id in a route should be unique.';

/**
 * a11y/id-duplication — a literal id repeated within a composed route. `ctx.a11y[].ids`
 * already holds the branch-aware-folded representatives per id, so this rule only counts them.
 */
export const a11yIdDuplication: Rule = {
  id: 'a11y/id-duplication',
  title: 'Id duplication',
  category: 'a11y',
  severity: 'warning',
  scope: 'route',
  rationale:
    'A duplicate id breaks label/aria-labelledby associations and in-page fragment navigation: assistive tech resolves the first match, which may not be the one the author intended.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      let hasAny = false;
      let hasSurplus = false;
      let first: { file: string; line: number } | undefined;
      for (const id of Object.keys(route.ids)) {
        const reps = route.ids[id] ?? [];
        if (reps.length === 0) continue;
        hasAny = true;
        first ??= reps[0];
        const n = reps.length;
        for (let i = 1; i < n; i++) {
          hasSurplus = true;
          const occ = reps[i]!;
          out.push({
            id: 'a11y/id-duplication',
            category: 'a11y',
            severity: 'warning',
            detection: PENALIZED,
            route: route.route,
            location: occ.file,
            ...(occ.line > 0 ? { line: occ.line } : {}),
            message: `Duplicate id "${id}"`,
            recommendation,
            docsUrl
          });
        }
      }
      if (hasAny && !hasSurplus) {
        out.push({
          id: 'a11y/id-duplication',
          category: 'a11y',
          severity: 'warning',
          detection: PASS,
          route: route.route,
          location: first!.file,
          message: 'No duplicate ids',
          recommendation,
          docsUrl
        });
      }
    }
    return out;
  }
};
