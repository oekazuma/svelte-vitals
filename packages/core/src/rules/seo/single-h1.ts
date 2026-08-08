import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from './detection.js';

const docsUrl = docsUrlFor('seo/single-h1');
const recommendation = 'Use exactly one <h1> per page for its main topic; demote extra top-level headings to <h2>+.';

/**
 * seo/single-h1 — Heading hierarchy (single H1). Reads the per-route page-body headings
 * channel (collected by both providers). Zero <h1> (no primary heading) and two
 * or more (diluted topic) are both flagged; exactly one passes. A route whose
 * headings were not collected (channel unset) emits nothing.
 */
export const seoSingleH1: Rule = {
  id: 'seo/single-h1',
  title: 'Heading hierarchy',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'Each page should have exactly one <h1> naming its main topic; none leaves the page without a primary heading, and several dilute the topic signal.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const route of ctx.headings ?? []) {
      const h1 = route.headings.filter((h) => h.level === 1);
      let problem: string | undefined;
      let where: { location?: string; line?: number } = {};
      if (h1.length === 0) {
        problem = 'Missing <h1>';
        const first = route.headings[0];
        if (first) where = { location: first.file, ...(first.line > 0 ? { line: first.line } : {}) };
      } else if (h1.length > 1) {
        problem = `Multiple <h1> (${h1.length}); use exactly one`;
        const extra = h1[1]!;
        where = { location: extra.file, ...(extra.line > 0 ? { line: extra.line } : {}) };
      }
      out.push(
        problem
          ? {
              id: 'seo/single-h1',
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: route.route,
              ...where,
              message: problem,
              recommendation,
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
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
