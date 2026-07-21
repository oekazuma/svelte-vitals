import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from './detection.js';

const docsUrl = docsUrlFor('seo/heading-level-skip');
const recommendation = 'Increase heading levels one step at a time (do not jump, e.g. from <h2> straight to <h4>).';

/**
 * seo/heading-level-skip — Skipped heading level. Walking a route's body headings in
 * document order, a level that jumps more than +1 over the previous heading (e.g.
 * h2 → h4) breaks the outline. The first heading has no predecessor (missing/multiple
 * <h1> stays seo/single-h1's concern). A route with no headings emits nothing.
 */
export const seo030HeadingOrder: Rule = {
  id: 'seo/heading-level-skip',
  title: 'Heading order',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'Skipping a heading level breaks the document outline that search engines and assistive tech rely on to understand page structure.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.headings ?? []) {
      if (route.headings.length === 0) continue; // no headings → no outline signal
      let prev = route.headings[0]!.level;
      let skip: { level: number; prev: number; line: number; file: string } | undefined;
      for (let i = 1; i < route.headings.length; i++) {
        const h = route.headings[i]!;
        if (h.level > prev + 1) {
          skip = { level: h.level, prev, line: h.line, file: h.file };
          break;
        }
        prev = h.level;
      }
      out.push(
        skip
          ? {
              id: 'seo/heading-level-skip',
              category: 'seo',
              severity: 'info',
              detection: PENALIZED,
              route: route.route,
              location: skip.file,
              ...(skip.line > 0 ? { line: skip.line } : {}),
              message: `Heading level skipped (<h${skip.prev}> to <h${skip.level}>)`,
              recommendation,
              docsUrl
            }
          : {
              id: 'seo/heading-level-skip',
              category: 'seo',
              severity: 'info',
              detection: PASS,
              route: route.route,
              message: 'Heading order',
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
