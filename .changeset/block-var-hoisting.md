---
'svelte-vitals': patch
---

A `var` declared in a nested block (`if (c) { var items = []; }`) now binds its name for the whole function, as JavaScript hoists it, in every check that tells a local from an outer `$state`, prop or import of the same name. Code after the block that used the local was read as using the outer binding: `correctness/prop-mutation` and `security/handler-state-write` could report a write to the local, and `correctness/unmutated-state` took it as a write to the `$state` and stayed silent. A `var` in a nested function or class `static` block still binds only that scope.
