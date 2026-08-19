import { componentRule } from '../component-rule.js';
import { listOption } from '../../rule-options.js';
import type { RuleOptions } from '../../types.js';
import { ELEMENTS_OPTION } from './element-declarations.js';

const declared = (o: RuleOptions) => new Set(listOption(o, 'elements').map((t) => t.toLowerCase()));

export const a11yDisallowedElement = componentRule({
  id: 'a11y/disallowed-element',
  title: 'Disallowed element',
  category: 'a11y',
  severity: 'warning',
  label: 'No disallowed elements',
  rationale:
    'A project can decide that some elements have no place in its markup — `<iframe>` in content pages, `<font>` anywhere, a legacy custom element mid-migration — and this rule reports every occurrence of the tags it declares. It has no opinion of its own: with nothing declared it does nothing.',
  recommendation:
    'Replace the element with the one the project prefers, or narrow the declaration with an `overrides` entry for the files where it is allowed.',
  options: { elements: ELEMENTS_OPTION },
  // Every element is judged once something is declared, so a clean component passes; nothing
  // declared means nothing is judged, and the file emits no result at all.
  applies: (c, o) => declared(o).size > 0 && (c.elements ?? []).length > 0,
  bad: (c, o) => {
    const set = declared(o);
    return (c.elements ?? [])
      .filter((e) => set.has(e.tag))
      .map((e) => ({ line: e.line, message: `<${e.tag}> is disallowed by this project's configuration` }));
  }
});
