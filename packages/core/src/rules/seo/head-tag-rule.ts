import type { Detection, Fix, Result, Severity } from '../../types.js';
import type { HeadTag, ResolvedHead } from '../../head.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';

export interface HeadTagRuleOptions {
  id: string;
  title: string;
  severity: Severity;
  /** Identifies the tag this rule looks for. */
  match: (tag: HeadTag) => boolean;
  /** Short human label, e.g. 'description'. */
  label: string;
  recommendation: string;
  /** Why this rule matters — surfaced by explain_rule (issue #24). */
  rationale: string;
  /** Agent-actionable remediation attached to every finding (issue #18). */
  fix?: Fix;
}

function detect(head: ResolvedHead, match: (t: HeadTag) => boolean): Detection {
  const tag = head.tags.find(match);
  return tag ? { presence: tag.presence, value: tag.value } : { presence: 'none', value: 'absent' };
}

/** Build a route-scope rule asserting the presence of a single head tag (design §11). */
export function headTagRule(opts: HeadTagRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  return {
    id: opts.id,
    title: opts.title,
    category: 'seo',
    severity: opts.severity,
    scope: 'route',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      return ctx.heads.map((head) => {
        const detection = detect(head, opts.match);
        const message =
          detection.presence === 'none'
            ? `Missing ${opts.label}`
            : detection.value === 'absent'
              ? `Empty ${opts.label}`
              : opts.label;
        return {
          id: opts.id,
          severity: opts.severity,
          detection,
          route: head.route,
          location: head.file,
          message,
          recommendation: opts.recommendation,
          docsUrl,
          // Copy per finding: opts.fix is a rule-level template shared across all
          // results this rule emits; a fresh object keeps findings independent.
          ...(opts.fix ? { fix: { ...opts.fix } } : {})
        } satisfies Result;
      });
    }
  };
}
