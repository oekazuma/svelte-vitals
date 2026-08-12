import type { Fix, Severity } from '../../types.js';
import type { HeadTag } from '../../head.js';
import type { Rule } from '../../rule.js';
import { routeItemRule } from './image-rule.js';

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
  return routeItemRule<HeadTag>({
    ...opts,
    category: 'performance',
    // The route's own head file is the PASS attribution (many links can back one pass).
    groups: (ctx) =>
      ctx.heads.map((head) => ({
        route: head.route,
        items: head.tags.filter((t) => t.kind === 'link' && opts.relevant(t)),
        passLocation: head.file
      })),
    // Point at the file the link actually came from (a layout in static mode); fall back
    // to the route's representative file when the tag carries no file (rendered mode).
    location: (tag, passLocation) => tag.file ?? passLocation
  });
}
