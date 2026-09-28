---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/single-h1` and `seo/heading-level-skip` read `{#if}` blocks without an `{:else}` in one arm (no other block, `{#each}` or component between them) whose conditions contradict each other on one value (`{#if pitch}` and `{#if !pitch}`, `{#if step === 0}` and `{#if step === 1}`, also as one condition of an `&&`) as arms of one block, so an `<h1>` in each no longer counts as two.
