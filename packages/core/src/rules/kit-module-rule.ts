import type { Result, Severity } from '../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../rule.js';
import type { KitModuleFacts } from '../kit-module.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

/** An offending occurrence in a Kit route/hooks file (line + human message). */
export interface KitModuleIssue {
  line: number;
  message: string;
}

export interface KitModuleRuleOptions {
  id: string;
  title: string;
  /** Kit-file rules report as Security (SEC003–005) or SEO (SEO031). */
  category: 'security' | 'seo';
  /** Default 'warning'. */
  severity?: Severity;
  /** Pass message / category label. */
  label: string;
  recommendation: string;
  rationale: string;
  /** Whether this file carries the signal at all (no signal → emit nothing for the file). */
  applies: (m: KitModuleFacts, ctx: RuleContext) => boolean;
  /** The offending occurrences (empty → the file passes). `ctx` lets SEC005 read ctx.components. */
  bad: (m: KitModuleFacts, ctx: RuleContext) => KitModuleIssue[];
}

/** Whether `ruleId`'s finding on `line` is silenced by an inline directive in this file. */
function isSuppressed(m: KitModuleFacts, ruleId: string, line: number): boolean {
  return (m.suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ruleId)));
}

/**
 * Build a Kit-module-scoped rule (SEC003–005) over `ctx.kitModules`. Static/CLI and
 * vite build mode only — `ctx.kitModules` is unset in rendered mode, so it emits
 * nothing there. Findings use the source file as the scoring unit.
 */
export function kitModuleRule(opts: KitModuleRuleOptions): Rule {
  const docsUrl = docsUrlFor(opts.id);
  const severity = opts.severity ?? 'warning';
  return {
    id: opts.id,
    title: opts.title,
    category: opts.category,
    severity,
    scope: 'component',
    rationale: opts.rationale,
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const m of ctx.kitModules ?? []) {
        if (!opts.applies(m, ctx)) continue;
        const bad = opts.bad(m, ctx).filter((b) => !(b.line > 0 && isSuppressed(m, opts.id, b.line)));
        if (bad.length === 0) {
          out.push({
            id: opts.id,
            category: opts.category,
            severity,
            detection: PASS,
            route: m.file,
            message: opts.label,
            recommendation: opts.recommendation,
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
            route: m.file,
            location: m.file,
            ...(b.line > 0 ? { line: b.line } : {}),
            message: b.message,
            recommendation: opts.recommendation,
            docsUrl
          });
        }
      }
      return out;
    }
  };
}
