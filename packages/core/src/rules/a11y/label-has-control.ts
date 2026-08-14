import { componentRule } from '../component-rule.js';

export const a11yLabelHasControl = componentRule({
  id: 'a11y/label-has-control',
  title: '<label> has no associated control',
  category: 'a11y',
  label: 'Label associations',
  rationale:
    'A `<label>` with no associated control is announced by assistive technology as plain text — clicking or tapping it does not focus the field, and a screen reader gives no relationship between the label and its control.',
  recommendation: "Add a `for` attribute pointing at the control's `id`, or wrap the control inside the `<label>`.",
  applies: (c) => (c.unassociatedLabels ?? []).length > 0,
  bad: (c) => (c.unassociatedLabels ?? []).map((f) => ({ line: f.line, message: '<label> has no associated control' }))
});
