import { componentRule } from '../component-rule.js';

export const a11yUseList = componentRule({
  id: 'a11y/use-list',
  title: 'Bullet text should be a list',
  category: 'a11y',
  severity: 'info',
  label: 'List structure',
  rationale:
    'A screen reader announces a real `<ul>`/`<ol>` as a list — item count, position, and boundaries. A bullet character typed into plain text carries none of that, so the visual structure is lost on assistive technology.',
  recommendation: 'Use a `<ul>`/`<ol>` with `<li>` items instead of a bullet character in plain text.',
  applies: (c) => (c.bulletTexts ?? []).length > 0,
  bad: (c) =>
    (c.bulletTexts ?? []).map((b) => ({
      line: b.line,
      message: `Text starts with a bullet character ('${b.char}') — use a list element`
    }))
});
