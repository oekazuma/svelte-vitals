import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from './detection.js';

const docsUrl = docsUrlFor('SEO026');
const recommendation =
  'Use valid hreflang codes (e.g. "en", "en-US", "x-default") and include an x-default when you have multiple language alternates.';

// Pragmatic BCP-47 subset: language (2–3 alpha) + optional script (4 alpha) +
// optional region (2 alpha or 3-digit UN M49, e.g. es-419), or the literal
// x-default. Not a full registry check — catches obvious typos like "english".
const HREFLANG_RE = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i;

function isValidHreflang(v: string): boolean {
  // hreflang values are case-insensitive, so "X-default" is valid too.
  return v.toLowerCase() === 'x-default' || HREFLANG_RE.test(v);
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
      const alternates = head.tags.filter(
        (t) => t.kind === 'link' && t.rel === 'alternate' && typeof t.hreflang === 'string'
      );
      if (alternates.length === 0) continue; // no hreflang on this route → not applicable
      const values = alternates.map((t) => t.hreflang as string);
      const badTag = alternates.find((t) => !isValidHreflang(t.hreflang as string));
      let problem: string | undefined;
      // Point the finding at the alternate's own source file (inherited from a layout),
      // falling back to the route head file, matching the SEO022/023 convention.
      let location = head.file;
      if (badTag) {
        problem = `Invalid hreflang value "${badTag.hreflang}"`;
        location = badTag.file ?? head.file;
      } else if (values.length >= 2 && !values.some((v) => v.toLowerCase() === 'x-default')) {
        problem = 'Multiple hreflang alternates without an x-default';
      }
      out.push(
        problem
          ? {
              id: 'SEO026',
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: head.route,
              location,
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
