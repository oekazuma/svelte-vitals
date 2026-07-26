import type { Result, RuleOptions } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { HeadTag } from '../../head.js';
import { visibleLength } from './text-metrics.js';
import { PENALIZED, PASS } from './detection.js';
import { compileOverrides } from '../../config-apply.js';
import { resolveRuleOptions, type RuleOptionsSpec } from '../../rule-options.js';

export interface LengthRuleOptions {
  id: string;
  title: string;
  label: string;
  noun: string;
  match: (t: HeadTag) => boolean;
  min: number;
  max: number;
  /** Static text, or a function of the resolved options when it quotes a threshold. */
  recommendation: string | ((o: RuleOptions) => string);
  rationale: string;
}

/** Build a route-scoped length rule that runs only on a static (captured) title/description text. */
export function lengthRule(opts: LengthRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  const spec: RuleOptionsSpec = {
    min: { kind: 'integer', default: opts.min, min: 0 },
    max: { kind: 'integer', default: opts.max, min: 1 }
  };
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: 'info',
    scope: 'route',
    rationale: opts.rationale,
    options: spec,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      // Hoisted: compiling every override's globs once, not once per head.
      const compiled = compileOverrides(ctx.config);
      for (const head of ctx.heads) {
        const tag = head.tags.find(opts.match);
        // No tag, or dynamic/absent text → presence is seo/title-presence's or
        // seo/description-presence's concern, emit nothing.
        if (!tag || typeof tag.text !== 'string') continue;
        const o = resolveRuleOptions(opts.id, spec, ctx.config, { route: head.route }, compiled);
        const min = o.min as number;
        const max = o.max as number;
        const recommendation = typeof opts.recommendation === 'function' ? opts.recommendation(o) : opts.recommendation;
        const len = visibleLength(tag.text);
        let problem: string | undefined;
        if (len < min) problem = `${opts.noun} is too short (${len} chars; aim for ${min}–${max})`;
        else if (len > max) problem = `${opts.noun} is too long (${len} chars; aim for ${min}–${max})`;
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
                recommendation,
                docsUrl
              }
            : {
                id: opts.id,
                category: 'seo',
                severity: 'info',
                detection: PASS,
                route: head.route,
                message: opts.label,
                recommendation,
                docsUrl
              }
        );
      }
      return out;
    }
  };
}
