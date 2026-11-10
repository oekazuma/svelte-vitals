# SvelteKit 3 support (2026-11-09)

## Intent

SvelteKit 3 is out, and new projects start on it. svelte-vitals must analyze a SvelteKit 3 app
as well as it analyzes a SvelteKit 2 app, and `@svelte-vitals/vite` must install and type-check in
one. SvelteKit 2 support stays.

Dropping SvelteKit 2 was considered and rejected. It would remove only a few small branches:

- the `$app/stores` read in `packages/cli/src/providers/source/parse.ts`;
- the `$app/environment` reads, which sit beside the `$app/env` ones;
- the `svelte.config.{js,ts}` readers in `packages/core/src/svelte-config-parse.ts`;
- the `$lib` / `kit.files.lib` default.

Meanwhile, 673 of the 676 corpus apps declare `@sveltejs/kit` 2, so the precision gate and the
holdout loop would lose their footing. Revisit dropping SvelteKit 2 only when most of the corpus
has moved to SvelteKit 3, and measure first.

## Goals

1. `@svelte-vitals/vite` installs, type-checks and builds against SvelteKit 2 and 3.
2. Every project fact the analyzer reads from `svelte.config` is also read from SvelteKit 3's
   home for it: the options object passed to `sveltekit(...)` in the Vite config.
3. SvelteKit 3's renamed modules and broadened server-only rules are recognised wherever the
   SvelteKit 2 equivalent already is.
4. An example app on SvelteKit 3 guards the above end to end, the way `examples/kitchen-sink`
   guards SvelteKit 2.

## Non-goals

- Removing any SvelteKit 2 path, including the `svelte.config` readers.
- Migrating `examples/kitchen-sink` to SvelteKit 3. It stays the SvelteKit 2 gallery and keeps its
  every-rule coverage meta-test. The SvelteKit 3 example does not need a sample per rule.
- Version-gating rule behaviour on the project's declared SvelteKit major, unless a corpus
  measurement shows a version-agnostic change costs SvelteKit 2 true positives (see item 5).
- New rules about SvelteKit 3 migration (for example, flagging `$app/stores` imports in a
  SvelteKit 3 app). The compiler and `sv migrate` already cover these.
- Ignoring a stale `svelte.config.js` left in a SvelteKit 3 project. The existing precedence
  already prefers the Vite plugin config whenever it carries options.

## Anti-goals

- Any change in findings on the SvelteKit 2 corpus that the `corpus.yml` gate does not account
  for. Every PR in this work runs the corpus measurement. A lost `tp` finding is a failure even
  when the SvelteKit 3 behaviour is right.

## What exists already

Some SvelteKit 3 forms are already handled, and must not be re-implemented:

- `paths.base` in the plugin config: `findKitPathsBaseInViteConfig` reads `sveltekit({ paths:
  { base } })`. Kit 2.62+ accepts the same shape, and its precedence is implemented in
  `resolveKitPathsBase`.
- `browser` from `$app/env`: `module-ast.ts` collects it beside `$app/environment`.
- `#lib` subpath imports: `withPackageImports` turns them into alias entries from the
  `package.json` `imports` field.
- Project detection without `svelte.config`: `detectProject`, `discoverApps` and `install`
  already accept a `package.json` that declares `@sveltejs/kit`.

## The work

### 1. `@svelte-vitals/vite`'s `Handle` type

`packages/vite/src/hooks/handle.ts` imports `type { Handle } from '@sveltejs/kit'`. SvelteKit 3
moved `Handle` to `@sveltejs/kit/hooks`, so the import fails there. That is why Renovate's
`chore(deps): update svelte (major)` PR fails `check`. The emitted `.d.ts` carries the same
import to users.

Replace it with a local structural type that both majors' `handle` hooks accept. It needs only
what `svelteVitalsHandle` uses: `event.route.id`, `event.url.origin`, and `resolve(event, {
transformPageChunk })`. Then widen the peer range to `"@sveltejs/kit": "^2.0.0 || ^3.0.0"`.

The SvelteKit 3 example's `src/hooks.server.ts` passes `svelteVitalsHandle()` through `sequence`
from `@sveltejs/kit/hooks`. Its type-check is the guard.

### 2. `router.type` from the plugin config

`findKitHashRouterInSvelteConfig` reads only `kit.router.type` in `svelte.config`. Two places use
the result: `kit-module.ts` (`kitHashRouter` makes every route render nothing on the server) and
`packages/vite/src/analyze.ts` (the app-shell check). A SvelteKit 3 hash-router app is read as
server-rendered, so every route-level SSR fact is wrong for it.

Add the plugin-config reading (`sveltekit({ router: { type: 'hash' } })`). Follow the precedence
in `resolveKitPathsBase`: a resolved plugin config decides, an unresolvable one stays silent, and
`svelte.config` is read only when the plugin has no options. Both call sites (cli
`providers/source/project.ts`, vite `providers/rendered/project.ts`) switch to the resolved form.

### 3. `alias` from the plugin config

