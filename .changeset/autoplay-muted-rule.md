---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `correctness/autoplay-muted`: flags `<video autoplay>` without `muted`. Chrome and Safari block autoplay with audio, and a blocked autoplay does not error — the video silently never starts playing for real visitors while appearing to work in development. Only a literal `autoplay` is flagged; `muted` in any form (bare attribute, `muted={expr}`, `bind:muted`, or a spread) passes. The recommendation is to add `muted` (and typically `playsinline` for iOS).
