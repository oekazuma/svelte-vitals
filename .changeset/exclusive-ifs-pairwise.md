---
'svelte-vitals': patch
---

`seo/single-h1` and `seo/heading-level-skip` now read sibling `{#if}` blocks whose tests contradict pairwise on different values as arms of one block, as their docs describe: `{#if gone}`, `{#if !gone && step === 1}` and `{#if !gone && step === 2}` count one `<h1>`, not two. Strict equality to literals of different types (`step === 1`, `step === 'done'`) is read as contradicting too.
