# @svelte-vitals/core

## 0.36.1

### Patch Changes

- 767525a: Fix `architecture/reserved-name-placement`'s dead-declaration diagnostic naming a correct
  declaration while staying silent about a broken one. Its unit-map reason judged a declaration by
  whether its glob had happened to govern a directory, not by whether the glob could reach one: a
  convention permitting a position no directory occupies yet was reported as dead even though it was
  correct, while a unit-map glob that could never match anything (a bare glob such as
  `capitalisedUnitPlacements: { parts: 'src/lib' }`, matched against the unit itself rather than an
  ancestor of it) reported nothing at all. The excluded-directory reason had the same defect for the
  same reason: it fired on any declaration whose glob matched at least one excluded directory, even
  one that also reached a live, correctly-placed unit.

  All three reasons now ask what a declaration's glob can reach, against the same live-directory and
  live-unit sets: `matched no directory`, `matched only excluded directories`, and the unit reason —
  now `reaches no unit` — are unaffected when a glob's only matches are directories that don't yet
  exist for that name, but fire when a glob structurally cannot reach a unit of the required case or
  a directory `exclude` leaves live. The rule's findings do not change; only which declarations the
  aggregated diagnostic names.

## 0.36.0

### Minor Changes

- e25e890: Add architecture/reserved-name-placement: a reserved directory name may appear only in the places declared for it.

  Its sibling, `architecture/reserved-directory-names`, says which names a position allows; this rule says which
  positions a name allows, for names permitted in more than one kind of place at once — under a unit, under a
  grouping directory, under a route directory. It is off until you configure it: all three placement maps
  default to `{}`.

### Patch Changes

- 1020227: Document what a floored inventory is, and guard the margin the floor depends on.

  Five of the nine `(category, scope)` groups hold less than 25 points of checks, so `inventories` reports 25
  for all of them — a group with one rule and a group with eight look identical there. That number is the
  divisor a score used, not a count of what ran, and the reporters guide now says so. It also now says that
  `keys` counts per category rather than per project, so one run can show `seo` at 13 keys and `architecture`
  at 334.

  A test now fails if the floor stops ordering `info` below `warning`. That ordering holds only while the
  widest group stays under 125 points; the widest today is 110, so a few more `warning` rules there would
  re-invert them. The test turns that into a failing build rather than a silent change in what a score means.

## 0.35.0

### Minor Changes

