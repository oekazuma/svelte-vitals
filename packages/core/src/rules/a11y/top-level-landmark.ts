import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

const docsUrl = docsUrlFor('a11y/top-level-landmark');
const recommendation =
  'A banner, main, complementary, or contentinfo landmark should not be nested inside another landmark.';

const KINDS = ['main', 'banner', 'complementary', 'contentinfo'] as const;

/**
 * a11y/top-level-landmark — a landmark (`main`/`banner`/`complementary`/`contentinfo`) that
 * composition places inside another landmark. `ctx.a11y[].nestedLandmarks` already carries one
 * entry per nested occurrence, so this rule only reports them.
 */
export const a11yTopLevelLandmark: Rule = {
  id: 'a11y/top-level-landmark',
  title: 'Top-level landmark',
  category: 'a11y',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Assistive tech landmark navigation expects banner/main/complementary/contentinfo at the top level; nesting one inside another hides it from that navigation.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      for (const nested of route.nestedLandmarks) {
        out.push({
          id: 'a11y/top-level-landmark',
          category: 'a11y',
          severity: 'warning',
          detection: PENALIZED,
          route: route.route,
          location: nested.file,
          ...(nested.line > 0 ? { line: nested.line } : {}),
          message: `${nested.kind} landmark is nested inside ${nested.within}`,
          recommendation,
          docsUrl
        });
      }
      if (route.nestedLandmarks.length === 0) {
        const first = KINDS.map((kind) => route.landmarks[kind]?.[0]).find((rep) => rep !== undefined);
        if (first) {
          out.push({
            id: 'a11y/top-level-landmark',
            category: 'a11y',
            severity: 'warning',
            detection: PASS,
            route: route.route,
            location: first.file,
            message: 'No nested landmarks',
            recommendation,
            docsUrl
          });
        }
      }
    }
    return out;
  }
};
