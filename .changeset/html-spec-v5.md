---
'@svelte-vitals/core': patch
---

The vendored HTML spec data now comes from `@markuplint/html-spec` 5.0.0, which changes two findings:

- `a11y/disallowed-aria-props` reports `aria-label`, `aria-labelledby` and `aria-braillelabel` on `role="tooltip"`, following the dataset's ARIA 1.3 role table. Recorded suppressions for `a11y/disallowed-aria-props` already cover these findings.
- `a11y/permitted-contents` reports an HTML element placed directly inside `<math>` (e.g. `<math><b>x</b></math>`) as `info`; `<math>` now has a MathML content model instead of admitting anything. MathML children themselves are still not judged.
