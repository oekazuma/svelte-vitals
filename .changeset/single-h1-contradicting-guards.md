---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` and `seo/heading-level-skip` read two headings in one file as never rendering together when both sit below `{#if}` blocks without an `{:else}` and their conditions cannot all hold, such as `{#if (open && !hide) || always}` against `{#if (!open || hide) && !always}`, or `{#if a || b}` against `{#if !a}` with `{#if !b}` inside it.
