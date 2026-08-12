import type { Result } from '../../types.js';
import { docsUrlFor, type Rule, type RuleContext } from '../../rule.js';
import type { SuppressionDirective } from '../../component.js';
import type { KitModuleFacts } from '../../kit-module.js';
import { isSuppressed } from '../component-rule.js';
import { PENALIZED, PASS } from '../seo/detection.js';

const ID = 'correctness/orphan-lifecycle';
const DOCS_URL = docsUrlFor(ID);
const LABEL = 'Lifecycle-call context';
const RECOMMENDATION =
  "Call lifecycle/context functions during component initialisation (the top level of a component's <script>). In load, return the data and call setContext in a layout/page component; in shared modules, expose a setup function that components call during init.";

const topLevelMessage = (name: string) =>
  `${name}() runs at module evaluation, outside component initialisation — it throws lifecycle_outside_component at runtime`;

/**
 * Context functions throw `lifecycle_outside_component` in every environment (verified against
 * svelte 5.56.8's `internal/{client,server}/context.js`). The other five — onMount, onDestroy,
 * beforeUpdate, afterUpdate, createEventDispatcher — only throw on the client (`src/index-client.js`);
 * on the server (`src/index-server.js`) onMount/beforeUpdate/afterUpdate/createEventDispatcher are
 * aliased to a noop, and onDestroy has no component-context guard of its own so it throws a plain
 * TypeError instead.
 */
const ALWAYS_THROWS = new Set(['getContext', 'setContext', 'hasContext', 'getAllContexts']);

/**
 * Kit-module message for one lifecycle/context call. `kind === 'server'` means the file only
 * ever runs on the server (+*.server.ts, +server.ts, hooks.server.ts) — there the "throws
 * lifecycle_outside_component" claim is false for everything but the context four. A
 * `kind === 'universal'` file (+page.ts/+layout.ts) also runs in the browser, where all nine
 * still throw, so its message is unchanged.
 */
function kitLifecycleMessage(name: string, kind: KitModuleFacts['kind'], inHandler: boolean): string {
  if (kind === 'server' && !ALWAYS_THROWS.has(name)) {
    const where = inHandler
      ? `${name}() is called in a load/handler, outside component initialisation`
      : `${name}() runs outside component initialisation (module evaluation or the init hook)`;
    return name === 'onDestroy'
      ? `${where} — on the server it still crashes, but with a plain TypeError, not lifecycle_outside_component (onDestroy has no component-context guard there)`
      : `${where} — on the server this is a silent no-op (it throws lifecycle_outside_component only if this module also runs in the browser)`;
  }
  return inHandler
    ? `${name}() is called in a load/handler — it runs on every request, outside component initialisation, and throws lifecycle_outside_component at runtime`
    : `${name}() runs outside component initialisation (module evaluation or the init hook) — it throws lifecycle_outside_component at runtime`;
}

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
 * correctness/orphan-lifecycle — svelte lifecycle/context calls guaranteed to run outside component
 * initialisation: module scope in runes modules / `<script module>`, the constructor of
 * a module-scope-instantiated class, and Kit load/handler/`init` bodies. A custom check
 * because the facts live on BOTH the component channel and the Kit-module channel.
 */
export const correctnessOrphanLifecycle: Rule = {
  id: ID,
  title: 'Lifecycle call outside component initialisation',
  category: 'correctness',
  severity: 'critical',
  scope: 'component',
  rationale:
    'Svelte lifecycle and context functions require an active component context; called at module scope, in a shared-state class constructor, or in a load/handler they throw lifecycle_outside_component at runtime — the compiler does not catch it, and it surfaces as a production crash. Exception: in a Kit module that only ever runs on the server (+page.server.ts, +server.ts, hooks.server.ts), onMount/beforeUpdate/afterUpdate/createEventDispatcher are silent no-ops there instead, and onDestroy throws a plain TypeError rather than lifecycle_outside_component — only getContext/setContext/hasContext/getAllContexts still throw in that channel.',
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
          message: kitLifecycleMessage(l.name, m.kind, l.inHandler)
        })),
        m.suppressions
      );
    }
    return out;
  }
};
