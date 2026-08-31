---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Add `runAnalysis` to core: rule execution plus the correction sequence (configured severities, overrides, inline directives, failed-rule weight correction) as one function. The CLI, the Vite build analysis, and the dev-server handle all run it instead of each replaying the sequence; findings do not change.
