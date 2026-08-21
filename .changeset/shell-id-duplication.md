---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

`a11y/id-duplication` now detects a route id colliding with an id in the `src/app.html`
shell in source mode (rendered mode always did): the finding sits on the route-side
occurrence and its message names the shell line. This is a new arm of an existing rule:
`findingKey` is `id::route::location` with no line component, so a project with an
existing suppressed `a11y/id-duplication` entry for the same route and file already has
the new finding pre-suppressed; projects without one will see new findings, and
`--update-suppressions` adopts them in one run. Diff-scoped runs (`--diff`/`--staged`)
only surface the finding when the route file changes — an edit to `src/app.html` alone
shows up on full runs.
