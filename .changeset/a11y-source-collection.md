---
'svelte-vitals': minor
---

Collect Accessibility facts in source mode: a branch-aware walk of each component's template (tracking `{#if}`/`{#await}`/`{#each}` branches) folds landmark, `id`, and id-reference (`for`, `aria-labelledby`/`-describedby`/`-controls`/`-activedescendant`, `href="#…"`) occurrences across the resolved layout chain, so the new cross-component `a11y` rules see the same composed route the SEO rules already do. Also reads `src/app.html` for a `<!doctype html>` check.
