import { surplusRule } from './route-rule.js';

/**
 * a11y/id-duplication — a literal id repeated within a composed route. `ctx.a11y[].ids`
 * already holds the branch-aware-folded representatives per id, so this rule only counts them.
 */
export const a11yIdDuplication = surplusRule({
  id: 'a11y/id-duplication',
  title: 'Id duplication',
  rationale:
    'A duplicate id breaks label/aria-labelledby associations and in-page fragment navigation: assistive tech resolves the first match, which may not be the one the author intended.',
  recommendation: 'Every id in a route should be unique.',
  // Entries ordered by each id's first representative (file, then line): content-derived and
  // stable — a Record's own-key enumeration would pull integer-like ids ("1") to the front.
  map: (route) =>
    Object.entries(route.ids).sort(([, a], [, b]) => a[0]!.file.localeCompare(b[0]!.file) || a[0]!.line - b[0]!.line),
  message: (id, _i, _n, first) =>
    first.file === 'src/app.html'
      ? `Duplicate id "${id}" — also defined by the src/app.html shell (line ${first.line})`
      : `Duplicate id "${id}"`,
  passMessage: 'No duplicate ids'
});
