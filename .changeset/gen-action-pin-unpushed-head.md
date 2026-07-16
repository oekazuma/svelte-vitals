---
'svelte-vitals': patch
---

Fix `ci install`/`ci upgrade` to never pin `@svelte-vitals/action` to a commit SHA that isn't actually on `origin/main` yet. The pin is generated at build time from `git rev-parse HEAD`; if a local build runs before that commit is pushed (e.g. testing against a `pnpm link`ed checkout), the generated GitHub Actions workflow referenced an unresolvable action and every PR's CI job failed. The generator now falls back to the nearest ancestor commit that is on `origin/main` when HEAD itself isn't reachable there.
