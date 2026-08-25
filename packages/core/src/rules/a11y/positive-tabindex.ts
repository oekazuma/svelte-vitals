import { componentRule } from '../component-rule.js';
import { literalTabindexValue } from './interactive.js';

/**
 * a11y/positive-tabindex — a tabindex above 0 puts the element ahead of every
 * naturally-ordered element on the page, so a single `tabindex="1"` reorders keyboard
 * navigation globally and gets worse with every element added later. Only `0` (join the
 * natural order) and `-1` (programmatically focusable) are safe. Literal values only; an
 * expression-valued `tabindex` is unknowable and passes.
 */
export const a11yPositiveTabindex = componentRule({
  id: 'a11y/positive-tabindex',
  title: 'Positive tabindex',
  category: 'a11y',
  severity: 'warning',
  label: 'Tabindex values',
  recommendation:
    'Use `tabindex="0"` and put elements in DOM order for the natural tab sequence, or `tabindex="-1"` for elements focused programmatically. A positive value is essentially never intentional-and-correct.',
  rationale:
    'A tabindex greater than 0 puts the element ahead of every naturally-ordered element on the page — a single tabindex="1" reorders keyboard navigation for the whole document, and the damage compounds with every element added later. The tab order also diverges from the visual order, which WCAG 2.4.3 (Focus Order) requires to stay meaningful.',
  fix: {
    description:
      'Replace the positive tabindex with tabindex="0" and move the element into DOM order, or tabindex="-1" if it is only focused programmatically.'
  },
  applies: (c) => (c.elements ?? []).some((e) => e.attrs.some((a) => a.name === 'tabindex' && a.value !== undefined)),
  bad: (c) =>
    (c.elements ?? []).flatMap((e) => {
      const t = e.attrs.find((a) => a.name === 'tabindex');
      if (t?.value === undefined) return [];
      const n = literalTabindexValue(t.value);
      if (n === undefined || n <= 0) return [];
      return [
        {
          line: e.line,
          message: `tabindex="${t.value.trim()}" on <${e.tag}> hijacks the tab order for the whole page — only 0 and -1 are safe values`
        }
      ];
    })
});
