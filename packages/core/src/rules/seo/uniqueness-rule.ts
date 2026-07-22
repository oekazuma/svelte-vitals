import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { PENALIZED, PASS } from './detection.js';
import { collapseWhitespace } from './text-metrics.js';

export interface UniquenessRuleOptions {
  id: string;
  title: string;
  label: string;
  noun: string;
  match: (t: HeadTag) => boolean;
  recommendation: string;
  rationale: string;
}

/**
 * Build a route-scoped rule that flags a static title/description duplicated across
 * routes. A route-scoped rule still sees every route in `ctx.heads`, so it can
 * group by normalized text. Dynamic/absent values (no captured `text`) are skipped.
 */
export function uniquenessRule(opts: UniquenessRuleOptions): Rule {
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
        const text = collapseWhitespace(tag.text);
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
