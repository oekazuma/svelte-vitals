import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';
import { documentOrder, exclusiveHeadings, type HeadingInfo } from '../../headings.js';

const docsUrl = docsUrlFor('seo/heading-level-skip');

/** Every arm `p` sits in that can be skipped, `h` sits in too: whenever `h` renders, so does `p` (or one like it). */
const rendersWith = (p: HeadingInfo, h: HeadingInfo): boolean =>
  (p.path ?? []).every((s) => s.always || (h.path ?? []).some((t) => t.group === s.group && t.branch === s.branch));
const recommendation = 'Increase heading levels one step at a time (do not jump, e.g. from <h2> straight to <h4>).';

/**
 * seo/heading-level-skip — Skipped heading level. Walking a route's body headings in
 * document order, a level that jumps more than +1 over the previous heading (e.g.
 * h2 → h4) breaks the outline. The first heading has no predecessor (missing/multiple
 * <h1> stays seo/single-h1's concern). A route with no headings emits nothing.
 */
export const seoHeadingLevelSkip: Rule = {
  id: 'seo/heading-level-skip',
  title: 'Heading order',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale:
    'Skipping a heading level breaks the document outline that assistive tech relies on to navigate page structure, and that search engines use as a structural signal.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.headings ?? []) {
      if (route.headings.length === 0) continue; // no headings → no outline signal
      // A component's heading can be the one before a route file's heading, never the one reported:
      // shared chrome would mask every page's own skip behind one finding per route. It counts only
      // where it renders whenever that heading does (no `{#if}` arm of its own around it), so a
      // closed dialog's or menu's heading closes no gap. One without an `order` has no known place.
      const placed = (route.componentHeadings ?? []).filter((h) => h.order);
      const own = new Set(route.headings);
      const headings = [...route.headings, ...placed].sort(documentOrder);
      let skip: { level: number; prev: number; line: number; file: string } | undefined;
      for (let i = 1; i < headings.length && !skip; i++) {
        const h = headings[i]!;
        if (!own.has(h)) continue;
        // The headings before it in a rendering that contains it: an arm exclusive with h's never is.
        const before = headings
          .slice(0, i)
          .filter((p) => !exclusiveHeadings(p, h) && (own.has(p) || rendersWith(p, h)));
        const prev = before.at(-1);
        if (!prev) continue;
        // Each other arm of a block `prev` sits in is a rendering too, ending on its own last heading —
        // unless `prev` repeats in a loop `h` is outside: which arm the last pass takes is the data's.
        const levels = [prev.level];
        const arms = new Set<string>();
        const looped = prev.path?.some((s) => s.repeat && !h.path?.some((t) => t.group === s.group));
        for (let j = looped ? -1 : before.length - 2; j >= 0; j--) {
          const q = before[j]!;
          const step = q.path?.find((s) => prev.path?.some((t) => t.group === s.group && t.branch !== s.branch));
          const arm = step && `${step.group}:${step.branch}`;
          if (arm && !arms.has(arm)) {
            arms.add(arm);
            levels.push(q.level);
          }
        }
        // A heading of an undetermined level (0) neither skips nor sets the level the next one is judged against.
        const known = levels.filter((level) => level > 0);
        const lowest = Math.min(...known);
        if (known.length === levels.length && h.level > lowest + 1)
          skip = { level: h.level, prev: lowest, line: h.line, file: h.file };
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
              // No single route-level file exists here (unlike ResolvedHead.file) — the
              // route's first heading stands in as its attributed file (design
              // 2026-08-08-pass-result-location-design.md). `route.headings.length === 0`
              // already continued above, so `[0]` is always defined here.
              location: route.headings[0]!.file,
              message: 'Heading order',
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
