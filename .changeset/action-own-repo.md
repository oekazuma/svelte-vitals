---
'svelte-vitals': minor
---

`ci install`/`ci upgrade` now scaffold and upgrade a reference to [oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) instead of `oekazuma/svelte-vitals/packages/action` — the first-party GitHub Action moved out of this monorepo into its own dedicated repository (following the same pattern as `changesets/action`, `pnpm/action-setup`, and `renovatebot/github-action`). This fixes two structural problems: `packages/action/dist` no longer drifts on every unrelated core/cli commit, and Renovate can now discover and propose updates to the action's pin automatically (verified empirically — the monorepo's shared git-tag namespace previously made this impossible regardless of comment format).

**Breaking:** if you have an existing generated workflow, run `npx svelte-vitals@latest ci upgrade` (or `ci install --force`) to rewrite the `uses:` line to the new repository — `ci upgrade` recognizes the old reference and migrates it automatically.
