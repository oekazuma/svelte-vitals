import { componentRule } from '../component-rule.js';

export const a11yAccessibleName = componentRule({
  id: 'a11y/accessible-name',
  title: 'Interactive element has no accessible name',
  category: 'a11y',
  label: 'Accessible names',
  rationale:
    'A button, link, or image button with no accessible name is announced by assistive technology as its bare role ("button", "link") with nothing to distinguish it from any other control on the page.',
  recommendation:
    'Give the element visible text or an aria-label/aria-labelledby; a button or link whose only content is an icon image is named by that image\'s alt, and an <input type="image"> by its own alt.',
  applies: (c) => (c.unnamedInteractive ?? []).length > 0,
  bad: (c) => (c.unnamedInteractive ?? []).map((f) => ({ line: f.line, message: `<${f.tag}> has no accessible name` }))
});
