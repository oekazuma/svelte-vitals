import { componentRule } from '../component-rule.js';

export const a11yAriaHiddenFocus = componentRule({
  id: 'a11y/aria-hidden-focus',
  title: 'Focusable element hidden by aria-hidden',
  category: 'a11y',
  label: 'aria-hidden keeps focusables out',
  rationale:
    'An element inside `aria-hidden="true"` stays keyboard-reachable while assistive technology announces nothing for it — a screen reader user lands on a control that does not exist for them. The author cannot see this defect: `aria-hidden` changes nothing visually, so only assistive-technology users ever encounter it.',
  recommendation:
    'Remove `aria-hidden`, or take the element out of the tab order too (`tabindex="-1"`, `disabled`). To hide an inactive region such as a modal backdrop, prefer the `inert` attribute — it removes the subtree from both the accessibility tree and the tab order at once.',
  applies: (c) => (c.ariaHiddenFocusables ?? []).length > 0,
  bad: (c) =>
    (c.ariaHiddenFocusables ?? []).map((f) => ({
      line: f.line,
      message: f.containerTag
        ? `<${f.tag}> inside <${f.containerTag} aria-hidden="true"> is still keyboard-focusable`
        : `<${f.tag} aria-hidden="true"> is still keyboard-focusable`
    }))
});
