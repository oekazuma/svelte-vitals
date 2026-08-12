import type { Category, Fix, Result, Severity } from '../../types.js';
import type { ImageInfo } from '../../images.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import { PENALIZED, PASS } from '../detection.js';

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

/**
 * Shared engine behind `imageRule` and `linkRule`: per route, check each relevant item
 * against `ok`. A route with no relevant item has no signal: emit nothing so it is
 * neither penalized nor seeded. A clean route gets one PASS result (seeding it at 100
 * for the per-category score; a passing result carries no `fix` — there is nothing to
 * remediate); each offending item gets one PENALIZED result. PASS results carry the
 * group's own attributed file (design 2026-08-08-pass-result-location-design.md — the
 * two inline PASS literals this replaces were both added to that spike's blast-radius
 * table by maintainer ruling, same date).
 */
export function routeItemRule<T>(spec: {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  label: string;
  recommendation: string;
  rationale: string;
  fix?: Fix;
  /** One group per route: its relevant items plus the file a PASS result is attributed to. */
  groups: (ctx: RuleContext) => { route: string; items: T[]; passLocation: string }[];
  ok: (item: T) => boolean;
  location: (item: T, passLocation: string) => string;
  line?: (item: T) => number;
}): Rule {
  const docsUrl = docsUrlFor(spec.id);
  return {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    severity: spec.severity,
    scope: 'route',
    rationale: spec.rationale,
    ...(spec.fix ? { fix: spec.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const g of spec.groups(ctx)) {
        if (g.items.length === 0) continue;
        const bad = g.items.filter((item) => !spec.ok(item));
        if (bad.length === 0) {
          out.push({
            id: spec.id,
            category: spec.category,
            severity: spec.severity,
            detection: PASS,
            route: g.route,
            location: g.passLocation,
            message: spec.label,
            recommendation: spec.recommendation,
            docsUrl
          });
          continue;
        }
        for (const item of bad) {
          const line = spec.line?.(item);
          out.push({
            id: spec.id,
            category: spec.category,
            severity: spec.severity,
            detection: PENALIZED,
            route: g.route,
            location: spec.location(item, g.passLocation),
            ...(line !== undefined && line > 0 ? { line } : {}),
            message: `Missing ${spec.label}`,
            recommendation: spec.recommendation,
            docsUrl,
            // Copy per finding: spec.fix is a rule-level template shared across all
            // results this rule emits; a fresh object keeps findings independent.
            ...(spec.fix ? { fix: { ...spec.fix } } : {})
          });
        }
      }
      return out;
    }
  };
}

/** Build a route-scoped <img> rule that checks each image against `ok` (issue #10). */
export function imageRule(opts: ImageRuleOptions): Rule {
  return routeItemRule<ImageInfo>({
    ...opts,
    category: opts.category ?? 'performance',
    // No single route-level file exists here (unlike ResolvedHead.file) — the route's
    // first image stands in as its attributed file; empty routes are filtered first,
    // so `[0]` is always defined.
    groups: (ctx) =>
      (ctx.images ?? [])
        .filter((r) => r.images.length > 0)
        .map((r) => ({ route: r.route, items: r.images, passLocation: r.images[0]!.file })),
    location: (img) => img.file,
    line: (img) => img.line
  });
}
