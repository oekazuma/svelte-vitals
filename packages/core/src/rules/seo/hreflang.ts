import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

const docsUrl = docsUrlFor('seo/hreflang');
const malformedRecommendation = 'Use valid hreflang codes, e.g. "en", "en-US", or the literal "x-default".';
const noDefaultRecommendation =
  'x-default is a Google recommendation, not a requirement — most useful for a language-selector or auto-redirecting page. Add one if this page behaves that way; otherwise search engines fall back to matching the individual alternates.';
const passRecommendation = 'Use valid hreflang codes (e.g. "en", "en-US", "x-default") for your language alternates.';

// Pragmatic BCP-47 subset: language (2–3 alpha) + optional script (4 alpha) +
// optional region (2 alpha or 3-digit UN M49, e.g. es-419), or the literal
// x-default. Not a full registry check — catches obvious typos like "english".
const HREFLANG_RE = /^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i;

function isValidHreflang(v: string): boolean {
  // hreflang values are case-insensitive, so "X-default" is valid too.
  return v.toLowerCase() === 'x-default' || HREFLANG_RE.test(v);
}

/**
 * seo/hreflang — hreflang / x-default validity. Opt-in: a route with no
 * `<link rel="alternate" hreflang>` emits nothing (monolingual sites are never
 * flagged). When alternates exist, every code must be well-formed and a set of
 * two or more must declare an x-default. Works in both modes.
 */
export const seoHreflang: Rule = {
  id: 'seo/hreflang',
  title: 'hreflang validity',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale:
    'A malformed hreflang code breaks international targeting outright. A missing x-default is a Google recommendation for language-selector or auto-redirecting pages, not a defect on every multilingual site.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const head of ctx.heads) {
      const alternates = head.tags.filter(
        (t) => t.kind === 'link' && t.rel === 'alternate' && typeof t.hreflang === 'string'
      );
      if (alternates.length === 0) continue; // no hreflang on this route → not applicable
      const values = alternates.map((t) => t.hreflang as string);
      const badTag = alternates.find((t) => !isValidHreflang(t.hreflang as string));
      let problem: { message: string; recommendation: string } | undefined;
      // Point the finding at the alternate's own source file (inherited from a layout),
      // falling back to the route head file, matching the seo/title-length, seo/description-length convention.
      let location = head.file;
      if (badTag) {
        problem = { message: `Invalid hreflang value "${badTag.hreflang}"`, recommendation: malformedRecommendation };
        location = badTag.file ?? head.file;
      } else if (values.length >= 2 && !values.some((v) => v.toLowerCase() === 'x-default')) {
        problem = {
          message: 'Multiple hreflang alternates with no x-default declared',
          recommendation: noDefaultRecommendation
        };
      }
      out.push(
        problem
          ? {
              id: 'seo/hreflang',
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: head.route,
              location,
              message: problem.message,
              recommendation: problem.recommendation,
              docsUrl
            }
          : {
              id: 'seo/hreflang',
              category: 'seo',
              severity: 'warning',
              detection: PASS,
              route: head.route,
              // Same `location` the penalized branch above uses (design
              // 2026-08-08-pass-result-location-design.md).
              location,
              message: 'hreflang',
              recommendation: passRecommendation,
              docsUrl
            }
      );
    }
    return out;
  }
};