- 8f4da14: A less severe finding now costs less than a more severe one **within the same (category, scope) pair**, and
  the report says how much of a project each category touched.

  A key's category score is the share of that category's severity weight that survived, checks grouped by
  category and scope — the keys of the new `inventories` map, like `seo::route`. **Within one pair** a
  `warning` costs five times an `info` and a `critical` fifteen times, so a more severe finding always costs
  more, there. **Across pairs it does not**: a pair that checks very little is scored against a floor of 25, so
  a `warning` there can cost more than a `critical` in a large pair — a `warning` in a floored pair costs 20
  while a `critical` in `seo::route` costs 13.64. A key is now never scored against less than 25 points of
  checks: in a one-rule pair the three severities give **96** (`info`), **80** (`warning`) and **40**
  (`critical`), where a lone `warning` used to score **0**.

  Scores rise wherever a category checks few things. **A `--min-health` gate calibrated on the previous release
  will pass more easily; recalibrate it.**

  Because a score is a mean over every key, forty affected keys and one affected key can display alike. Each
  category in the JSON report now carries `keys` and `affectedKeys`, which distinguish them exactly, and
  an `inventories` map giving the divisor behind every key of a pair, so a route's per-category score can be
  checked by hand (a route's own `score`, which can span more than one pair, cannot).

## 0.34.0

### Minor Changes

- 28d51e9: Each entry in the JSON report's `routes` array now carries a `categories` map of category name to score.

  A category's score is an average over its keys, so a category that looks wrong gives no clue which routes
  produced it. The report listed each route's findings but not what each route scored per category, and since a
  key's score became a ratio against the severity-weighted inventory of the checks it was measured against, that
  number is no longer something a reader can reconstruct by hand.

  Only the categories that produced a result on a route appear, so an absent category means "not measured here"
  rather than "perfect here". A route's `categories` values are **not guaranteed** to average to its `score`:
  `score` is one ratio over everything the route was measured against, while each category score uses that
  category's own inventory. They agree whenever every category on the route scores the same ratio — including
  every route with no findings — and can differ by several points otherwise.

## 0.33.0

### Minor Changes

- 6174836: Add `architecture/doc-link-target`, which reports a documentation link inside a component comment whose
  target no longer exists.

  Such a link has nothing to resolve it — no type refers to it, no module imports it, no test renders it — so
  a rename leaves it silently broken and only human review notices. A reorganisation that renames many units
  can break every one of them at once.

  **Off until configured.** Declare `urlRoots` with the URL prefixes that stand for your project's root; a
  link under one of them has that prefix stripped and the remainder looked up among the files under `src/`. A
  URL under no declared prefix is ignored, which is what keeps external links and documentation slugs out of
  the results — as is a remainder that lands outside `src/` (a root-level `CONTRIBUTING.md`, a `static/`
  asset), since the file inventory has no opinion there. A directory link written with its ordinary trailing
  slash resolves the same as one without.

  `ComponentFacts` gains a required `commentLinks` array carrying these links; anyone constructing a
  `ComponentFacts` directly (custom tooling, tests) needs to supply it.

- 3e3234b: `--reporter json` gains a top-level `rules` map of rule id to `{ findings, passed }`, listing every rule
  that ran.

  It answers a question the report could not: `issues` lists only failing findings, so a rule that found
  nothing left no trace — indistinguishable from a rule that was never selected. A rule present in `rules`
  ran; a rule missing from it was not selected. `passed` is also unavailable elsewhere, since `summary` is
  project-wide.

  The counts describe the report rather than the tree: baseline, suppression and `--diff` filtering are
  applied first, so a rule whose findings were all suppressed shows `findings: 0` and stays present.

- f9390f0: Category scores now reflect **how much** is wrong, not merely whether anything is.

  A key — a route or a source file — used to start at 100 and lose a fixed number of points per failing rule.
  That capped what a category could express: `architecture` is eight `info` rules, so no amount of bad code
  moved it below 92, and three more scopes bottomed out above 90. It also erased magnitude, because one
  finding moves a mean of N keys by `1/N`: on a large project, one finding and several hundred displayed the
  same score.

  A key now scores the share of what it was measured against that is intact, weighted by severity. Every
  category can reach 0, and the score moves with the number of findings.

  **Any category carrying a finding changes, most of them downward and by more than a point; a clean 100 stays 100.** `seo` and `correctness` stay within a point of their old values; `architecture`, `security` and
  `performance` move further, because their scales were the most compressed. A `--min-health` gate calibrated
  against the old numbers will start failing — recalibrate it against the new scale. `routes[].score` in the
  JSON report changes meaning the same way. Stored baselines are unaffected, since they key on findings rather
  than scores.

  Unchanged: the site-wide penalty stays in absolute points, a `critical` still caps a category at 79, and a
  displayed 100 still means no finding among the checks that ran.

## 0.32.0

### Minor Changes

- 091ec2f: `security/handler-state-write` now reports a hand-rolled in-memory store under `$lib/server`.

  The rule exempts `.set()`/`.update()` on imports resolving under the `$lib` server root, because
  that is where database and KV clients live and `db.set(…)` there is persistence, not shared state.
  The check was purely path-based, so a plain `new Map()` in the same directory — one shared
  instance, overwritten by every request — was exempt too:

  ```ts
  // src/lib/server/store.ts
  export const db = new Map();

  // src/routes/+page.server.ts
  import { db } from "$lib/server/store";
  export async function load({ locals }) {
    db.set("user", locals.user); // previously not reported
  }
  ```

  svelte-vitals now reads the target module and keeps the call exempt only when the export is not an
  in-memory container. An export initialized to `new Map`/`Set`/`WeakMap`/`WeakSet`, or to an object
  or array literal, is reported; anything else — a client constructed from a package, a re-export, an
  unreadable module — stays exempt. A wrapper the read cannot inspect therefore stays silent rather
  than becoming a false positive. Only the modules a handler actually writes to are read, so a project whose handlers never
  touch `$lib/server` does no extra I/O.

  Property writes (`store.user = …`) were already reported wherever they appear and are unchanged.

## 0.31.1

### Patch Changes

- 47e025d: Scores are now floored rather than rounded to nearest, so a displayed 100 means the deduction was exactly
  zero. Previously a category could print a perfect 100 while carrying hundreds of findings: with 585 score
  keys it took 293 `info` findings to move the number off 100, and a finding on every single key still showed 99.

  **Every score moves down by 0 or 1 point.** If you gate CI with `--min-health` at or just above your
  current score, lower the threshold by one. `--min-health 100` now fails on any finding at all, which is the
  honest reading of 100.

  Health is also computed differently, though the change is invisible on most projects: it averages the
  unrounded category scores and floors once, instead of averaging scores that had each already been rounded.
  The old double rounding could move Health two points where the parts moved one.

  `architecture/unit-entry-file` no longer adds a score key for each conforming unit. Its pass is still
  reported — it is the only evidence the rule ran at all — but it no longer inflates the denominator that
  every other finding is averaged against.

## 0.31.0

### Minor Changes

- d12fd54: Add `architecture/directory-naming`, which checks that a directory is named in the casing its
  location declares. Like the other Architecture convention rules it is off until configured: set
  `directories` to a map of directory glob to casing set (`camelCase`, `PascalCase`, `kebab-case`,
  `snake_case`, or several joined by `|`). SvelteKit route syntax is decoded before the check, so
  `[itemId=integer]` is judged as `itemId` and `(app)` as `app`.
- 2e60244: Add `architecture/reserved-directory-names`, which holds a directory's immediate subdirectories to a
  closed set of names you declare for that position. Like the other Architecture convention rules it is
  off until configured: `scopes` maps a directory glob to the names its children may take, and
  `unitScopes` maps a root glob to the names a unit's children may take — a unit being a directory whose
  name begins with a capital and which holds a file named after it.

  Where `architecture/directory-naming` checks a directory's casing, this checks its name, so it reports
  the correctly-cased `helpers/` that no casing declaration objects to.

- 67f5035: Add `architecture/route-component-import`, which reports a component importing a SvelteKit route entry
  (`+page.svelte`, `+layout.svelte`, `+error.svelte`, and their `@` breakout forms).

  This is the first Architecture rule that is **on by default**, so a project that changes nothing may see
  new findings at `info`. Kit renders a route entry with the data it supplies; imported elsewhere the
  component renders without it. Stories, tests and specs are exempt by default, and `exemptImporters`
  extends that list for a project whose satellite files are named another way.

- 2ce2288: New rule `architecture/unit-entry-file`: a directory you have declared to be a unit must contain a
  file named after it — `Card/` without `Card.svelte`, `getFoo/` without `getFoo.ts`. It is **inert
  until configured**, so nothing changes for projects that do not set it.

  Declare units by position with `units` (directory glob → the entry file's extension), by name with
  `pascalCaseUnits` (root glob → extension, applying to every directory under it whose name begins with
  an uppercase letter), and declare what is never a unit with `exclude`. Both identification styles
  exist because a camelCase directory may be a unit or a grouping — only position tells them apart —
  while a PascalCase unit nests to arbitrary depth, where no path glob reaches it.

  A filename-pattern check cannot express this: a file that does not exist has no path to validate. For
  the same reason, a declaration that matches no directory at all is reported, so a glob typo cannot
  leave the rule silently checking nothing — and so is a declaration whose every match is removed by
  `exclude`, with the message saying which of the two it was.

### Patch Changes

- 1a8d6ac: `performance/heavy-import` no longer reports a type-only import. The rule's claim is bundle weight, and
  `import type { Moment } from 'moment'` — or a declaration whose every specifier is inline-typed — is
  erased at build and adds nothing, so reporting it was a false positive.

  Projects using type-only imports of a configured heavy package will see **fewer** findings, and a health
  score that rises accordingly. No configuration change is needed.

  `architecture/private-scope-import` deliberately keeps reporting type-only imports: that rule is about
  coupling between parts of a tree, which a type import creates just the same.

- 19de7e0: Resolve import specifiers through the aliases a project declares in `svelte.config.{js,ts}` (`kit.alias`,
  and `kit.files.lib` when `$lib` has been moved), in SvelteKit's own order and with its first-match-wins
  semantics.

  Projects that import through their own aliases will see findings that were previously invisible —
  `security/shared-state-import` in particular was inert for them, since every import it examines has to
  resolve to a project-local path first. `$lib` now honours `kit.files.lib` instead of assuming `src/lib`.

  An alias whose value is not a plain string, and a project whose SvelteKit options are passed to the
  `sveltekit()` Vite plugin, are left unresolved rather than guessed at.

- ca2388b: Skip the three directory-shaped Architecture rules entirely when no config layer mentions them.
  `architecture/unit-entry-file`, `architecture/directory-naming` and
  `architecture/reserved-directory-names` read their options per directory, so an unconfigured project
  was resolving and discarding options once for every directory under `src/`, three times over — on
  every dev-server save. Measured over a synthetic tree of 1,523 directories, that cost 5.4 ms per
  analysis for rules that are off by default and produce nothing. It is now zero.

## 0.30.0

### Minor Changes

- 0b2fd98: Recalibrate the Architecture thresholds against real Svelte code: `architecture/prop-count` now flags more than 6 props (was 10) and `architecture/component-size` flags components longer than 200 lines (was 400).

  Both numbers were previously guesses. They now come from surveying real Svelte 5 codebases with the same benchmark-based method ReactSniffer uses for React. `prop-count`'s 6 is the median per-repository 90th percentile; `component-size`'s 200 is set deliberately above the measured 90th and 95th percentiles, because length is a weaker signal than a wide prop surface. Both held when the survey was widened. At the old values these rules almost never fired on a typical Svelte project.

  Expect new `info` findings on existing projects. The Architecture score itself will barely move: component-scoped rules score per file (each flagged file loses 1 point for an `info` finding, then per-file scores are averaged across the project), so more than half of a project's components would have to be flagged before the Architecture score drops by even a single point. Nothing fails by default, since `failOn` defaults to `'critical'` — but if you run with `--fail-on info` or `failOn: 'info'` in `svelte-vitals.config.mjs` (including the Vite plugin's build mode, where it fails the `vite build`), components that passed before this change will now fail. Turn a rule off in `svelte-vitals.config.mjs` (`rules: { 'architecture/prop-count': 'off' }`) if its default does not suit your codebase — per-rule thresholds are not configurable yet.

- b1c6f80: Add `correctness/base-path-navigation`: in projects that configure `kit.paths.base`, flags hardcoded root-relative navigation — `<a href="/about">`, `goto('/about')`, `redirect(303, '/login')` — which resolves against the domain root, lands outside the app, and 404s in production while working fine locally. The base path is read from the `sveltekit()` Vite plugin config, else `svelte.config.{js,ts}`, following SvelteKit's own precedence; projects without a base path are never flagged. Detection is literal-only, so `resolve()`-wrapped and `base`-prefixed paths are never reported.
- 15e0874: Add `correctness/checkable-bind-value`: flags `<input type="checkbox" bind:value={x}>` and `<input type="radio" bind:value={x}>` — `bind:value` binds the DOM `value` property, which checkbox/radio interaction never changes, so the bound state silently never updates. Verified against Svelte 5 directly: the compiler accepts this pattern with zero warnings. Use `bind:checked` (single checkbox) or `bind:group` (checkbox list / radio group) instead.
- 314a19a: Rule settings now accept an object form, `{ severity?, options? }`, alongside the existing
  `'off' | Severity` strings. Options let a project move a rule's thresholds or extend its
  built-in lists, globally or per path via `overrides`.

  Configurable rules: `architecture/prop-count` and `architecture/component-size` (`max`),
  `seo/title-length` and `seo/description-length` (`min`, `max`), `performance/heavy-import`
  (`packages`), `performance/preconnect` (`origins`). List and map options are **added** to the
  built-in set rather than discarding it, so new built-in entries keep reaching every project; in a
  map, a key that already exists built-in keeps its entry and takes the configured value.

  Two notes for existing setups. Values in the config file's `rules` map are now validated —
  an invalid severity that was previously passed through unchecked is now a fatal config error.
  And the `RuleSetting` union has gained a member, which can make an exhaustive `switch` over it
  in external TypeScript code non-exhaustive.

  The `svelteVitals()` Vite plugin's `rules` and `overrides` options get the same validation as
  the config file — both funnel through core's `validateRuleSetting`: an unknown rule id, an
  invalid `severity`, an unrecognized key in the object form, an unknown option key, or an option
  value outside its declared type/bounds is now a fatal, synchronous error at plugin construction,
  instead of being silently ignored (an unknown id) or silently dropped (an invalid option). A
  `vite.config.js` gets no help from TypeScript, so a typo there previously left the rule at its
  built-in severity with no signal at all.

  `explain_rule` (`@svelte-vitals/mcp`) now reports a rule's configurable options — name, kind,
  default, bounds, and whether the value replaces or extends the default — in both its text and
  `structuredContent`. An agent that reads a finding as a threshold disagreement rather than a
  defect can name the knob without leaving the tool loop.

  In an `overrides[].rules` entry, a rule-id key and a category key are resolved independently:
  a rule-id key that carries no `severity` (an options-only object, e.g.
  `'architecture/prop-count': { options: { max: 4 } }`) does not shadow a category key's
  severity in the same entry — the category's severity still applies, alongside the rule's
  options. Only a rule-id key that _does_ specify a `severity` beats the category key, as before.

- 0603539: New rule `architecture/private-scope-import`: a unit inside a directory you have declared private
  must not be imported from outside that directory's owner. It is **inert until configured** — set
  `scopes` to a list of globs naming your private directories, and nothing changes for projects that
  do not.

  Each glob matches a private directory and its parent becomes the boundary, so the same directory
  name can mean different things in different places: with `scopes: ['src/routes/**/components']`, a
  route's `components/` is private to that route while `src/lib/components` stays shared. When private
  directories nest, the innermost one wins.

  Only imports written in a `.svelte` component are checked, and only when the specifier is `$lib/` or
  relative. An import resolved through a custom `svelte.config.js` alias, one written in a
  `.svelte.ts` / `.svelte.js` module or a Kit module (`+page.ts`, `+server.ts`, `hooks.*.ts`), and one
  naming a directory rather than a file are all unchecked for now. Each rule page lists the same set.
  Type-only imports **are** checked — the coupling they create survives into source even though the
  import is erased at build.

### Patch Changes

- 59bd0d6: Scope resolution now treats template declaration tags — `{@const ...}` and the newer `{let ...}` / `{const ...}` — as shadowing bindings for their enclosing fragment, so a write to such a template-local alias is no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).

