import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { visibleLength } from './text-metrics.js';
import { PENALIZED, PASS } from './detection.js';

interface LengthRuleOptions {
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
function lengthRule(opts: LengthRuleOptions): Rule {
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
        // No tag, or dynamic/absent text → presence is SEO001/SEO002's concern, emit nothing.
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

export const seo022TitleLength = lengthRule({
  id: 'SEO022',
  title: 'Title length',
  label: 'Title length',
  noun: 'Title',
  match: (t) => t.kind === 'title',
  min: 30,
  max: 60,
  recommendation: 'Aim for a title of 30–60 characters so it is not truncated in search results.',
  rationale:
    'A title that is too short wastes the strongest on-page signal; one that is too long is truncated in the SERP.'
});

export const seo023DescriptionLength = lengthRule({
  id: 'SEO023',
  title: 'Description length',
  label: 'Description length',
  noun: 'Description',
  match: (t) => t.kind === 'meta' && t.name === 'description',
  min: 70,
  max: 160,
  recommendation: 'Aim for a meta description of 70–160 characters so it is not truncated in search results.',
  rationale:
    'A description that is too short under-uses the SERP snippet; one that is too long is truncated by search engines.'
});
