import type { Fix, Severity } from '../types.js';
import type { Rule, RuleContext } from '../rule.js';
import type { KitModuleFacts } from '../kit-module.js';
import { fileRule } from './component-rule.js';

/** An offending occurrence in a Kit route/hooks file (line + human message). */
export interface KitModuleIssue {
  line: number;
  message: string;
}

export interface KitModuleRuleOptions {
  id: string;
  title: string;
  /** Kit-file rules report as Security (security/*), SEO (seo/ssr-disabled), or Performance (performance/load-waterfall, performance/sequential-awaits). */
  category: 'security' | 'seo' | 'performance';
  /** Default 'warning'. */
  severity?: Severity;
  /** Pass message / category label. */
  label: string;
  recommendation: string;
  rationale: string;
  /** Agent-actionable remediation attached to the rule and each penalized finding. */
  fix?: Fix;
  /** Whether this file carries the signal at all (no signal → emit nothing for the file). */
  applies: (m: KitModuleFacts, ctx: RuleContext) => boolean;
  /** The offending occurrences (empty → the file passes). `ctx` lets security/shared-state-import read ctx.components. */
  bad: (m: KitModuleFacts, ctx: RuleContext) => KitModuleIssue[];
}

/**
 * Build a Kit-module-scoped rule (the security kit-module rules, seo/ssr-disabled) over
 * `ctx.kitModules` — `componentRule`'s engine over a different fact source, minus rule
 * options. Static/CLI and vite build mode only — `ctx.kitModules` is unset in rendered
 * mode, so it emits nothing there.
 */
export function kitModuleRule(opts: KitModuleRuleOptions): Rule {
  return fileRule<KitModuleFacts>({
    ...opts,
    severity: opts.severity ?? 'warning',
    facts: (ctx) => ctx.kitModules,
    applies: (m, _o, ctx) => opts.applies(m, ctx),
    bad: (m, _o, ctx) => opts.bad(m, ctx)
  });
}
