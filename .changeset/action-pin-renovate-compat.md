---
'svelte-vitals': patch
---

Fix `ci install`/`ci upgrade` generating a same-line version comment (`# @svelte-vitals/action@X.Y.Z`) that Renovate's github-actions manager can't parse as a version, silently hiding the pinned action from update PRs. The comment (and this repo's own release tag for `@svelte-vitals/action`) now use a Renovate-parseable `action-vX.Y.Z` format instead. `ci upgrade` still recognizes and rewrites the old format from existing installs, even when the pinned commit is already current.
