import type { Category, Fix, Result, Severity } from '../../types.js';
import type { ImageInfo } from '../../images.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

export interface ImageRuleOptions {
  id: string;
  title: string;
  severity: Severity;
  /** Vitals category (default 'performance'); seo/image-alt (alt text) reports under 'seo'. */
  category?: Category;
  /** Noun phrase for messages, e.g. '<img> width/height'. */
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /** Returns true when the image satisfies the rule (passes). */
  ok: (img: ImageInfo) => boolean;
}

/** Build a route-scoped <img> rule that checks each image against `ok` (issue #10). */
export function imageRule(opts: ImageRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  const category = opts.category ?? 'performance';
  return {
    id: opts.id,
    title: opts.title,
    category,
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const route of ctx.images ?? []) {
        // A route with no <img> has no Performance signal: emit nothing so it is
        // neither penalized nor seeded (a zero-image project hides the category).
        if (route.images.length === 0) continue;
        const bad = route.images.filter((img) => !opts.ok(img));
        if (bad.length === 0) {
          // One passing result per imaged route seeds it at 100 for the per-category
          // score. A passing result carries no `fix` — there is nothing to remediate.
          out.push({
            id: opts.id,
            category,
            severity: opts.severity,
            detection: { presence: 'own', value: 'static' },
            route: route.route,
            message: opts.label,
            recommendation: opts.recommendation,
            docsUrl
          });
          continue;
        }
        for (const img of bad) {
          out.push({
            id: opts.id,
            category,
            severity: opts.severity,
            detection: { presence: 'none', value: 'absent' },
            route: route.route,
            location: img.file,
            ...(img.line > 0 ? { line: img.line } : {}),
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
