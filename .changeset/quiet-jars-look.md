---
'@svelte-vitals/core': patch
---

Match the Svelte compiler on ARIA attribute casing.

HTML attribute names are case-insensitive: `ARIA-LABEL` and `ROLE` become `aria-label` and `role`
during HTML parsing, and Svelte's own compiler judges them lowercased. The **Svelte AST keeps the
source spelling**, though, and the attribute lookup matched it exactly — so an attribute written in
capitals was read as a different attribute from the one it becomes in the browser. Lookups are now
case-insensitive, and ARIA names are reported lowercased, as the compiler reports them.

This corrects findings in both directions. A capitalised typo (`ARIA-LABLE`, `ROLE="bogus"`) was
invisible while the compiler warned about it, so a project may see new findings — the same ones
`svelte-check` already reports. A **valid** capitalised attribute was equally invisible, which
produced false findings: `<button ARIA-LABEL="Save">` was reported as having no accessible name,
and `<time DATETIME="…">` as missing its `datetime`. Those go away.

Recorded while here, with no behaviour change: this rule set deliberately follows the compiler over
the letter of the ARIA spec where the two disagree. The spec lists `undefined` as a value for
several boolean attributes and says a zero-length string should be treated as absent; the compiler
rejects both, and so do we. A rule that disagreed with the build you run would be noise rather than
a second opinion. The `a11y/invalid-aria-value` page now says so in both languages.
