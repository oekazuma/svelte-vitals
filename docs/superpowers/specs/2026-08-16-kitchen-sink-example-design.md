# Design: kitchen-sink example app + end-to-end regression net

## Goal

A real, runnable SvelteKit app inside the monorepo that every rule is demonstrated against, end
to end — collection, composition, scoring, and reporting, not just rule logic over hand-built
facts. It serves four jobs at once: (1) a per-rule e2e regression net in CI, (2) a
false-positive canary (clean routes must stay clean), (3) a standing dogfood environment for
the live dashboard and build-mode plugin, and (4) a realistic (not scaling) bench target — the
synthetic generated projects remain the instrument that decides the roadmap's bench-gated
items.

Monorepo placement is deliberate: `workspace:*` links mean unreleased changes run against the
app immediately — the opposite trade from the GitHub Action, which lives out-of-repo precisely
because it must consume published packages (`2026-07-22-action-dist-post-merge-only.md`).

## The app: `examples/kitchen-sink`

- `examples/*` joins the `pnpm-workspace.yaml` package globs (today only `docs`, `docs/demo`,
  `packages/*` — without this, `workspace:*` deps cannot resolve).
- `private: true` — excluded from changesets, publishing, and `check:publish`. Dependencies:
  `svelte-vitals` and `@svelte-vitals/vite` as `workspace:*`, plus real `svelte`,
  `@sveltejs/kit`, `vite`, and `@sveltejs/adapter-static` (full prerender, so build-mode
  analysis has real output to read). The `seo/ssr-disabled` gallery route sets
  `ssr = false` **and** `prerender = false` with the adapter's `fallback` page configured —
  so it produces no prerendered HTML and its route-scoped rendered findings are absent. The
  `seo/ssr-disabled` finding itself is **still counted in the rendered expectations**: build
  mode scans the project's Kit modules from source alongside the rendered HTML, and the rule
  reads the `+page.ts` declaration, not the output. Only the route's HTML-derived findings
  disappear. `@sveltejs/adapter-static` enters the workspace
  catalog (AGENTS.md convention — no literal versions in a package.json); everything else is
  already cataloged. All dependencies must respect the Node 22.13.0 floor: the `floor-smoke`
  CI job runs `pnpm install --frozen-lockfile` over the whole workspace on that Node.
- **No `build` script.** Root `pnpm build`/`pnpm test` and the floor-smoke job's `pnpm build`
  fallback run `pnpm -r build`; a standard SvelteKit build script would run (and, per the
  gate design below, deliberately fail) in all of them. The example's `vite build` is invoked
  only inside the build-mode e2e test.
- Route layout:
  - `src/routes/gallery/<category>/…` — defect routes, grouped so one route hosts several
    related rules' violations. Cross-file showcases get dedicated layout+page pairs (duplicate
    `<main>` across layout and page, an id satisfied only after composition, a dangling `for`
    on a fully-resolved route, breakout `+page@` files where relevant).
  - `src/routes/clean/…` — a handful of well-built routes (the false-positive canaries),
    including at least one that exercises the patterns we fixed FP bugs for: spread props on a
    presence-checked element, `{#if}/{:else}` with one `<main>` per branch, an `{#each}` list
    with ids, `tabindex="-1"` focus management, expression-valued attributes.
  - Project-level defects live where those rules look: `src/app.html`, `static/`, `vite.config`
    (`build.minify: false` is itself a planted defect — `performance/minify-disabled` emits no
    pass result, so failing is its only observable state).
  - **Prerender-crashing samples** (`correctness/server-browser-global` module-scope reads,
    `correctness/instance-browser-global` instance-script reads — both execute during
    prerender when reachable) live in **glob-collected but never-imported files**: static
    collection walks `src/**/*.svelte{,.ts,.js}` by glob, not by import graph, so the scanner
    sees them while prerender never executes them. `correctness/orphan-effect`-class samples
    crash client-side, not SSR — never-imported placement guards those for the dogfood
    browser. A sample that any route imports would crash `vite build` and take the dogfood
    environment down with it.
  - A committed **`svelte-vitals.config.mjs` is a first-class part of the example**: the
    inert-by-default Architecture rules (`directory-naming`, `reserved-directory-names`,
    `reserved-name-placement`, `unit-entry-file`, `private-scope-import` scopes,
    `doc-link-target` `urlRoots`) emit nothing until their options declare scopes/units/roots —
    the config declares them so those rules meet the coverage invariant, and doubles as a
    realistic config-file dogfood.
- `README.md` maps every gallery route to the rule ids it is expected to trigger. No rule
  counts in prose (AGENTS.md rule) — the machine-readable expectations file is the source of
  truth.

## Coverage invariant: every rule, end to end

`expected-findings.json` (committed, in the example package) declares, per rule id:

```json
{
  "a11y/duplicate-landmark": { "findings": 2 },
  "seo/robots-txt": { "passOnly": "robots.txt must exist so silent-pass seo/sitemap-in-robots can fail" }
}
```

- **Default: every rule has `findings ≥ 1`** — proof its whole pipeline detects the planted
  defect.
