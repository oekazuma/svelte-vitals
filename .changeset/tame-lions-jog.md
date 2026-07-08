---
'svelte-vitals': patch
---

`svelte-vitals install` now logs the actually-resolved `@svelte-vitals/vite` version after auto-installing it (e.g. `installed @svelte-vitals/vite@0.11.1`), so a lockfile/registry cooldown (e.g. pnpm's `minimumReleaseAge`) silently resolving the install to an older release than expected is visible instead of hidden.
