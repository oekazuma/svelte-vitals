import { componentRule } from '../component-rule.js';

export const a11yRequireDatetime = componentRule({
  id: 'a11y/require-datetime',
  title: 'Missing datetime attribute',
  category: 'a11y',
  label: 'Time elements',
  rationale:
    'A `<time>` element with no `datetime` attribute exposes its text content as the machine-readable value, and the HTML spec requires that text to be a valid date/time. Text like "last Tuesday" reads fine but parses as nothing, so calendars, search engines and any other machine consumer get no date at all.',
  recommendation:
    'Add a `datetime` attribute with a machine-readable value, e.g. `<time datetime="2026-08-14">Aug 14</time>`.',
  applies: (c) => (c.timesMissingDatetime ?? []).length > 0,
  bad: (c) =>
    (c.timesMissingDatetime ?? []).map((f) => ({
      line: f.line,
      message: `<time> content "${f.text}" is not machine-readable and has no datetime attribute`
    }))
});
