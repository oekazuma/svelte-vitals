import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { visibleLength } from './text-metrics.js';
import { PENALIZED, PASS } from './detection.js';

export interface LengthRuleOptions {
  id: string;
  title: string;
  label: string;
  noun: string;
  match: (t: HeadTag) => boolean;
  min: number;
  max: number;
  recommendation: string;
  rationale: string;
}

/** Build a route-scoped length rule that runs only on a static (captured) title/description text. */
export function lengthRule(opts: LengthRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: 'info',
    scope: 'route',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const head of ctx.heads) {
        const tag = head.tags.find(opts.match);
        // No tag, or dynamic/absent text → presence is seo/title-presence's or
        // seo/description-presence's concern, emit nothing.
        if (!tag || typeof tag.text !== 'string') continue;
        const len = visibleLength(tag.text);
        let problem: string | undefined;
        if (len < opts.min) problem = `${opts.noun} is too short (${len} chars; aim for ${opts.min}–${opts.max})`;
        else if (len > opts.max) problem = `${opts.noun} is too long (${len} chars; aim for ${opts.min}–${opts.max})`;
        out.push(
          problem
            ? {
                id: opts.id,
                category: 'seo',
                severity: 'info',
                detection: PENALIZED,
                route: head.route,
                location: tag.file ?? head.file,
                message: problem,
                recommendation: opts.recommendation,
                docsUrl
              }
            : {
                id: opts.id,
                category: 'seo',
                severity: 'info',
                detection: PASS,
                route: head.route,
                message: opts.label,
                recommendation: opts.recommendation,
                docsUrl
              }
        );
      }
      return out;
    }
  };
}
