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
    // Dedupe by source so a package imported as a namespace twice isn't double-penalized.
    const seen = new Set<string>();
    const out: { line: number; message: string }[] = [];
    for (const ns of c.namespaceImports) {
      if (seen.has(ns.source)) continue;
      seen.add(ns.source);
      out.push({
        line: ns.line,
        message: `Namespace import "* as … from '${ns.source}'" — prefer named imports so the bundler can tree-shake`
      });
    }
    return out;
  }
});
