import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { SuppressionDirective } from '../../component.js';
import { isSuppressed } from '../component-rule.js';
import { PENALIZED, PASS } from '../detection.js';

const ID = 'correctness/server-browser-global';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Server-safe module code';
const RECOMMENDATION =
  'Move browser-only code into onMount or $effect (they never run on the server), or guard it with browser from $app/environment (or a typeof check).';

const moduleMessage = (name: string) =>
  `${name} is accessed at module scope — it does not exist on the server, so importing this file crashes SSR with "${name} is not defined"`;

/** Emit one file's PASS/PENALIZED results — same shapes as componentRule/kitModuleRule. */
function emitFile(
  out: Result[],
  file: string,
  issues: { line: number; message: string }[],
  suppressions: SuppressionDirective[] | undefined
): void {
  const bad = issues.filter((b) => !(b.line > 0 && isSuppressed(suppressions, ID, b.line)));
  if (bad.length === 0) {
    out.push({
      id: ID,
      category: 'correctness',
      severity: 'critical',
      detection: PASS,
      route: file,
      // Uniform PASS-result attribution (design 2026-08-08-pass-result-location-design.md):
      // same location a penalized result for this file would carry.
      location: file,
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
 * correctness/server-browser-global — browser globals read in server-executed MODULE code: module scope of
 * runes modules / `<script module>`, and Kit route/hooks files (top level, handler
 * bodies, the `init` hook). All of it runs on the server, where these globals do not
 * exist — SSR crashes with a ReferenceError. Instance-script reads are correctness/instance-browser-global's
 * (warning) territory. A custom check because the facts live on both channels.
 */
export const correctnessServerBrowserGlobal: Rule = {
  id: ID,
  title: 'Browser global in server module code',
  category: 'correctness',
  severity: 'critical',
  scope: 'component',
  rationale:
    'window, document, localStorage and friends do not exist on the server; a read in module scope or a load/handler crashes SSR with a ReferenceError — the compiler does not catch it, and it surfaces as a production 500.',
  async check(ctx: RuleContext): Promise<Result[]> {
    const out: Result[] = [];
    for (const c of ctx.components ?? []) {
      const refs = (c.browserGlobalRefs ?? []).filter((r) => r.context === 'module');
      if (refs.length === 0) continue;
      emitFile(
        out,
        c.file,
        refs.map((r) => ({ line: r.line, message: moduleMessage(r.name) })),
        c.suppressions
      );
    }
    for (const m of ctx.kitModules ?? []) {
      const refs = m.browserGlobalRefs ?? [];
      if (refs.length === 0) continue;
      emitFile(
        out,
        m.file,
        refs.map((r) => ({
          line: r.line,
          message: r.inHandler
            ? `${r.name} is accessed in a load/handler — it runs on the server during SSR, where ${r.name} is not defined`
            : moduleMessage(r.name)
        })),
        m.suppressions
      );
    }
    return out;
  }
};
