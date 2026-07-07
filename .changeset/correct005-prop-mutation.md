---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add CORRECT005: flag mutation of a non-`$bindable` prop destructured from `$props()` (member writes, `delete`, or a mutating method call like `.push()`). Plain reassignment of the prop itself is not flagged — Svelte's docs explicitly sanction that pattern for ephemeral state; only mutation is prohibited. Catches a class of bug the compiler never reports: mutating a plain-object prop is a silent no-op, and mutating a reactive-state-proxy prop only warns at runtime if that code path is exercised.