## 0.29.0

### Minor Changes

- 3389594: `correctness/stale-prop-derivation` and `correctness/prop-mutation` now also recognize legacy-mode (`export let`) props, not just runes-mode (`$props()`) ones — the same two bugs exist under Svelte's legacy reactivity, just with a different fix (`$:` instead of `$derived`; reassign-after-mutating instead of `$bindable`), and each rule's message is tailored to whichever mode the flagged component actually uses.
- 40a6dc6: Add `correctness/nonreactive-builtin-state`: flags plain `Map`/`Set`/`Date`/`URL`/`URLSearchParams` in `$state` whose mutations are observed — `$state`'s deep proxy covers plain objects and arrays only, so such mutations are untracked and the UI silently stops updating. Precision-first: only type-specific mutating operations count, and mutate-then-reassign usage (which works) is not flagged.

### Patch Changes

- 48f6d24: Scope resolution now treats `var` declarations and nested `function`/`class` declaration names as shadowing bindings, so writes to such locals are no longer misattributed to a same-named top-level `$state` (fewer false positives across the component-analysis rules).
- 2ed7450: `correctness/unmutated-state` no longer flags `$state` passed to a `use:`/`transition:`/`animate:` directive — the receiving code holds the proxy reference and may mutate it invisibly, so the previous `$state.raw` suggestion could break it.

