import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

const docsUrl = docsUrlFor('a11y/duplicate-landmark');
const recommendation = 'A route should have at most one main, banner, and contentinfo landmark.';

const KINDS = ['main', 'banner', 'contentinfo'] as const;

/**
 * a11y/duplicate-landmark — a composed route (layout chain + page) yields more than one
 * `main` / `banner` / `contentinfo` landmark. `ctx.a11y[].landmarks` already holds the
 * branch-aware-folded representatives, so this rule only counts them per kind.
 */
export const a11yDuplicateLandmark: Rule = {
  id: 'a11y/duplicate-landmark',
  title: 'Duplicate landmark',
  category: 'a11y',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Assistive tech users jump between landmarks to skip repeated content; more than one main, banner, or contentinfo per page leaves them guessing which one is the real one.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      let hasAny = false;
      let hasSurplus = false;
      let first: { file: string; line: number } | undefined;
      for (const kind of KINDS) {
        const reps = route.landmarks[kind] ?? [];
        if (reps.length === 0) continue;
        hasAny = true;
        first ??= reps[0];
        const n = reps.length;
        for (let i = 1; i < n; i++) {
          hasSurplus = true;
          const occ = reps[i]!;
          out.push({
            id: 'a11y/duplicate-landmark',
            category: 'a11y',
            severity: 'warning',
            detection: PENALIZED,
            route: route.route,
            location: occ.file,
            ...(occ.line > 0 ? { line: occ.line } : {}),
            message: `Duplicate ${kind} landmark (${i + 1} of ${n})`,
            recommendation,
            docsUrl
          });
        }
      }
      if (hasAny && !hasSurplus) {
        out.push({
          id: 'a11y/duplicate-landmark',
          category: 'a11y',
          severity: 'warning',
          detection: PASS,
          route: route.route,
          location: first!.file,
          message: 'No duplicate landmarks',
          recommendation,
          docsUrl
        });
      }
    }
    return out;
  }
};
