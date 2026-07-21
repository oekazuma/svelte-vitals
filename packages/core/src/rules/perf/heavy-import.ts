import { componentRule } from '../component-rule.js';

/**
 * Well-known heavy / non-tree-shakeable packages, mapped to the lighter alternative.
 * Matched by exact specifier — a subpath import (`lodash/debounce`) is the fix, not a hit.
 */
const HEAVY_PACKAGES: Record<string, string> = {
  lodash: 'import a submodule (lodash/debounce) or use lodash-es for tree-shaking',
  moment: 'use a lighter date library (date-fns or dayjs) — moment is large and not tree-shakeable'
};

export const perf009HeavyImport = componentRule({
  id: 'performance/heavy-import',
  title: 'Heavy dependency import',
  category: 'performance',
  severity: 'info',
  label: 'No heavy imports',
  recommendation: 'Import a submodule or switch to a lighter, tree-shakeable alternative.',
  rationale:
    'Importing a large, non-tree-shakeable package pulls its whole weight into the bundle even when only a fraction is used, slowing load.',
  // ComponentFacts is a public @svelte-vitals/core export — an external caller compiled
  // against an older version may still construct one without importSpans. Fall back to the
  // line-less `imports` (line: 0, the pre-fix behavior) instead of crashing on `undefined`.
  applies: (c) => (c.importSpans ?? c.imports).length > 0,
  bad: (c) => {
    // `Object.hasOwn` (not `in`) so inherited keys like `toString` never match;
    // dedupe so the same package imported in both scripts isn't double-penalized.
    const seen = new Set<string>();
    const out: { line: number; message: string }[] = [];
    const spans = c.importSpans ?? c.imports.map((source) => ({ source, line: 0 }));
    for (const { source: src, line } of spans) {
      if (!Object.hasOwn(HEAVY_PACKAGES, src) || seen.has(src)) continue;
      seen.add(src);
      out.push({ line, message: `Heavy import "${src}" — ${HEAVY_PACKAGES[src]}` });
    }
    return out;
  }
});
