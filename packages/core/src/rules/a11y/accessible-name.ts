import { componentRule } from '../component-rule.js';

export const a11yAccessibleName = componentRule({
  id: 'a11y/accessible-name',
  title: 'Interactive element has no accessible name',
  category: 'a11y',
  label: 'Accessible names',
  rationale:
    'A button, link, or image button with no accessible name is announced by assistive technology as its bare role ("button", "link") with nothing to distinguish it from any other control on the page.',
  recommendation: 'Give the element visible text, an aria-label/aria-labelledby, or an alt on its icon image.',
  applies: (c) => (c.unnamedInteractive ?? []).length > 0,
  bad: (c) => (c.unnamedInteractive ?? []).map((f) => ({ line: f.line, message: `<${f.tag}> has no accessible name` }))
});