## 0.28.0

### Minor Changes

- 4c58609: Add `correctness/each-index-key`: flags `{#each}` blocks keyed by their own index (`{#each items as item, i (i)}`) — position-based identity, the same failure mode as an unkeyed block, masked by the visible key.

  Also widens the no-identity exemption shared with correctness/each-key: length-only placeholder lists (Array(n), [...Array(n)], Array.from({length: n})) are no longer flagged by either rule.

- e41512f: Add PERF011 (Load waterfall) and PERF013 (Sequential independent awaits): a forward-taint analysis of `load` functions flags dependent await chains in universal loads (move them to a server load) and independent sequential awaits in any load (parallelize with `Promise.all`).
- da8ff85: Add PERF012 (Minification disabled): flags a `build.minify: false` left in `vite.config.*`. The CLI detects the literal form statically; the Vite plugin reads the resolved config during `vite build`, catching conditional configs exactly.
- b05fe4f: Rule IDs now use an ESLint-style `category/kebab-case` form (e.g. `seo/ssr-disabled`) instead of `CATEGORY123` (e.g. `SEO031`), so the id itself tells you what a rule checks when disabling it in config or a suppression comment.

  This is a breaking change with no backward-compat aliasing:

  - Update `svelte-vitals.config.mjs`/`.js`/`.json` `rules` overrides to the new ids (keys now contain a slash, so they must be quoted: `rules: { 'seo/ssr-disabled': 'off' }`).
  - Update `// svelte-vitals-disable-next-line <ID>` suppression comments to the new lowercase ids.
  - If you have a `.svelte-vitals-suppressions.json` baseline file, every entry is keyed by the old id and will no longer match after upgrading — regenerate it (re-run your suppression-baseline command, e.g. `svelte-vitals --update-suppressions`, after upgrading) rather than hand-editing the old ids.
  - The `explain_rule` MCP tool and the `--rules`/`--ignore` CLI/MCP options now expect the new ids.
  - The per-rule exports of `@svelte-vitals/core` are renamed to the camelCase form of the new id (e.g. `seo031SsrDisabled` → `seoSsrDisabled`, `sec003LoadStateWrite` → `securityHandlerStateWrite`).

  See the full old-id → new-id mapping in [docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md](../docs/superpowers/specs/2026-07-22-rule-id-eslint-style-design.md).

- edaaa94: Add SEO031 (warning): flag SvelteKit route files that disable server-side rendering with `export const ssr = false` — per the official SEO guidance, server-rendered content indexes more reliably, and SPA mode adds a round trip before first paint. The root-layout (app-wide) case gets a dedicated message; deliberate SPAs can turn the rule off or suppress inline.
- cfbaa49: Add `correctness/stale-prop-derivation`: flags top-level values computed from `$props()` props without `$derived` and rendered in the template — they evaluate once at init and silently stop tracking the parent. Conservative by design: eager references only, call-free initializers, never-reassigned bindings, template-rendered. Also tweaks `correctness/unmutated-state`'s recommendation to point at `$derived` for prop-computed state.
- 68e7923: Add `performance/state-raw` (info): suggests `$state.raw` for object/array-literal `$state` bindings that are reassigned but never mutated, escaped, aliased, or item-edited — deep-proxy overhead with no consumer. Conservative by design; editable `{#each}` lists and any aliasing disqualify.

### Patch Changes

- df5ac18: Fix a false negative in `performance/minify-disabled` (`findMinifyDisabled`): a `satisfies`/`as`-wrapped object literal reached only on the 4th (final) identifier/call-argument resolution hop was left unwrapped and silently treated as unresolvable.

## 0.27.0

### Minor Changes

- 840121a: The Markdown report (GitHub Actions job summary / sticky PR comment) now ends with a one-line pointer to the "Excluding routes or rules" docs whenever findings are shown, so adopters blocked by expected findings (e.g. auth-only routes flagged by SEO rules) can find `overrides` / the suppressions file from the report itself.
- 840121a: Add route-/file-scoped rule overrides via a new `overrides` option in `svelte-vitals.config.*` (also available as a Vite plugin option). Each entry scopes rule settings with `route` globs (matched against route ids) and/or `files` globs (matched against source paths — the way to target a `(group)` directory, since group segments are dropped from route ids): `overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]` turns all SEO rules off for an auth-only route group, durably — routes added under the glob later are excluded too, unlike the snapshot-style suppressions file. Keys in an entry's `rules` may be rule ids or category names; values are `'off'` (the finding is removed entirely) or a severity. Applied in `analyzeProject`, so the CLI, MCP server, GitHub Action, and Vite build gate all honor it.

## 0.26.0

### Minor Changes