- **`passOnly` entries are the explicit exception list** for rules whose failing condition is
  mutually exclusive with another rule's inside one project. A `passOnly` rule must still be
  _exercised_: the JSON report's per-rule entry must show `findings + passed ≥ 1`, and the
  reason string is mandatory. That constraint dictates which side of an exclusive pair goes in
  the list: **silent-pass rules (those that return `[]` when their condition doesn't hold,
  e.g. `seo/sitemap-in-robots`, `performance/minify-disabled`) can never satisfy an
  exercised-check and must be arranged to FAIL**. Concretely for the robots family:
  `static/robots.txt` and a sitemap both exist but robots carries no `Sitemap:` line — so
  `seo/sitemap-in-robots` fails (its only observable state), while `seo/robots-txt` and
  `seo/sitemap-xml` (which always emit pass results) are the `passOnly` entries.
- Two further entry variants cover rules that inherently cannot report a static-mode finding
  (not the exclusive-pair case above). `{ "renderedOnly": "<reason>" }` marks `seo/charset` and
  `seo/viewport`, whose target lives in `src/app.html` and is only evaluated by rendered
  analysis; the static test asserts `findings === 0`, and the rendered-mode (build) e2e report
  is where they're exercised. `{ "inert": "<reason>" }` marks `correctness/base-path-navigation`,
  whose gate never opens without `kit.paths.base`; the static test asserts both
  `findings === 0` and `passed === 0`.
- A **meta-test** asserts the expectations file covers exactly `allRules` — a new rule fails
  CI until it gets a gallery sample (or a reasoned `passOnly`/`renderedOnly`/`inert` entry), the
  same forcing function docs-links applies to rule docs.

## E2E tests: `examples/kitchen-sink/test/`

Vitest, so `pnpm -r test` picks it up with no new CI job. The repo-root `pnpm test` already
builds first, and these tests run the **built** CLI (`packages/cli/dist/bin.js`) as a child
process — the same artifact users run, not an in-process import.

1. **Static mode**: run the CLI with `--reporter json` against the example; assert each rule's
   finding count matches `expected-findings.json` exactly (counts, not snapshots — full-output
   snapshots churn on every message tweak), and that every finding on a `/clean/*` route is
   zero (route-scoped) with clean files never named in component-scoped findings.
2. **Build mode**: run `vite build` in-test (child process) with the plugin configured with an
   `outFile`. The gallery contains critical findings, so the plugin's gate **fails the build
   by design** (`failOn: 'critical'` default) — the test asserts the build exits non-zero
   AND reads the JSON report from `outFile`, which the plugin writes before throwing. One
   test, two contracts: the rendered-mode counts (second, smaller expectations map — rendered
   counts legitimately differ from static per the by-design source/rendered divergence) and
   the gate behavior itself.
3. **Exit-code contract**: the gallery contains at least one `critical`-severity defect, so
   the CLI exits 1; `--route /clean/…` exits 0.

Suppressions, `--diff`, and reporter-format e2e stay in `packages/cli/test` — this net is
about detection coverage, not CLI surface.

## Dogfood & bench

- `pnpm --filter kitchen-sink dev` serves the live dashboard against the gallery — the
  standing manual environment for dev-handle and dashboard work.
- The bench keeps its synthetic generated projects as the **scaling** instrument
  (`--sizes=…` route counts a hand-written app never approaches — that is what decides the
  roadmap's memoization/concurrency items). The example adds **realism**: bench gains an
  optional `--target <dir>` flag so the same harness can time a real project, with the
  kitchen-sink as the in-repo target.

## Constraints

- `scripts/floor-smoke.mjs` itself never executes the example (Node-builtins-only, fixed
  scope), but the floor-smoke JOB's `pnpm install`/`pnpm build` cover the whole workspace on
  Node 22.13.0 — the no-build-script rule and floor-compatible dependencies are what keep the
  job green. The io-budget test's scope (the cli fixture project) is untouched.
- oxlint needs a **carve-out for the gallery**: the defect routes are deliberately broken code
  (unused state, `javascript:` URLs, suspicious globals are the point), so
  `examples/kitchen-sink/src/routes/gallery/` and the never-imported crash samples enter
  oxlint's ignore list. `src/lib/clean/jsonld/**` is ignored too: oxlint parses JSON-LD
  `<script>` bodies as JS, and those fixtures carry no logic to lint. The example's `typecheck`
  is `svelte-check` (templates included, unlike `tsc`) with the same gallery + crash-sample
  directories excluded — planted defects are compiler/type defects too. oxfmt still formats
  everything; the clean routes stay fully linted and type-checked. The docs site does not
  consume the example.
- en/ja translation machinery is untouched — the example's README is English-only, per the
  repo's convention for engineering-facing files.

## Non-goals / follow-ups

- **Ecosystem CI** (scheduled job cloning real OSS SvelteKit apps; assert "no crash, exit code
  ∈ {0,1}", never counts) — separate increment.
- Visual/screenshot testing of the dashboard; Playwright — out of scope.
- Auto-generating gallery routes from rule metadata — hand-written routes are the point
  (realistic markup, not templates).
