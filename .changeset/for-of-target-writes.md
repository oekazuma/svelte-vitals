---
'svelte-vitals': patch
---

A `for…of` or `for…in` loop whose head declares nothing now counts as a write to its target, as an `=` assignment already did. On an imported binding (`for (state.x of rows)`, `for ([state.a] of rows)`), `security/handler-state-write` reports the write when it is in a handler, which takes that import out of `security/shared-state-import` as any handler write does, and `security/shared-state-import` reads one outside handlers as mutating the import rather than only reading it. On a module-scope `let`/`var` (`for (last of rows)`), `security/server-module-state` reports it. A loop that declares its variable (`for (const r of rows)`) is not a write. These findings can be new in your project. Suppression entries are keyed by rule, route and file, so a file that already has recorded entries for one of these rules has the new findings suppressed too.