`resolveKitAliases` returns `undefined` whenever the plugin carries options. Its doc comment says
this costs reach, not correctness. In SvelteKit 3 that is every project with an alias, so an
alias-imported module is never followed.

Read the top-level `alias` and `files.lib` from the plugin options, with the same entry rules as
`aliasEntriesOf` and `filesLibOf`, and compile them with `compileKitAliases` unchanged. That keeps
the `$lib` entry it prepends. Kit 2.62+ apps that configure through the plugin still have `$lib`:
`conzani/cons-system` in the corpus declares `^2.63.0` and imports `$lib` from 105 files. Today
those apps reach `$lib` through the `aliases ?? DEFAULT_KIT_ALIASES` fallbacks in
`withPackageImports` and `workspace-packages.ts`, and a returned list without `$lib` would skip
those fallbacks. In SvelteKit 3 the leftover `$lib` entry matches nothing, so it costs nothing.
No version check is needed.

The corpus cannot exercise the new reading: of its apps, only two pass plugin options and neither
sets `alias`. The gate guards the regression side (cons-system). The example app is the only
guard of the feature itself.

### 4. `dev` and `building` from `$app/env`

`kit-module-parse.ts` collects `dev` (line ~181, used by the `ssr = dev` reading) and `building`
(line ~1598, used by the always-redirect-unless-building reading) only from `$app/environment`.
Collect them from `$app/env` too, as `module-ast.ts` already does for `browser`.

Then update the rule docs (en + ja) that name `$app/environment` alone for these readings, for
example `seo/ssr-disabled`, the same way `correctness/server-browser-global` already says "or
SvelteKit 3's `$app/env`".

### 5. Server-only module locations

`libServerRoot` (`kit-module-parse.ts`) decides which `.set()`/`.update()` calls on imported
bindings count as writes to shared module state. Those writes feed `importedStateWrites`, which
`security/handler-state-write` reports and `security/shared-state-import` reads. Modules under the
resolved `$lib/server` directory are exempt, because legitimate singletons live there.
`security/server-module-state` reads only a route file's own module scope and is not affected.
SvelteKit 3 marks more modules server-only, and therefore as legitimate singleton homes:

- any `server` directory outside `src/routes` and `static`;
- any file whose name has a `server` segment (`db.server.ts`, `server.ts`).

The default is to apply that set regardless of the project's SvelteKit major. Measure it on the
corpus before deciding:

- If no `tp` finding disappears, ship it version-agnostic.
- If any does, gate the broader set on a declared SvelteKit major of 3 or more. That needs the
  major as a `Project` fact on both the CLI and the Vite side. `checkVersionFloor` already reads
  the declared range.
  - Its `leadingMajor` returns undefined for `catalog:`, `workspace:` or a missing dependency.
    Treat an undefined major as 2, which keeps today's behaviour. Following pnpm catalogs would
    add file reads that `io-budget.test.ts` counts, and that is out of scope here.
  - Under the gate, the example app declares `@sveltejs/kit` as a literal range rather than
    through the `kit3` catalog, so its silent-singleton sample still applies.

An opaque `$lib` (`files.lib` present but unreadable) keeps today's behaviour: the rules stay
silent. The new locations do not override that.

### 6. Example app and dependencies

- Example app: Add a small SvelteKit 3 app under `examples/` with its config in `vite.config.ts`
  (no `svelte.config`). It uses `#lib` imports and the `svelte-vitals` Vite plugin, with an e2e
  test in the kitchen-sink style. Plant one sample per item that has an observable effect:
  - a module behind a plugin-config alias that a rule reaches only through that alias;
  - a `dev`/`building` from `$app/env` reading;
  - a server-only singleton in a non-`$lib` `server` directory that must stay silent.

  Item 2's hash router turns the whole app into a shell, so it is guarded by unit tests, not the
  example.

- Dependencies:
  - Add a named pnpm catalog (`catalogs.kit3` in `pnpm-workspace.yaml`) with
    `@sveltejs/kit` ^3 and `@sveltejs/adapter-static` ^4, used only by the example.
  - The default catalog stays on SvelteKit 2.
  - Add a `renovate.json` rule that holds `@sveltejs/kit` below 3 and
    `@sveltejs/adapter-static` below 4 in the default catalog only. Verify Renovate's dep type for
    the default pnpm catalog against its docs before relying on it.
  - Close Renovate's `chore(deps): update svelte (major)` PR, which this replaces.
- Docs: `guides/(setup)/cli.md` (en + ja) says rules assume "SvelteKit 2+". Keep that wording,
  and add that SvelteKit 3's plugin-config home and renamed modules are read.

## Order and PRs

Ship as separate PRs, each with its corpus run:

1. Items 1 and 6 (example, catalog, Renovate rule, peer range).
2. Items 2–4.
3. Item 5, with the measurement.

This order is a suggestion. The example from PR 1 is where PRs 2 and 3 plant their e2e samples.

## Releases

Each user-facing PR carries a changeset, with `patch` for all three packages. Nothing here
removes or changes SvelteKit 2 behaviour.
