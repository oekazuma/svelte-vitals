import type { Result } from '../../types.js';
import type { Rule, RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';
import { resultFactory } from './route-rule.js';

const recommendation = 'An id reference should point to an id that exists somewhere in the composed route.';
const result = resultFactory('a11y/no-missing-id-ref', recommendation);

/**
 * a11y/no-missing-id-ref — an id-reference attribute (`IDREF_ATTRS`: HTML's `for`/`list`/`headers`/
 * `form`/the popover and command targets, and every ARIA id-reference property) or a same-page
 * `href="#…"` referencing an `id` absent from the composed route. Universal ("no element anywhere defines this id") needs a closed world, so this rule
 * runs only on routes `ctx.a11y[].fullyResolved` marks fully resolved — see the rule docs.
 */
export const a11yNoMissingIdRef: Rule = {
  id: 'a11y/no-missing-id-ref',
  title: 'No missing id ref',
  category: 'a11y',
  severity: 'warning',
  scope: 'route',
  rationale:
    'An id reference — `for`, `list`, `headers`, `form`, `popovertarget`, `commandfor`, the ARIA id-reference properties (`aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns`, …), or a same-page `href="#…"` — pointing at an id that does not exist leaves assistive tech with a broken association or the browser with a dead in-page link.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      if (!route.fullyResolved || route.idRefs.length === 0) continue;
      const candidates = new Set(route.idCandidates);
      let hasMissing = false;
      for (const ref of route.idRefs) {
        if (candidates.has(ref.id)) continue;
        hasMissing = true;
        out.push(
          result(
            route.route,
            PENALIZED,
            ref,
            `${ref.attr}="${ref.attr === 'href' ? '#' : ''}${ref.id}" references a missing id`
          )
        );
      }
      if (!hasMissing) {
        const first = route.idRefs[0]!;
        out.push(result(route.route, PASS, { file: first.file, line: 0 }, 'No missing id references'));
      }
    }
    return out;
  }
};
