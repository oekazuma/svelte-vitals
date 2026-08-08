---
'@svelte-vitals/core': minor
---

`architecture/prop-count` now counts named props destructured alongside a rest element (`let { a, b, ...rest } = $props()`) instead of treating the whole destructure as uncountable and staying silent. The named count is a lower bound on the true prop count, and the rule only flags `propCount > 6`, so this can only surface findings on previously invisible components — never a false positive. A bare rest element with no named props (`let { ...rest } = $props()`) and a non-destructured `$props()` are still not counted.

Re-measured the per-repo p90 median across the same 10-repo corpus from the 2026-07-25 threshold recalibration with the fix applied: 6.5 (was 6). `MAX_PROPS` stays 6.