- b10c26a: Add CORRECT006 (critical): flag orphan `$effect` calls that throw `effect_orphan` at runtime — a top-level `$effect` in a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>`, and a module-scope `new` of a class whose constructor creates a bare `$effect`. `.svelte.ts`/`.svelte.js` runes modules are now analyzed by the component-facts pipeline.
- e38ea4d: Add CORRECT007 (critical): flag Svelte lifecycle/context calls (`onMount`, `getContext`, `setContext`, …) that run outside component initialisation and throw `lifecycle_outside_component` at runtime — at module scope in runes modules and `<script module>`, in constructors of module-scope-instantiated classes, and inside SvelteKit load/action/endpoint handlers (the classic `getContext`-in-`load` trap).
- b0c2040: Add CORRECT008 (critical) and CORRECT009 (warning): flag browser-only globals (`window`, `document`, `localStorage`, …) read in server-executed code — module scope of runes modules and `<script module>`, SvelteKit load/handler/`init` bodies and file top levels (CORRECT008), and component instance-script top levels that run during SSR (CORRECT009). Recognises `browser`/`typeof` guards, respects same-file `export const ssr = false`, and never descends into `onMount`/`$effect`/function bodies.
- d6511a7: Add SEC003–005: SSR shared-state leak detection for SvelteKit server/universal route files. SEC003 (critical) flags load/action/endpoint handlers writing to imported module state; SEC004 (warning) flags module-scope `let`/`var` reassigned from functions in Kit server files; SEC005 (warning) flags server-side imports of `.svelte.ts` modules holding module-scope `$state`. Kit route/hooks files are now analyzed via a new `KitModuleFacts` channel.

### Patch Changes

- 15f0b61: SEC003 no longer flags `.set()`/`.update()` calls on modules imported from `src/lib/server/**` via a relative path — the exemption now checks the resolved path, not just the `$lib/server/` alias form.

## 0.25.0

### Minor Changes

- 28e92c0: `svelte-vitals --reporter html` and the vite live dashboard now share one renderer (core's new `renderAppShell`), so the two surfaces can't drift apart again. The static HTML report gets the dashboard's full UI — master/detail layout with a searchable, sortable route list, severity/category filters, dark mode, and the per-finding copy-to-clipboard AI Prompt — while staying fully self-contained and offline; the only difference is that the live-update machinery (SSE connection, `measured` refinement, the connection/analyzing indicators) is absent when there is no dev server behind the page. `@svelte-vitals/core` gains `renderAppShell`/`AppSnapshot`/`RouteBadge`/`APP_SCRIPT`/`APP_STYLE` exports; `buildHtmlDocument`/`formatHtmlReport` keep their signatures but emit the new document. The dashboard itself is unchanged, now served from the shared shell.

## 0.24.0

### Minor Changes

- bf6932d: Fix PERF009 (heavy dependency import) always reporting `line: 0` for its findings. `ComponentFacts` gains `importSpans` (module specifiers with their real source line), and PERF009 now uses it instead of the line-less `imports`. Because `componentRule`'s suppression check only looks up an inline directive when a finding's `line > 0`, this also fixes `// svelte-vitals-disable-next-line PERF009` silently never suppressing a PERF009 finding.

### Patch Changes

- fda64dd: Console reporter: stop printing the "↯ = set dynamically (verified at runtime)." footnote in compact (default, non-`--verbose`) mode. The `↯` marker itself only ever appears in the verbose `Passed` listing — showing the footnote without it visible anywhere in the output was confusing.

## 0.23.0

### Minor Changes

- 7acad5a: Console output now groups findings by rule and caps what's shown by default (top 5 rules per severity, the Passed section collapsed to a count, `--by-route` capped to the worst 10 routes) — pass `--verbose` for the old uncapped listing. The Health score also gets a short pulse-line reveal animation on an interactive terminal (disable with `--no-animation`).

## 0.22.1

### Patch Changes

- 2652572: The Markdown reporter's findings table (used for the GitHub Actions job summary and sticky PR comment) now appends each finding's `recommendation` to its message, matching what the console/github/agent reporters already show. Previously the table only showed the terse `message` (e.g. "Missing robots.txt"), dropping the actionable "how to fix it" text.

## 0.22.0

### Minor Changes

- 7e3b423: The dev dashboard (`svelteVitals({ ui: true })`) now runs whole-project static analysis: from the moment `vite dev` starts it shows all routes across every category (SEO, Performance, Correctness, Security, Architecture) with a real project Health — no page visit required. Saving a source file triggers a debounced re-analysis, and visiting a page refines that route with live (rendered) results. Route headings show a `measured` (live) or `static` provenance badge. If the analysis fails, the dashboard falls back to the previous live-only behavior without breaking the dev server. To support the badges, core's `buildHtmlDocument` gains an optional third argument (`opts?: { routeBadges?: Record<string, 'measured' | 'static'> }`); output is unchanged when it is omitted.
- f0af627: Surface the resolved `@svelte-vitals/core` version so it's possible to tell whether the CLI and the Vite dev overlay are running the same rule engine. `svelte-vitals --version` now prints `<cli version> (core <core version>)`, and the dev overlay's dashboard footer (`/__svelte-vitals/`) shows `core v<version>` alongside its own version. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases (e.g. a package-manager cooldown like pnpm's `minimumReleaseAge` resolving `@latest` down to an older release) — previously there was no way to notice this without diffing lockfiles, so the two surfaces could silently disagree on findings. See the "Version drift" section in the dev overlay docs.

## 0.21.0

### Minor Changes

- 8dc631c: Add a `--reporter md` Markdown summary reporter (Health score, per-category scores, severity counts, and a findings table) and a `svelte-vitals ci install` command that scaffolds a GitHub Actions workflow gating pull requests on newly introduced findings — inline annotations, a job summary, and a sticky PR comment, using `--diff`/`--baseline`/`--reporter github`/`--reporter md` under the hood.

## 0.20.0

### Minor Changes

- 7f1697d: Add CORRECT005: flag mutation of a non-`$bindable` prop destructured from `$props()` (member writes, `delete`, or a mutating method call like `.push()`). Plain reassignment of the prop itself is not flagged — Svelte's docs explicitly sanction that pattern for ephemeral state; only mutation is prohibited. Catches a class of bug the compiler never reports: mutating a plain-object prop is a silent no-op, and mutating a reactive-state-proxy prop only warns at runtime if that code path is exercised.
- 3b33e4c: Raise the supported Node.js floor from 18.20.8 (EOL) to >=22.13.0 — the oldest maintained LTS line the pinned pnpm can run on. CI now exercises Node 22 (floor), 24, and 26.

### Patch Changes

- 18b11af: Fix CORRECT001 (keyed each block): stop flagging itemless `{#each}` blocks (the "render N times" pattern, e.g. a chess board) — there is no item identity to key on, so this was a false positive on an officially documented Svelte pattern. Also corrected the rule's rationale text, which described the unkeyed mechanism backwards.
- e476a2e: Deduplicate `collectComponentFacts` into `@svelte-vitals/core`; behavior is unchanged.
- 6b2d0a7: Fix PERF010 (namespace import) rationale: it previously claimed a namespace import always defeats tree-shaking, which over-states the real behavior — bundlers like Rollup/Vite do tree-shake statically-accessed namespace imports. The message now accurately describes when tree-shaking breaks (the namespace object escapes or is accessed dynamically). No detection or severity change.
- 4513f97: Fix a false-positive/false-negative source shared by CORRECT004 (unmutated `$state`) and CORRECT005 (mutated non-bindable prop): both matched writes by identifier name alone, so a local binding that reused a tracked `$state`/prop name — a function parameter, a block-scoped `let`/`const` redeclaration, a `for`/`for-of`/`for-in` loop variable, a `catch` clause's parameter, or an `{#each ... as x}` loop variable — was misattributed as a write to the outer binding. CORRECT005 now correctly skips flagging a mutation of such a shadowing local instead of raising a false positive; CORRECT004 now correctly still flags a `$state` as constable when only a shadowing local was ever written, instead of a false negative. `{#snippet}`/`{:then}`/`{:catch}` bindings are not yet tracked — a known, documented remaining gap.

## 0.19.0

### Minor Changes

- 19e304c: Add an inline `svelte-vitals-disable-next-line` comment to suppress a specific component-scoped rule's finding on the following line (`// ...` in `<script>`, `<!-- ... -->` in markup) — a targeted escape hatch for intentional patterns a rule can't infer statically, such as a mount-only `$effect` used to avoid a hydration mismatch. Covers CORRECT001–004, SEC001–002, ARCH001–002, and PERF009–010. Fixes #92.
- 2f94444: Export `parseComponentFacts` (and the Svelte-AST utilities it's built on — `attrValue`, `attrValueOf`, `attrTextOf`, `findAttr`, `lineOf`, `CHILD_NODE_KEYS`, `valueFromNodes`, `textFromNodes`, `attrText`) from the package root. This is the same `.svelte`-source parser the CLI has always used for Correctness/Security/Architecture/Bundle-Performance rules, relocated from `svelte-vitals` so `@svelte-vitals/vite` can use it too. `@svelte-vitals/core` gains a new `svelte` dependency (for `svelte/compiler`'s `parse`) — a pure parsing call, so this doesn't affect the package's runtime-agnostic status.

## 0.18.0

### Minor Changes

- 32712e2: Rich console output: the default `console` reporter now colorizes the Health/category
  scores, severity sections, and pass/fail markers, and shows an "Analyzing…" spinner
  during the scan. All of it auto-disables under `NO_COLOR`, a non-TTY stdout, a
  non-`console` reporter, or `--no-color` (and honors `FORCE_COLOR`). Color is an
  injected `Palette` (identity by default), so `@svelte-vitals/core` stays
  dependency-free and other reporters are unchanged.
- 54c77d8: Add **CORRECT003 (effect used as onMount)** — the Correctness/reactivity slice of
  #69. Flags an `$effect`/`$effect.pre` whose non-empty body reads no reactive value
  (no `$state`/`$derived`/`$props`, no store subscription, no bare function call), so
  it never re-runs and should be `onMount`. Reported under `correctness` (warning).
  `EffectFact` gains `mountOnly`.
- bc6fa86: Add **CORRECT004 (unmutated $state)** — a Correctness/reactivity rule from #69.
  Flags a `let x = $state(...)`that is never written or escaped anywhere in the
  component (no reassignment, member/method mutation, bind, call-arg, or
  component-prop pass), so its reactivity is unused — use`const`(or`$state.raw`if only reassigned wholesale). Reported under`correctness`(info).`ComponentFacts`gains`constableStates`.

## 0.17.0

### Minor Changes

- 90e3e7e: Add an **Architecture** category — the third "Svelte Doctor" code-health category,
  reusing the component-body scan (CLI/static mode). Deterministic, high-precision
  size metrics that flag bloated "god components":

  - **ARCH001** Component size: flags a `.svelte` file over 400 lines (info).
  - **ARCH002** Prop count: flags a component destructuring more than 10 props from
    `$props()` (info).

  `ComponentFacts` gains `loc` and `propCount`; the console reporter shows an
  Architecture score line.

- 32698e0: Add **PERF009 (heavy dependency import)** — the Bundle slice of #69. Flags an
  `import` from a well-known heavy / non-tree-shakeable package (`lodash`, `moment`),
  matched by exact specifier so subpath imports like `lodash/debounce` pass.
  Reported under the `performance` category (info). `ComponentFacts` gains `imports`
  (module specifiers from the instance + module scripts).
- 382c397: Add **PERF010 (namespace import)** — the remaining Bundle slice of #69. Flags a
  value `import * as X from '<bare package>'`, which keeps the whole module in the
  bundle and defeats tree-shaking; named imports are preferred. Type-only and
  non-bare (relative / `$lib` / `$app` / `#…`) namespace imports are not flagged.
  Reported under `performance` (info). `ComponentFacts` gains `namespaceImports`.

## 0.16.0

### Minor Changes

- 4dc7773: Add a **Correctness** category — the first analysis of Svelte component bodies
  (not just `<head>`), broadening svelte-vitals toward a deterministic, agent-native
  code-health scanner. A new static (CLI) scan reads every `.svelte` under `src/`
  into a component-facts channel and adds two rules:

  - **CORRECT001** Keyed each block: flags an `{#each}` with no key (reordering an
    unkeyed list destroys/recreates DOM and loses element state).
  - **CORRECT002** Effect used to derive state: flags an `$effect` whose body only
    assigns to `$state` — the "useEffect → $effect" anti-pattern; use `$derived`.

  Correctness findings are scored per source file and surface under the new
  `correctness` category in the Health report. (CLI/static mode only.)

- 7cabf35: Add a **Security** category — the second "Svelte Doctor" code-health category,
  reusing the component-body scan (CLI/static mode):

  - **SEC001** Raw HTML render: flags `{@html …}` (an unescaped-HTML XSS surface;
    sanitize the value).
  - **SEC002** javascript: URL: flags a literal `javascript:` URL in an
    `href`/`src`/`action`/`formaction` attribute.

  The component-rule factory is now shared between the Correctness and Security
  categories, and the console reporter shows a Security score line.

- 6ee3d04: Add SEO028–SEO030 (#61), reusing existing capture (no parser changes):

  - **SEO028** Duplicate title: flags routes that share an identical static `<title>`.
  - **SEO029** Duplicate description: flags routes that share an identical static
    meta description.
  - **SEO030** Heading order: flags a skipped heading level (e.g. `<h2>` straight
    to `<h4>`); single-`<h1>` presence stays SEO027.

## 0.15.0

### Minor Changes

- 9fb4622: Add PERF005–PERF008, four static Performance checks (#60):

  - **PERF005** LCP image eager loading: flags the first `<img>` (likely LCP) when
    it is `loading="lazy"` (static/CLI mode).
  - **PERF006** Responsive image: flags an `<img>` without `srcset` (info; static/CLI mode).
  - **PERF007** Render-blocking script: flags a `<head>` `<script src>` without
    `defer`/`async`/`type="module"`, in app.html (rendered) or `<svelte:head>` (static).
  - **PERF008** Preconnect third-party origin: flags a well-known third-party
    origin (Google Fonts) referenced without a `preconnect`/`dns-prefetch` (info).

  The head model gains `kind: 'script'`, `href`, and `blocking`; `<img>` capture
  gains `lazy` and `hasSrcset`.

## 0.14.0

### Minor Changes

- 0fbc25d: Validate JSON-LD content, not just its presence (SEO008): SEO016 (valid JSON with @context/@type),
  SEO017 (deprecated/restricted rich-result type), SEO018 (relative URLs under known keys), SEO019
  (non-ISO-8601 dates under known keys), SEO020 (placeholder text), and SEO021 (required properties for
  recognized @types). Only static, parseable JSON-LD is checked — a dynamically-built script is skipped.
- 069e0db: Add SEO024–SEO027, the remaining statically-analyzable SEO checks:

  - **SEO024** — Character encoding: flags a rendered page with no `<meta charset>`
    (lives in app.html, so rendered-only, like the viewport rule).
  - **SEO025** — Image alt text: flags an `<img>` with no `alt` attribute (empty
    `alt=""` is valid decorative; static/CLI mode only, like the perf image rules).
  - **SEO026** — hreflang validity: opt-in check of `<link rel="alternate"
hreflang>` alternates — malformed codes, or 2+ alternates without an x-default.
  - **SEO027** — Heading hierarchy: flags zero or multiple `<h1>` per page (exactly
    one passes; layout-chain headings count). Introduces a page-body headings
    channel collected by both providers.

- 8aeeabb: Add SEO022 (title length, 30–60 chars) and SEO023 (meta description length,
  70–160 chars). Both check only static text — the literal title/description is now
  captured onto the head model — and flag both too-short and too-long values; a
  dynamic title/description is skipped (presence stays owned by SEO001/SEO002).
  Static literal `title`/`description` props on `svelte-meta-tags` and `svelte-seo`
  components are measured too (a `titleTemplate` correctly suppresses title
  measurement). Length is counted by grapheme cluster, so emoji (ZWJ/flag/skin-tone
  sequences) count as one character.

### Patch Changes

- 67a5a0e: Refine the JSON-LD rules to cut false positives: SEO018 no longer flags `@id`
  (a node identifier, often a relative fragment) and now accepts any URI scheme
  (`data:`/`mailto:`/`urn:`) and protocol-relative URLs; SEO019 accepts schema.org
  reduced-precision dates (`2026`, `2026-06`); SEO021 treats empty/blank required
  values as missing. Rendered-mode capture reads `<script>` via `rawText` so HTML
  entities (e.g. `&quot;`) are no longer decoded and the JSON stays intact.

## 0.13.0

### Minor Changes

- e627343: Add six SEO checks decidable from the resolved `<head>` and project facts: SEO010 surfaces a
  route set to `noindex` (verify intentional), SEO011 Twitter Card, SEO012 Open Graph description,
  SEO013 Open Graph URL, SEO014 viewport, and SEO015 (robots.txt should reference your sitemap).
  SEO010 only fires on a statically-resolvable `noindex`/`none` (never a dynamic value); robots/
  viewport tags placed in `app.html` are covered in plugin/rendered mode.

## 0.12.0

### Minor Changes

- ef895c1: Add two static resource-hint Performance checks: PERF003 flags a `<link rel="preload">`
  with no `as` attribute (the browser ignores or double-fetches it), and PERF004 flags a
  `<link rel="preload" as="font">` with no `crossorigin` (the font preload is wasted and the
  file downloads twice). Both surface in the CLI, the static report, and the vite plugin /
  dev UI. Static mode evaluates hints in `<svelte:head>`; resource hints in `app.html` are
  covered in plugin/rendered mode.

## 0.11.0

### Minor Changes

- e6ee630: Add a visual HTML report: `svelte-vitals --reporter html` writes a self-contained,
  styled HTML page (Health score, per-category and per-route scores, findings with
  fixes) you can open in a browser. Output path defaults to `svelte-vitals-report.html`;
  override with `--out-file <path>` or `--out-file -` for stdout. The core gains
  `buildHtmlDocument` / `formatHtmlReport` for reuse by other surfaces.

## 0.10.1

### Patch Changes

- 0555127: Add a documentation site (Starlight, bilingual en/ja) at
  https://oekazuma.github.io/svelte-vitals/ with rule references and guides, and point every
  finding's `docsUrl` (and the SARIF `informationUri`) at it — previously these linked to an
  unpublished domain. Rule doc slugs are lowercased (e.g. `/rules/seo001`).

## 0.10.0

### Minor Changes

- d86ced5: **Remove the Accessibility (a11y) category.** svelte-vitals now focuses on SEO and
  Performance; accessibility is well covered by the Svelte compiler, eslint-plugin-svelte,
  and axe. This removes the a11y collector (the aggregated Svelte `a11y_*` compiler
  warnings), the `a11y` category from the score/Health breakdown and reporters, and the
  `--ignore a11y_*` / allow-list a11y handling. `Category` is now `'seo' | 'performance'`,
  and the Health score averages SEO + Performance. **Breaking:** a11y findings and the
  `categories.a11y` entry no longer appear in any reporter or the MCP `analyze` output.

## 0.9.0

### Minor Changes

- 31904f9: Add the combined **Health Report** (#10): a single weighted Health score across the
  SEO, Performance, and Accessibility categories (equal weights by default, overridable
  via `Config.weights`), surfaced as the headline in the console/agent reporters and the
  MCP `analyze` output, with an optional `--min-health <0-100>` CI gate.

  **Breaking (JSON report):** the top-level `score` is now the combined Health score (it
  was the SEO score); the top-level `scoreModel` is removed; a `weights` field is added.
  Per-category scores remain under `categories` (e.g. `categories.seo.score` /
  `categories.seo.scoreModel`).

## 0.8.0

### Minor Changes

- 2857e16: Add the Performance category (v0.4, #10): static `<img>` checks — **PERF001** (missing
  `width`/`height`, CLS risk; warning) and **PERF002** (missing `loading` attribute; info
  advisory) — with dynamically-bound attributes counting as present. Introduces the
  multi-category foundation: `Result.category`/`line`, the `ImageInfo`/`ResolvedImages` IR,
  `RuleContext.images`, `imageRule`, `scoresByCategory`, and category-aware reporters
  (per-category scores; JSON `categories` map). Existing SEO findings, scores, and output
  are unchanged.

## 0.7.0

### Minor Changes

- 6f3aeec: Formalize the ESM-only stance (#20): drop the legacy top-level `main`/`types` from
  `@svelte-vitals/core` and `@svelte-vitals/vite` so every package is `exports`-only,
  add `sideEffects: false` across all packages for consistent tree-shaking, declare
  `"engines": { "node": ">=18" }` on every package so the documented runtime floor is
  machine-enforceable, and document the ESM-only (Node 18+, `require()` unsupported by
  design) requirement in each README. CI now guards type-resolution with
  `@arethetypeswrong/cli` (esm-only profile) alongside publint.

  `core` and `vite` get a `minor` bump because dropping top-level `main`/`types` can
  affect consumers/tools that resolve entry points without `exports` support (e.g.
  `moduleResolution: node`); `svelte-vitals` and `@svelte-vitals/mcp` only gain the
  additive `sideEffects: false` and `engines` declaration, so they stay `patch`.

## 0.6.0

### Minor Changes

- 396a783: Add `@svelte-vitals/mcp`, a Model Context Protocol server exposing `analyze` and `explain_rule` tools over stdio (#24). Core gains `buildJsonReport`, `explainRule`, `RuleInfo`, and `docsUrlFor`; the JSON report's per-finding objects now include `docsUrl`; the CLI gains `analyzeProject` for reuse.

## 0.5.0

### Minor Changes

- 762d4d1: Add SARIF 2.1.0 (`--reporter sarif`) and GitHub Actions workflow-command (`--reporter github`) reporters. The `github` reporter is auto-selected under GitHub Actions for inline PR annotations; SARIF can be uploaded to GitHub code scanning.

## 0.4.0

### Minor Changes

- e60d033: Agent-native output. Every rule now carries a structured `fix` (instruction + snippet), surfaced in the JSON report and in a new `--reporter agent` Markdown remediation document built for handing findings to an AI coding agent. The CLI auto-selects the agent reporter when run under a known AI-agent harness (`CLAUDECODE`), overridable via `SVELTE_VITALS_REPORTER` or `--reporter`.

### Patch Changes

- eb97f09: Agent reporter polish: an invalid `--reporter <value>` now fails fast with exit 2 instead of silently falling back to auto-detection; the agent Markdown report orders findings most-severe-first (critical-bearing files first, severity-sorted within each file) and tells the agent to prioritize critical issues; tag-like tokens (`<title>`, `<meta …>`, `<svelte:head>`) in the agent report are wrapped in inline code so Markdown renderers no longer strip them; rule `fix` templates are now copied per finding rather than shared by reference; and when the agent reporter is auto-selected from the environment (not requested explicitly), a one-line hint is printed to stderr explaining how to override.

## 0.3.0

### Minor Changes

- fcb0494: Plugin mode: `@svelte-vitals/vite` analyzes prerendered HTML during `vite build` and runs the full SEO rule set (library-agnostic), gating the build via `failOn`. Console/JSON reports with a per-route score; only prerendered routes are covered. `outFile` is resolved against the project root (parent directories are created), and an internal analysis failure is reported as a warning rather than failing the build (distinct from a real finding). The core console reporter gained an optional `mode` label for the header line, and now exports the shared `ROBOTS_SOURCE_PATHS` / `SITEMAP_SOURCE_PATHS` project-rule path lists used by both modes.

## 0.2.0

### Minor Changes

- 08b6d74: Static-mode finishing: scored SEO report.

  - New rules SEO002–SEO009 (description, canonical, og:image, og:title, robots.txt, sitemap.xml, JSON-LD, `<html lang>`).
  - Scoring model (§12): per-route scores, route average, site penalty, and a critical cap, surfaced in the console header and JSON.
  - JSON reporter (`--json` / `--reporter json`) and `--by-route` per-route tree.
  - New flags: `--fail-on`/`--fail-on-warning`, `--rules`/`--ignore`. `treatDynamicAs: 'warn'` now reports dynamic values as warnings.

## 0.1.0

### Minor Changes

- e3228ca: Detection layers 2–4: resolve head metadata set via components, not just literal `<svelte:head>`.

  - Built-in adapters for `svelte-meta-tags` (`MetaTags`) and `svelte-seo`.
  - Transitive resolution of custom `src/` components (depth-limited, cycle-guarded).
  - `--meta-components` flag to declare opaque meta components, plus `--treat-dynamic-as` and `--route` flags.
  - Components recognized as meta sources suppress false "missing" verdicts; unknown components do not.

## 0.0.1

### Patch Changes

- 4786248: Initial release: the static-mode SEO foundation.

  - `npx svelte-vitals` scans a SvelteKit project and checks `<title>` presence (SEO001) by statically parsing `<svelte:head>` with `svelte/compiler`, resolving the full layout chain (`+layout.svelte` → … → `+page.svelte`).
  - Two-axis detection (presence × value): a dynamic title such as `<title>{data.title}</title>` is recognized and never reported as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is flagged.
  - Runtime-agnostic `@svelte-vitals/core` (types, rule engine, reporter) with a `Runtime` I/O abstraction, plus a Node adapter in the CLI. Exit codes: `0` ok, `1` critical finding, `2` execution error.
