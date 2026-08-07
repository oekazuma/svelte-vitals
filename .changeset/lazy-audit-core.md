---
'@svelte-vitals/core': minor
---

Remove the unused `routeBadges` option from `buildHtmlDocument`. The parameter had no callers; badges in the HTML report now always start empty and are populated by the embedded snapshot as before. Also drops an internal `Intl.Segmenter` availability fallback — every supported runtime (Node >= 22.13, all target browsers) ships full ICU.
