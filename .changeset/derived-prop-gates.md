---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A component's `{#if}` on a `$derived` that only trims or defaults a prop (`$derived(title?.trim() ?? '')`) is decided by that prop like `{#if title}`, and a call given a non-empty string literal (a translation call such as `t('Title')`) counts as non-empty text for such a test. Findings this moves can already be pre-suppressed in projects with recorded entries for the heading and a11y rules.
