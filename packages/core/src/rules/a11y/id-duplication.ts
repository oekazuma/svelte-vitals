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
  map: (route) => route.ids,
  message: (id) => `Duplicate id "${id}"`,
  passMessage: 'No duplicate ids'
});
