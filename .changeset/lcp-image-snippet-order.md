---
'svelte-vitals': patch
---

`performance/lcp-image` no longer treats an image inside a `{#snippet}` as the page's first image because of where the snippet is defined. The image is ordered where the file first `{@render}`s the snippet, so a lazy thumbnail rendered further down the page is no longer reported as the LCP image.
