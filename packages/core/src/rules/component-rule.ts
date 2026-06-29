import type { Category, Result, Severity } from '../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../rule.js';
import type { ComponentFacts } from '../component.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

/** An offending occurrence in a component (line + human message). */
export interface ComponentIssue {
  line: number;
  message: string;
}

/** Categories that component-scoped rules report under (CLI/static source analysis). */
export type ComponentCategory = Extract<Category, 'correctness' | 'security'>;

export interface ComponentRuleOptions {
  id: string;
  title: string;
  /** Vitals category — 'correctness' or 'security'. */
  category: ComponentCategory;
  /** Default 'warning'. */
  severity?: Severity;
  /** Pass message / category label. */
  label: string;
  recommendation: string;
  rationale: string;
  /** Whether this component carries the signal at all (no signal → emit nothing for the file). */
  applies: (c: ComponentFacts) => boolean;
  /** The offending occurrences in a component (empty → the file passes). */
  bad: (c: ComponentFacts) => ComponentIssue[];
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
    async check(ctx: RuleContext): Promise<Result[]> {
      const out: Result[] = [];
      for (const c of ctx.components ?? []) {
        if (!opts.applies(c)) continue; // no signal in this file → neither penalize nor seed
        const bad = opts.bad(c);
        if (bad.length === 0) {
          out.push({
            id: opts.id,
            category: opts.category,
            severity,
            detection: PASS,
            route: c.file,
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
            route: c.file,
            location: c.file,
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
