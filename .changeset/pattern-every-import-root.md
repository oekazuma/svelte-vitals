---
'svelte-vitals': patch
---

A destructuring assignment that writes into more than one import (`[first.x, second.y] = rows`, also as a `for…of` target) now counts as a write to each of them, not only to the first. In a handler, `security/handler-state-write` reports each import written, which takes them all out of `security/shared-state-import` as any handler write does. Outside handlers, `security/shared-state-import` reads each one as mutated rather than only read. These findings can be new in your project. Suppression entries are keyed by rule, route and file, so a file that already has recorded entries for one of these rules has the new findings suppressed too.
