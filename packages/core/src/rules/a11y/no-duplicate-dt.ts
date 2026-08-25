import { componentRule } from '../component-rule.js';

/**
 * a11y/no-duplicate-dt — the candidate gathering (direct and div-wrapped `<dt>` children of a
 * `<dl>`, fully-static names only, whitespace-normalized, case-sensitive) lives in the
 * collector; see `collectDuplicateDts` in component-parse.ts for the exemption rationale.
 */
export const a11yNoDuplicateDt = componentRule({
  id: 'a11y/no-duplicate-dt',
  title: 'Duplicate <dt> names in a <dl>',
  category: 'a11y',
  severity: 'info',
  label: 'Description-list names',
  rationale:
    'Within a single dl element, there should not be more than one dt element for each name — the HTML spec calls this out explicitly, and a duplicated term usually means a copy-paste error where two descriptions were meant to share one dt.',
  recommendation:
    'Merge the descriptions under a single <dt> — one dt may be followed by several <dd> — or rename the term if the entries are genuinely different.',
  fix: {
    description: 'Merge the duplicated terms into one <dt> followed by both <dd> descriptions, or rename one of them.'
  },
  applies: (c) => (c.duplicateDts ?? []).length > 0,
  bad: (c) =>
    (c.duplicateDts ?? []).map((d) => ({
      line: d.line,
      message: `Duplicate <dt> "${d.text}" in the same <dl>`
    }))
});
