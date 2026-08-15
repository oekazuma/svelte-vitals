import { componentRule } from '../component-rule.js';

export const a11yPlaceholderLabelOption = componentRule({
  id: 'a11y/placeholder-label-option',
  title: 'Missing placeholder label option',
  category: 'a11y',
  label: 'Select placeholder',
  rationale:
    'A required, single-selection `<select>` initially shows its first option as the chosen value — if that option is not an empty placeholder, users can submit the form without ever having made a real choice, and assistive technology announces a value as already selected.',
  recommendation: 'Make the first `<option>` a placeholder: an empty `value=""`, or no `value` attribute and no text.',
  applies: (c) => (c.selectsMissingPlaceholder ?? []).length > 0,
  bad: (c) =>
    (c.selectsMissingPlaceholder ?? []).map((f) => ({
      line: f.line,
      message: '<select required> is missing a placeholder label option'
    }))
});
