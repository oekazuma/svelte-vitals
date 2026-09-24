import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';
import { foldOccurrences } from '../../a11y.js';
import type { HeadingInfo } from '../../headings.js';

const docsUrl = docsUrlFor('seo/single-h1');
const passRecommendation =
  'Use exactly one <h1> per page for its main topic; demote extra top-level headings to <h2>+.';
const missingRecommendation = "Add a single, descriptive <h1> naming the page's main topic.";
const multipleRecommendation =
  'A single, clear <h1> is the conventional signal for a page — consider demoting extra top-level headings to <h2>+.';

/**
 * seo/single-h1 — Heading hierarchy (single H1). Reads the per-route page-body headings
 * channel (collected by both providers), counting `headings` plus `componentHeadings`
 * (static mode only — headings found transitively in rendered child components) as one
 * combined list. Zero <h1> (no primary heading) is a `warning`: defensible, a page needs
 * a primary heading. Two or more is only `info`: a single <h1> is the conventional
 * signal, but no official source documents a ranking penalty for several (2026-08-09 v1
 * rule-validity review, P2 #11) — so it's flagged as a style nit, not a defect. Exactly
 * one passes. A route whose headings were not collected (channel unset) emits nothing, as does
 * one whose `dynamicHeading` flag says a heading of undeterminable level may be its <h1>. A
 * global `rules: { 'seo/single-h1': <severity> }` override flattens both arms to one
 * severity (design, `applyRuleSeverities`).
 */
/**
 * The <h1>s that can render together, in input order: the arms of one `{#if}`/`{#await}`/
 * `<svelte:boundary>` contribute only their largest arm. Separate blocks still sum, since both may be true.
 */
function renderableH1s(headings: HeadingInfo[]): HeadingInfo[] {
  const nodes = headings
    .filter((h) => h.level === 1)
    .map((heading) => ({ key: 'h1', path: heading.path ?? [], repeatable: false, heading }));
  const kept = new Set([...foldOccurrences(nodes).values()].flat().map((n) => n.heading));
  return headings.filter((h) => kept.has(h));
}

export const seoSingleH1: Rule = {
  id: 'seo/single-h1',
  title: 'Heading hierarchy',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'A page should have a primary heading naming its main topic. Zero <h1> leaves the page without one; a single, clear <h1> is the conventional signal, though multiple <h1>s are tolerated by modern heading algorithms.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.headings ?? []) {
      const combined = [...route.headings, ...(route.componentHeadings ?? [])];
      const h1 = renderableH1s(combined);
      let problem: { message: string; severity: 'warning' | 'info'; recommendation: string } | undefined;
      let where: Pick<Result, 'location' | 'line'> = {};
      if (h1.length === 0) {
        // A `<svelte:element>` whose tag is not statically determinable may render the page's
        // <h1>; "missing" would be a guess, so the route is skipped rather than flagged.
        if (route.dynamicHeading) continue;
        problem = { message: 'Missing <h1>', severity: 'warning', recommendation: missingRecommendation };
        // Counting reads `combined`; attribution deliberately does not. Locating the
        // Missing arm in a component file would change its findingKey
        // (`id::route::location`) — invalidating committed suppressions — and make it
        // newly visible to `--diff` runs touching that component.
        const first = route.headings[0];
        if (first) where = { location: first.file, ...(first.line > 0 ? { line: first.line } : {}) };
      } else if (h1.length > 1) {
        problem = {
          message: `Multiple <h1> (${h1.length}); a single <h1> is the conventional signal`,
          severity: 'info',
          recommendation: multipleRecommendation
        };
        const extra = h1[1]!;
        where = { location: extra.file, ...(extra.line > 0 ? { line: extra.line } : {}) };
      }
      out.push(
        problem
          ? {
              id: 'seo/single-h1',
              category: 'seo',
              severity: problem.severity,
              detection: PENALIZED,
              route: route.route,
              ...where,
              message: problem.message,
              recommendation: problem.recommendation,
              docsUrl
            }
          : {
              id: 'seo/single-h1',
              category: 'seo',
              severity: 'warning',
              detection: PASS,
              route: route.route,
              // No single route-level file exists here (unlike ResolvedHead.file) — the
              // passing route's own <h1> stands in as its attributed file (design
              // 2026-08-08-pass-result-location-design.md). Only reached when h1.length === 1.
              location: h1[0]!.file,
              message: 'Heading hierarchy',
              recommendation: passRecommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
