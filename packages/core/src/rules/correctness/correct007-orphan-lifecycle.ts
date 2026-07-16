import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { SuppressionDirective } from '../../component.js';

const PENALIZED = { presence: 'none', value: 'absent' } as const;
const PASS = { presence: 'own', value: 'static' } as const;

const ID = 'CORRECT007';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Lifecycle-call context';
const RECOMMENDATION =
  "Call lifecycle/context functions during component initialisation (the top level of a component's <script>). In load, return the data and call setContext in a layout/page component; in shared modules, expose a setup function that components call during init.";

const topLevelMessage = (name: string) =>
  `${name}() runs at module evaluation, outside component initialisation — it throws lifecycle_outside_component at runtime`;

function isSuppressed(suppressions: SuppressionDirective[] | undefined, line: number): boolean {
  return (suppressions ?? []).some((s) => s.line === line && (!s.ruleIds || s.ruleIds.includes(ID)));
}

/** Emit one file's PASS/PENALIZED results — same shapes as componentRule/kitModuleRule. */
function emitFile(
  out: Result[],
  file: string,
  issues: { line: number; message: string }[],
  suppressions: SuppressionDirective[] | undefined
): void {
  const bad = issues.filter((b) => !(b.line > 0 && isSuppressed(suppressions, b.line)));
  if (bad.length === 0) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'critical',
      detection: PASS,
      route: file,
      message: LABEL,
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL
    });
    return;
  }
  for (const b of bad) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'critical',
      detection: PENALIZED,
      route: file,
      location: file,
      ...(b.line > 0 ? { line: b.line } : {}),
      message: b.message,
      recommendation: RECOMMENDATION,
      docsUrl: DOCS_URL
    });
  }
}

/**
 * CORRECT007 — svelte lifecycle/context calls guaranteed to run outside component
 * initialisation: module scope in runes modules / `<script module>`, the constructor of
 * a module-scope-instantiated class, and Kit load/handler/`init` bodies. A custom check
 * because the facts live on BOTH the component channel and the Kit-module channel.
 */
export const correct007OrphanLifecycle: Rule = {
  id: ID,
  title: 'Lifecycle call outside component initialisation',
  category: 'correctness',
  severity: 'critical',
  scope: 'component',
  rationale:
    'Svelte lifecycle and context functions require an active component context; called at module scope, in a shared-state class constructor, or in a load/handler they throw lifecycle_outside_component at runtime — the compiler does not catch it, and it surfaces as a production crash.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const c of ctx.components ?? []) {
      const calls = c.orphanLifecycleCalls ?? [];
      if (calls.length === 0) continue;
      emitFile(
        out,
        c.file,
        calls.map((o) => ({
          line: o.line,
          message:
            o.kind === 'top-level'
              ? topLevelMessage(o.name)
              : `class "${o.className}" calls ${o.name}() in its constructor and is instantiated at module scope — it throws lifecycle_outside_component at runtime`
        })),
        c.suppressions
      );
    }
    for (const m of ctx.kitModules ?? []) {
      const calls = m.lifecycleCalls ?? [];
      if (calls.length === 0) continue;
      emitFile(
        out,
        m.file,
        calls.map((l) => ({
          line: l.line,
          message: l.inHandler
            ? `${l.name}() is called in a load/handler — it runs on every request, outside component initialisation, and throws lifecycle_outside_component at runtime`
            : topLevelMessage(l.name)
        })),
        m.suppressions
      );
    }
    return out;
  }
};
