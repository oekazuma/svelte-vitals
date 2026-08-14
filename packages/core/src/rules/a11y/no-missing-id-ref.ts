import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

const docsUrl = docsUrlFor('a11y/no-missing-id-ref');
const recommendation = 'An id reference should point to an id that exists somewhere in the composed route.';

/**
 * a11y/no-missing-id-ref — a `for`/`aria-labelledby`/`aria-describedby`/`aria-controls`/
 * `aria-activedescendant`/same-page `href="#…"` referencing an `id` absent from the composed
 * route. Universal ("no element anywhere defines this id") needs a closed world, so this rule
 * runs only on routes `ctx.a11y[].fullyResolved` marks fully resolved — see the rule docs.
 */
export const a11yNoMissingIdRef: Rule = {
  id: 'a11y/no-missing-id-ref',
  title: 'No missing id ref',
  category: 'a11y',
  severity: 'warning',
  scope: 'route',
  rationale:
    'A `for`/`aria-labelledby`/`aria-describedby`/`aria-controls`/`aria-activedescendant`/`href="#…"` pointing at an id that does not exist leaves assistive tech with a broken association or the browser with a dead in-page link.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.a11y ?? []) {
      if (!route.fullyResolved || route.idRefs.length === 0) continue;
      let hasMissing = false;
      for (const ref of route.idRefs) {
        if (route.idCandidates.includes(ref.id)) continue;
        hasMissing = true;
        out.push({
          id: 'a11y/no-missing-id-ref',
          category: 'a11y',
          severity: 'warning',
          detection: PENALIZED,
          route: route.route,
          location: ref.file,
          ...(ref.line > 0 ? { line: ref.line } : {}),
          message: `${ref.attr}="${ref.attr === 'href' ? '#' : ''}${ref.id}" references a missing id`,
          recommendation,
          docsUrl
        });
      }
      if (!hasMissing) {
        const first = route.idRefs[0]!;
        out.push({
          id: 'a11y/no-missing-id-ref',
          category: 'a11y',
          severity: 'warning',
          detection: PASS,
          route: route.route,
          location: first.file,
          message: 'No missing id references',
          recommendation,
          docsUrl
        });
      }
    }
    return out;
  }
};
