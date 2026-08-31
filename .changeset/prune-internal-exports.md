---
'@svelte-vitals/core': patch
---

Remove `READ_CONCURRENCY`, `BAND_COLOR`, `APP_STYLE`, and `settingOptions` from the `./internal` entry — no consumer imported them. `./internal` carries no semver guarantee.
