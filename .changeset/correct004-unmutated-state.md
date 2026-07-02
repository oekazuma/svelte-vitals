---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **CORRECT004 (unmutated $state)** — a Correctness/reactivity rule from #69.
Flags a `let x = $state(...)` that is never written or escaped anywhere in the
component (no reassignment, member/method mutation, bind, call-arg, or
component-prop pass), so its reactivity is unused — use `const` (or `$state.raw`
if only reassigned wholesale). Reported under `correctness` (info). `ComponentFacts`
gains `constableStates`.
