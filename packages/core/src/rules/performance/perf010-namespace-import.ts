import { componentRule } from '../component-rule.js';

export const perf010NamespaceImport = componentRule({
  id: 'PERF010',
  title: 'Namespace import',
  category: 'performance',
  severity: 'info',
  label: 'No namespace imports',
  recommendation:
    "Use named imports (import { x } from 'pkg') instead of import * as — a namespace import keeps the whole module in the bundle.",
  rationale:
    'A namespace import (import * as X) forces the bundler to retain the entire module, so unused exports cannot be tree-shaken out.',
  applies: (c) => c.namespaceImports.length > 0,
  bad: (c) => {
    // Dedupe by source (a package imported as a namespace twice isn't double-penalized),
    // reporting the earliest line — collection order is module-then-instance, which isn't
    // always source order, so take the minimum line per source rather than first-seen.
    const minLine = new Map<string, number>();
    for (const ns of c.namespaceImports) {
      const prev = minLine.get(ns.source);
      if (prev === undefined || ns.line < prev) minLine.set(ns.source, ns.line);
    }
    return [...minLine.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([source, line]) => ({
        line,
        message: `Namespace import "* as … from '${source}'" — prefer named imports so the bundler can tree-shake`
      }));
  }
});
