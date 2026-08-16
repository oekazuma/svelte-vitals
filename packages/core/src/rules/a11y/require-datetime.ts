import { componentRule } from '../component-rule.js';

export const a11yRequireDatetime = componentRule({
  id: 'a11y/require-datetime',
  title: 'Missing datetime attribute',
  category: 'a11y',
  label: 'Time elements',
  rationale:
    'A `<time>` element with no `datetime` attribute exposes its text content as the machine-readable value, and the HTML spec requires that text to be a valid date/time string. Text like "last Tuesday" reads fine but is not one, so the element exposes no standardized date — a consumer that wants it is left guessing at prose instead of reading a value.',
  recommendation:
    'Add a `datetime` attribute with a machine-readable value, e.g. `<time datetime="2026-08-14">Aug 14</time>`.',
  applies: (c) => (c.timesMissingDatetime ?? []).length > 0,
  bad: (c) =>
    (c.timesMissingDatetime ?? []).map((f) => ({
      line: f.line,
      message: `<time> content "${f.text}" is not machine-readable and has no datetime attribute`
    }))
});
