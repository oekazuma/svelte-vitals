---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`analyzeProject` accepts an optional `parseCache` (exported as `ParseCache`) that lets a caller re-analyzing the same project repeatedly reuse read+parse results across calls instead of starting fresh each time. The vite dev dashboard now keeps one `ParseCache` alive for the lifetime of the dev server and invalidates only the entry for the file that actually changed on each debounced re-analysis, so saving an unrelated file no longer re-reads and re-parses every route and layout in the project.
