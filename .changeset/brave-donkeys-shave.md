---
'@svelte-vitals/core': patch
---

Correct three a11y rules' element and grammar tables.

- **`a11y/interactive-nesting`** reused the whole interactive-role set for its container check, so
  `role="gridcell"` holding a button — the documented grid pattern — and the ARIA 1.1
  `role="combobox"` wrapping its own `<input>` were both reported as nesting defects. Containers
  are now the interactive members of ARIA's children-presentational set — whose descendants user
  agents should not expose through the accessibility API — plus `link`.
- **`a11y/require-datetime`** implemented five of the ten `<time>` content syntaxes the HTML spec
  permits, so a week (`2026-W33`), a time-zone offset (`+09:00`, `Z`), the alternative duration
  spelling (`4h 18m 3s` — how recipes and media lengths are written), and years of four **or more**
  digits were reported as "not machine-readable".
- **`a11y/use-list`** flagged text that merely follows an interpolation, so
  `<p>{count} - results found</p>` read as a bullet, and flagged a leading dash inside `<pre>`,
  `<code>`, `<kbd>`, `<samp>` and `<textarea>`, where it is content. The `<br>`-separated bullets
  WCAG H48 names are unchanged.

Two narrower corrections ride along, both **widening** detection:

- The `<time>` patterns are now anchored, so `<time>2026-08-14T14:30 invalid</time>` and
  `<time>P3D invalid</time>` no longer pass on a machine-readable prefix.
- `a11y/interactive-nesting` resolved a `role` fallback list by its **first token** rather than the
  first token naming a concrete role, so `role="future-role button"` was not recognised as a
  button. It now uses the same resolution the role rules do.

Everything else here narrows detection, and recorded suppressions keep matching in either
direction.
