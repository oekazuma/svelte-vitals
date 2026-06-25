import type { Fix, Result, Severity } from '../../types.js';
import type { HeadTag } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

export interface LinkRuleOptions {
  id: string;
  title: string;
  severity: Severity;
  /** Noun phrase for messages, e.g. '`as` on a preloaded `<link>`'. */
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /** Which link tags this rule evaluates (e.g. rel === 'preload'). */
  relevant: (tag: HeadTag) => boolean;
  /** Returns true when a relevant link satisfies the rule (passes). */
  ok: (tag: HeadTag) => boolean;
}

/** Build a route-scoped Performance rule that checks each relevant <link> in the effective head. */
export function linkRule(opts: LinkRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'performance',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const head of ctx.heads) {
        const links = head.tags.filter((t) => t.kind === 'link' && opts.relevant(t));
        // No relevant link on this route → no Performance signal (mirrors imageRule).
        if (links.length === 0) continue;
        const bad = links.filter((t) => !opts.ok(t));
        if (bad.length === 0) {
          // One passing result seeds the route at 100 for the per-category score.
          out.push({
            id: opts.id,
            category: 'performance',
            severity: opts.severity,
            detection: { presence: 'own', value: 'static' },
            route: head.route,
            message: opts.label,
            recommendation: opts.recommendation,
            docsUrl
          });
          continue;
        }
        for (const _ of bad) {
          out.push({
            id: opts.id,
            category: 'performance',
            severity: opts.severity,
            detection: { presence: 'none', value: 'absent' },
            route: head.route,
            location: head.file,
            message: `Missing ${opts.label}`,
            recommendation: opts.recommendation,
            docsUrl,
            ...(opts.fix ? { fix: { ...opts.fix } } : {})
          });
        }
      }
      return out;
    }
  };
}
