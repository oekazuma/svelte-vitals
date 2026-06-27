import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from './detection.js';

const docsUrl = docsUrlFor('SEO026');
const recommendation =
  'Use valid hreflang codes (e.g. "en", "en-US", "x-default") and include an x-default when you have multiple language alternates.';

// Pragmatic BCP-47 subset: language (2–3) + optional script (4) + optional region (2),
// or the literal x-default. Not a full registry check — catches obvious typos.
const HREFLANG_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z]{2})?$/;

function isValidHreflang(v: string): boolean {
  return v === 'x-default' || HREFLANG_RE.test(v);
}

/**
 * SEO026 — hreflang / x-default validity. Opt-in: a route with no
 * `<link rel="alternate" hreflang>` emits nothing (monolingual sites are never
 * flagged). When alternates exist, every code must be well-formed and a set of
 * two or more must declare an x-default. Works in both modes.
 */
export const seo026Hreflang: Rule = {
  id: 'SEO026',
  title: 'hreflang validity',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'A malformed hreflang code or a missing x-default breaks international targeting, so search engines may serve the wrong language version.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const values = head.tags
        .filter((t) => t.kind === 'link' && t.rel === 'alternate' && typeof t.hreflang === 'string')
        .map((t) => t.hreflang as string);
      if (values.length === 0) continue; // no hreflang on this route → not applicable
      const malformed = values.find((v) => !isValidHreflang(v));
      let problem: string | undefined;
      if (malformed !== undefined) problem = `Invalid hreflang value "${malformed}"`;
      else if (values.length >= 2 && !values.includes('x-default'))
        problem = 'Multiple hreflang alternates without an x-default';
      out.push(
        problem
          ? {
              id: 'SEO026',
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: head.route,
              location: head.file,
              message: problem,
              recommendation,
              docsUrl
            }
          : {
              id: 'SEO026',
              category: 'seo',
              severity: 'warning',
              detection: PASS,
              route: head.route,
              message: 'hreflang',
              recommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
