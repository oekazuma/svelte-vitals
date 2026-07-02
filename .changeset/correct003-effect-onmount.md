---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/mcp': minor
---

Add **CORRECT003 (effect used as onMount)** — the Correctness/reactivity slice of
#69. Flags an `$effect`/`$effect.pre` whose non-empty body reads no reactive value
(no `$state`/`$derived`/`$props`, no store subscription, no bare function call), so
it never re-runs and should be `onMount`. Reported under `correctness` (warning).
`EffectFact` gains `mountOnly`.
