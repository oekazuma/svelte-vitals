import type { Result } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';
import { resultFactory } from './route-rule.js';

const recommendation =
  'A banner, main, complementary, or contentinfo landmark should not be nested inside another landmark.';
const result = resultFactory('a11y/top-level-landmark', recommendation);

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
        out.push(result(route.route, PENALIZED, nested, `${nested.kind} landmark is nested inside ${nested.within}`));
      }
      if (route.nestedLandmarks.length === 0) {
        const first = KINDS.map((kind) => route.landmarks[kind]?.[0]).find((rep) => rep !== undefined);
        if (first) out.push(result(route.route, PASS, { file: first.file, line: 0 }, 'No nested landmarks'));
      }
    }
    return out;
  }
};
