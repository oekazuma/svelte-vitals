---
'svelte-vitals': patch
---

In a Kit route or hooks file, a class's static block and static field initializers now count as top-level code, since they run once where the class is defined. `security/server-module-state` no longer reports a module-scope `let` they reassign, such as `static { instances++ }`, as it already does not for other top-level initialisation; a method, an instance field initializer, and a class built inside a function still count as a function body. `correctness/orphan-lifecycle` now reports a lifecycle or context call (`onMount`, `getContext`, …) in a static block or static field initializer of a top-level class, which throws at module evaluation. Those findings can already be pre-suppressed in projects with recorded entries for that rule.
