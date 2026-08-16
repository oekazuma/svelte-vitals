import { componentRule } from '../component-rule.js';

export const a11yInteractiveNesting = componentRule({
  id: 'a11y/interactive-nesting',
  title: 'Interactive element nested in an interactive element',
  category: 'a11y',
  label: 'Interactive nesting',
  rationale:
    'A control nested inside another interactive element is announced and operated inconsistently across browsers and assistive technology, and inside an `<a href>` or a `<button>` it also violates the HTML content model, which forbids interactive descendants.',
  recommendation: 'Restructure the markup so each interactive control is a sibling, not a descendant, of another.',
  applies: (c) => (c.interactiveNestings ?? []).length > 0,
  bad: (c) =>
    (c.interactiveNestings ?? []).map((f) => ({
      line: f.line,
      message: `<${f.descendantTag}> is nested inside interactive <${f.containerTag}>`
    }))
});
