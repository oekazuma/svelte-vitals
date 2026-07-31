import type { Category, Fix, Result, RuleOptions, Severity } from '../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../rule.js';
import type { ComponentFacts } from '../component.js';
import { compileOverrides } from '../config-apply.js';
import { resolveRuleOptions, type RuleOptionsSpec } from '../rule-options.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

/** An offending occurrence in a component (line + human message). */
export interface ComponentIssue {
  line: number;
  message: string;
}

/** Categories that component-scoped rules report under (CLI/static source analysis). */
export type ComponentCategory = Extract<Category, 'correctness' | 'security' | 'architecture' | 'performance'>;

export interface ComponentRuleOptions {
  id: string;
  title: string;
  /** Vitals category — 'correctness' or 'security'. */
  category: ComponentCategory;
  /** Default 'warning'. */
  severity?: Severity;
  /** Pass message / category label. */
  label: string;
  /** Static text, or a function of the resolved options when it quotes a threshold. */
  recommendation: string | ((o: RuleOptions) => string);
  rationale: string;
  /** Configurable options for this rule; absent means the rule takes none. */
  options?: RuleOptionsSpec;
  /** Agent-actionable remediation attached to the rule and each penalized finding. */
  fix?: Fix;
  /** Whether this component carries the signal at all (no signal → emit nothing for the file). */
  applies: (c: ComponentFacts, o: RuleOptions, ctx: RuleContext) => boolean;
  /** The offending occurrences in a component (empty → the file passes). */
  bad: (c: ComponentFacts, o: RuleOptions, ctx: RuleContext) => ComponentIssue[];
}

/**
 * Whether `ruleId`'s finding on `line` is silenced by an inline directive on this component.
 * Exported so a hand-written rule that also operates on `ComponentFacts`
 * (`architecture/private-scope-import`) can honour the same directives without a second copy
 * of the matching logic.
 */
export function isSuppressed(c: ComponentFacts, ruleId: string, line: number): boolean {
  return (c.suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ruleId)));
}

/**
 * Build a component-scoped rule (Correctness/Security) over `ctx.components`. CLI/static
 * only — `ctx.components` is unset in rendered mode, so it emits nothing there. Findings
 * use the source file as the scoring unit (`route` + `location` = file).
 */
export function componentRule(opts: ComponentRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  const severity = opts.severity ?? 'warning';
  return {
    id: opts.id,
    title: opts.title,
    category: opts.category,
    severity,
    scope: 'component',
    rationale: opts.rationale,
    ...(opts.fix ? { fix: opts.fix } : {}),
    ...(opts.options ? { options: opts.options } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      // Hoisted: compiling every override's globs once, not once per component.
      const compiled = compileOverrides(ctx.config);
      for (const c of ctx.components ?? []) {
        const o = resolveRuleOptions(opts.id, opts.options, ctx.config, { route: c.file, file: c.file }, compiled);
        const recommendation = typeof opts.recommendation === 'function' ? opts.recommendation(o) : opts.recommendation;
        if (!opts.applies(c, o, ctx)) continue; // no signal in this file → neither penalize nor seed
        const bad = opts.bad(c, o, ctx).filter((b) => !(b.line > 0 && isSuppressed(c, opts.id, b.line)));
        if (bad.length === 0) {
          out.push({
            id: opts.id,
            category: opts.category,
            severity,
            detection: PASS,
            route: c.file,
            message: opts.label,
            recommendation,
            docsUrl
          });
          continue;
        }
        for (const b of bad) {
          out.push({
            id: opts.id,
            category: opts.category,
            severity,
            detection: PENALIZED,
            route: c.file,
            location: c.file,
            ...(b.line > 0 ? { line: b.line } : {}),
            message: b.message,
            recommendation,
            docsUrl,
            ...(opts.fix ? { fix: { ...opts.fix } } : {})
          });
        }
      }
      return out;
    }
  };
}
