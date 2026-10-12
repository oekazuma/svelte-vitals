---
'svelte-vitals': patch
---

An `{#if}` whose test an imported literal-`false` flag decides through `&&` or `||` (`{#if FLAG && data.ok}`, `{#if !FLAG || …}`) is now decided as a bare `{#if FLAG}` already is, so `a11y/id-duplication`, `a11y/duplicate-landmark`, `seo/single-h1` and `seo/heading-level-skip` no longer count the arm it rules out.
