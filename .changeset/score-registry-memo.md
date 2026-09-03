---
'@svelte-vitals/core': patch
---

Memoize the rule-registry projection (`selectRules` → `buildInventory` / `ruleScopes`) that `computeScore` rebuilt on every call. Per-route scoring in the JSON report and the dashboard snapshot no longer pays a 105-rule filter and two Map builds per call; report output is byte-identical (verified against the kitchen-sink gallery). Measured on a synthetic 1,681-route result set, `buildJsonReport` runs roughly 5× faster (tens of milliseconds saved per report; the absolute numbers depend on the machine).
