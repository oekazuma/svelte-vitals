---
'@svelte-vitals/core': minor
---

`correctness/stale-prop-derivation` and `correctness/prop-mutation` now also recognize legacy-mode (`export let`) props, not just runes-mode (`$props()`) ones — the same two bugs exist under Svelte's legacy reactivity, just with a different fix (`$:` instead of `$derived`; reassign-after-mutating instead of `$bindable`), and each rule's message is tailored to whichever mode the flagged component actually uses.
