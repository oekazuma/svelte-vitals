---
'@svelte-vitals/core': minor
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Add `runAnalysis` to core: rule execution plus the correction sequence (configured severities, overrides, inline directives, failed-rule weight correction) as one function. The CLI, the Vite build analysis, and the dev-server handle all run it instead of each replaying the sequence; findings do not change. `applyRuleSeverities`, `applyOverrides`, and `applyInlineDirectives` leave the `./internal` entry — no consumer imports them any more; each stays exported from its source module. `./internal` carries no semver guarantee, but the removals ship as a core minor so an already-installed plugin built against the old surface is rejected loudly at install time instead of failing at import.
