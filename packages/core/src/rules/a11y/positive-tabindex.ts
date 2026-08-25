import { componentRule } from '../component-rule.js';
import { literalTabindexValue } from './interactive.js';

/**
 * Literal values only — an expression-valued `tabindex` is unknowable and passes. The
 * Number()-based parse deliberately matches the Svelte compiler's own a11y_positive_tabindex
 * check, so the scanner never disagrees with the user's build (see the docs page's Overlap
 * section for the one divergence, bare `tabindex`). SVG elements are judged too, unlike the
 * deprecated-* rules' `!inSvg` filter: SVG2 honours `tabindex` with identical focus-order
 * semantics.
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
    'A tabindex greater than 0 puts the element ahead of every naturally-ordered element on the page — a single tabindex="1" reorders keyboard navigation for the whole document, and the damage compounds with every element added later. The tab order can then diverge from the visual order, which WCAG 2.4.3 (Focus Order) requires to stay meaningful.',
  fix: {
    description:
      'Replace the positive tabindex with tabindex="0" and move the element into DOM order, or tabindex="-1" if it is only focused programmatically.'
  },
  applies: (c) =>
    (c.elements ?? []).some((e) =>
      e.attrs.some((a) => a.name === 'tabindex' && literalTabindexValue(a.value) !== undefined)
    ),
  bad: (c) =>
    (c.elements ?? []).flatMap((e) => {
      const raw = e.attrs.find((a) => a.name === 'tabindex')?.value;
      if (raw === undefined) return [];
      const n = literalTabindexValue(raw);
      if (n === undefined || n <= 0) return [];
      return [
        {
          line: e.line,
          message: `tabindex="${raw.trim()}" on <${e.tag}> hijacks the tab order for the whole page — only 0 and -1 are safe values`
        }
      ];
    })
});
