---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Fix a false negative in `performance/minify-disabled` (`findMinifyDisabled`): a `satisfies`/`as`-wrapped object literal reached only on the 4th (final) identifier/call-argument resolution hop was left unwrapped and silently treated as unresolvable.
