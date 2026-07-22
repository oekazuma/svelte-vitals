import { componentRule } from '../component-rule.js';

export const correctnessInstanceBrowserGlobal = componentRule({
  id: 'correctness/instance-browser-global',
  title: 'Browser global during component initialisation',
  category: 'correctness',
  label: 'Server-safe component init',
  recommendation:
    'Move browser-only code into onMount or $effect (they never run on the server), or guard it with browser from $app/environment (or a typeof check).',
  rationale:
    'A component instance script runs on the server on every SSR render, where window/document/localStorage do not exist. Warning, not critical: a component rendered only behind a parent {#if browser} (or a client-only dynamic import) is a legitimate pattern that static analysis cannot prove cross-file.',
  applies: (c) => (c.browserGlobalRefs ?? []).some((r) => r.context === 'instance'),
  bad: (c) =>
    (c.browserGlobalRefs ?? [])
      .filter((r) => r.context === 'instance')
      .map((r) => ({
        line: r.line,
        message: `${r.name} is accessed during component initialisation — during SSR this runs on the server, where ${r.name} is not defined`
      }))
});
