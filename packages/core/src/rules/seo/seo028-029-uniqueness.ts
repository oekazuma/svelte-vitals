import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { PENALIZED, PASS } from './detection.js';

interface UniquenessRuleOptions {
  id: string;
  title: string;
  label: string;
  noun: string;
  match: (t: HeadTag) => boolean;
  recommendation: string;
  rationale: string;
}

/** Normalize captured text the same way visibleLength measures it (trim + collapse whitespace). */
function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Build a route-scoped rule that flags a static title/description duplicated across
 * routes. A route-scoped rule still sees every route in `ctx.heads`, so it can
 * group by normalized text. Dynamic/absent values (no captured `text`) are skipped.
 */
function uniquenessRule(opts: UniquenessRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: 'warning',
    scope: 'route',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      // Gather (head, tag, normalized text) for every route with captured text.
      const entries: { route: string; file: string; text: string }[] = [];
      const counts = new Map<string, number>();
      for (const head of ctx.heads) {
        const tag = head.tags.find(opts.match);
        if (!tag || typeof tag.text !== 'string') continue;
        const text = normalize(tag.text);
        if (text.length === 0) continue;
        entries.push({ route: head.route, file: tag.file ?? head.file, text });
        counts.set(text, (counts.get(text) ?? 0) + 1);
      }
      return entries.map((e) => {
        const n = counts.get(e.text) ?? 1;
        return n > 1
          ? {
              id: opts.id,
              category: 'seo',
              severity: 'warning',
              detection: PENALIZED,
              route: e.route,
              location: e.file,
              message: `${opts.noun} is duplicated across ${n} routes`,
              recommendation: opts.recommendation,
              docsUrl
            }
          : {
              id: opts.id,
              category: 'seo',
              severity: 'warning',
              detection: PASS,
              route: e.route,
              message: opts.label,
              recommendation: opts.recommendation,
              docsUrl
            };
      });
    }
  };
}

export const seo028TitleUnique = uniquenessRule({
  id: 'SEO028',
  title: 'Duplicate title',
  label: 'Unique title',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  recommendation: 'Give each route a unique <title> that describes that page specifically.',
  rationale:
    'Duplicate titles across pages make them compete in search results and weaken each page’s relevance signal.'
});

export const seo029DescriptionUnique = uniquenessRule({
  id: 'SEO029',
  title: 'Duplicate description',
  label: 'Unique description',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  recommendation: 'Write a unique meta description per route so each search snippet is page-specific.',
  rationale:
    'Duplicate meta descriptions give search engines no per-page summary, so they are often ignored or rewritten.'
});
