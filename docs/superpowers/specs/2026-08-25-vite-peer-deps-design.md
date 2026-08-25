# @svelte-vitals/vite peer dependencies design

Issue #583. `@svelte-vitals/vite` used to declare `svelte-vitals` and `@svelte-vitals/core` as
regular dependencies, exact-pinned at publish time (`workspace:*`). A project that also installed
the `svelte-vitals` CLI directly — the path both `svelte-vitals install` and the
`setup-svelte-vitals` skill lead to — ran **two independent cores**. When their rule registries
disagreed, a config the CLI accepted hard-failed `vite build`, and no package manager warned,
because a regular dependency is never checked against a sibling install.

## Decision

Both `svelte-vitals` **and** `@svelte-vitals/core` move to `peerDependencies`, declared as
`workspace:^`. They also join `devDependencies` (`workspace:*`) so the package's own tests and the
workspace build keep resolving them.

## Why both packages, not just svelte-vitals

`packages/vite/src` imports `@svelte-vitals/core` and `@svelte-vitals/core/internal` directly at
20+ sites (the rendered-analysis provider, the dashboard snapshot, the plugin's config plumbing).
`./internal` carries **no semver guarantee**. If only `svelte-vitals` were a peer while core stayed
a pinned dependency, the plugin would validate configs through the peer CLI's registry (its core)
but execute rendered analysis against its own pinned core — the same skew class the issue
describes, one layer down and still invisible. With both as peers, a compatible install normally
resolves one copy of each: the user's `svelte-vitals` exact-pins the core version, and vite's core
peer range is satisfied by (and checked against) that same copy — see Known residual below for the
patch-scale exception.

## Why `workspace:^`

pnpm rewrites `workspace:^` to a caret range at publish (`^0.51.1`). Pre-1.0, a caret pins the
minor — exactly the granularity that matters here: the reproduced failure was a 3-minor registry
skew, while patch-level skew is what the exact-pin era already tolerated inside one release.
`workspace:*` would publish an exact pin and warn on every patch difference (noise);
a floor range (`>=x`) would never warn on the reproduced scenario at all (the newer CLI satisfies
it), defeating the point.

## Measured: changesets behavior with workspace peers

Verified empirically on a scratch branch before adopting (the failure mode feared was changesets'
documented "major-bump peer dependents" default mint-ing an accidental 1.0.0):

- `svelte-vitals` **patch** changeset → vite untouched (the workspace range still matches).
- `svelte-vitals` **minor** changeset → vite gets a **patch** bump (0.32.3 → 0.32.4) with an
  "Updated dependencies" changelog entry — not a major, not 1.0.0.

So every CLI minor automatically ships a vite release whose published caret range covers it, and
fresh installs of both latest packages always agree.

## Known residual

With auto-installed peers, the resolver may satisfy vite's core peer with a **patch**-newer core
than the one a slightly older `svelte-vitals` exact-pins, briefly re-splitting cores at patch
scale. This is bounded by the caret (a minor skew still warns), matches the tolerance the
exact-pin era had within a release window, and self-heals when the lockfile next resolves both
from the same publish batch. Accepted.

## Consumer impact

- npm and pnpm auto-install missing non-optional peers, so `pnpm add -D @svelte-vitals/vite`
  alone still works; docs now recommend installing `svelte-vitals` alongside so the version is
  lockfile-controlled. yarn does not auto-install peers — yarn users must add both.
- Upgrading only the plugin past a CLI minor produces a peer warning until the CLI is upgraded
  too. That warning is the feature, not a bug: it is the install-time surfacing this design buys.
- The `dep-budget` ceiling for `@svelte-vitals/vite` dropped 55 → 15 (peers leave the production
  closure).

Companion changes shipped with this (independent of the peer move): the config file's
unknown-rule-id errors name the `svelte-vitals`/core versions whose registry produced the
known-ids list, and the `setup-svelte-vitals` skill's Phase 1 tells the agent to keep an installed
plugin and the CLI on peer-compatible versions.
