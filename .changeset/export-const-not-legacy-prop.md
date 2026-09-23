---
'@svelte-vitals/core': patch
---

A runes component with an `export const` (an instance export) is no longer treated as a legacy `export let` component. The export was counted as a legacy prop, which gave `correctness/stale-prop-derivation` the legacy-mode message on runes components.
