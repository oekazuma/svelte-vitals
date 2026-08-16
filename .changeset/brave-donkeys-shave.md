---
'@svelte-vitals/core': patch
---

Correct three a11y rules' element and grammar tables.

- **`a11y/interactive-nesting`** reused the whole interactive-role set for its container check, so
  `role="gridcell"` holding a button — the documented grid pattern — and the ARIA 1.1
  `role="combobox"` wrapping its own `<input>` were both reported as nesting defects. Containers
  are now the roles whose descendants a user agent does not expose at all, plus `link`.
- **`a11y/require-datetime`** implemented five of the ten `<time>` content syntaxes the HTML spec
  permits, so a week (`2026-W33`), a time-zone offset (`+09:00`, `Z`), the alternative duration
  spelling (`4h 18m 3s` — how recipes and media lengths are written), and years of four **or more**
  digits were reported as "not machine-readable".
- **`a11y/use-list`** flagged text that merely follows an interpolation, so
  `<p>{count} - results found</p>` read as a bullet, and flagged a leading dash inside `<pre>`,
  `<code>`, `<kbd>`, `<samp>` and `<textarea>`, where it is content. The `<br>`-separated bullets
  WCAG H48 names are unchanged.

All three narrow detection, so recorded suppressions keep matching.
