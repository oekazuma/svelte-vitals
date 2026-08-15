import type { Category, Fix, Result, RuleOptions, Severity } from '../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../rule.js';
import type { ComponentFacts, SuppressionDirective } from '../component.js';
import { compileOverrides } from '../config-apply.js';
import { resolveRuleOptions, type RuleOptionsSpec } from '../rule-options.js';
import { PENALIZED, PASS } from './detection.js';

/** An offending occurrence in a source file (line + human message). */
export interface ComponentIssue {
  line: number;
  message: string;
}

/** Categories that component-scoped rules report under (CLI/static source analysis). */
export type ComponentCategory = Extract<Category, 'correctness' | 'security' | 'architecture' | 'performance' | 'a11y'>;

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
 * Whether `ruleId`'s finding on `line` is silenced by an inline directive in this file.
 * Exported so hand-written rules that also operate on per-file facts
 * (`architecture/private-scope-import`, the correctness kit-module rules) honour the
 * same directives without their own copies of the matching logic.
 */
export function isSuppressed(suppressions: SuppressionDirective[] | undefined, ruleId: string, line: number): boolean {
  return (suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ruleId)));
}

/**
 * Shared engine behind `componentRule` and `kitModuleRule`: iterate one kind of per-file
 * facts, honour inline suppressions, and emit one PASS result per clean file or one
 * PENALIZED result per offending occurrence. Findings use the source file as the scoring
 * unit (`route` + `location` = file); PASS results carry the same location a penalized
 * result for the file would (design 2026-08-08-pass-result-location-design.md).
 */
export function fileRule<F extends { file: string; suppressions?: SuppressionDirective[] }>(spec: {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  label: string;
  recommendation: string | ((o: RuleOptions) => string);
  rationale: string;
  options?: RuleOptionsSpec;
  fix?: Fix;
  facts: (ctx: RuleContext) => F[] | undefined;
  applies: (f: F, o: RuleOptions, ctx: RuleContext) => boolean;
  bad: (f: F, o: RuleOptions, ctx: RuleContext) => ComponentIssue[];
}): Rule {
  const docsUrl = docsUrlFor(spec.id);
  return {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    severity: spec.severity,
    scope: 'component',
    rationale: spec.rationale,
    ...(spec.fix ? { fix: spec.fix } : {}),
    ...(spec.options ? { options: spec.options } : {}),
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      // Hoisted: compiling every override's globs once, not once per file.
      const compiled = compileOverrides(ctx.config);
      for (const f of spec.facts(ctx) ?? []) {
        const o = resolveRuleOptions(spec.id, spec.options, ctx.config, { route: f.file, file: f.file }, compiled);
        if (!spec.applies(f, o, ctx)) continue; // no signal in this file → neither penalize nor seed
        const recommendation = typeof spec.recommendation === 'function' ? spec.recommendation(o) : spec.recommendation;
        const bad = spec.bad(f, o, ctx).filter((b) => !(b.line > 0 && isSuppressed(f.suppressions, spec.id, b.line)));
        if (bad.length === 0) {
          out.push({
            id: spec.id,
            category: spec.category,
            severity: spec.severity,
            detection: PASS,
            route: f.file,
            location: f.file,
            message: spec.label,
            recommendation,
            docsUrl
          });
          continue;
        }
        for (const b of bad) {
          out.push({
            id: spec.id,
            category: spec.category,
            severity: spec.severity,
            detection: PENALIZED,
            route: f.file,
            location: f.file,
            ...(b.line > 0 ? { line: b.line } : {}),
            message: b.message,
            recommendation,
            docsUrl,
            ...(spec.fix ? { fix: { ...spec.fix } } : {})
          });
        }
      }
      return out;
    }
  };
}

/**
 * Build a component-scoped rule (Correctness/Security) over `ctx.components`. CLI/static
 * only — `ctx.components` is unset in rendered mode, so it emits nothing there.
 */
export function componentRule(opts: ComponentRuleOptions): Rule {
  return fileRule<ComponentFacts>({
    ...opts,
    severity: opts.severity ?? 'warning',
    facts: (ctx) => ctx.components
  });
}
