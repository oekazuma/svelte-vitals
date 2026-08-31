---
'@svelte-vitals/core': patch
---

Remove `READ_CONCURRENCY`, `BAND_COLOR`, `APP_STYLE`, and `settingOptions` from the `./internal` entry — no consumer imported them. `BAND_COLOR` had no in-core use either and is deleted outright (the HTML report's client script carries its own copy). `./internal` carries no semver guarantee.
