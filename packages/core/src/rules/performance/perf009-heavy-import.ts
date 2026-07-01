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
  id: 'PERF009',
  title: 'Heavy dependency import',
  category: 'performance',
  severity: 'info',
  label: 'No heavy imports',
  recommendation: 'Import a submodule or switch to a lighter, tree-shakeable alternative.',
  rationale:
    'Importing a large, non-tree-shakeable package pulls its whole weight into the bundle even when only a fraction is used, slowing load.',
  applies: (c) => c.imports.length > 0,
  bad: (c) =>
    c.imports
      .filter((src) => src in HEAVY_PACKAGES)
      .map((src) => ({ line: 0, message: `Heavy import "${src}" — ${HEAVY_PACKAGES[src]}` }))
});
