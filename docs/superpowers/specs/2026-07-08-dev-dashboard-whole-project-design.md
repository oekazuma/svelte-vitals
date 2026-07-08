# Dev dashboard: whole-project analysis integration

**Date:** 2026-07-08
**Status:** Accepted (maintainer-approved in session; implementation plan: `plans/021-dev-dashboard-whole-project.md`)
**Packages:** `@svelte-vitals/vite` (main), `@svelte-vitals/core` (renderer option only), `svelte-vitals` (no code change; becomes a dependency of the vite package)

## Goal

The live dashboard (`svelteVitals({ ui: true })`, served at `/__svelte-vitals/`)
currently shows only what you have physically visited, covers only SEO
`<head>` rules, and computes Health over visited routes — the deliberate v1
boundaries of the 2026-06-23 live-UI design. Integrate the CLI's whole-project
static analysis (`analyzeProject`) into the dev server so the dashboard shows
**all routes and all categories with a real project Health from the moment
`vite dev` starts**, refreshed automatically as source files change, and
refined per-route by live (rendered) results as you browse.

Maintainer context (2026-07-08): heavy users are expected to live in UI mode,
so the dashboard is the primary surface to invest in — this closes the three
big v1 boundaries at once (no upfront route list, SEO-only coverage,
visited-routes-only Health).

## Decisions (maintainer-approved)

1. **Analysis timing: at startup + auto re-analysis.** `configureServer` kicks
   off one whole-project analysis asynchronously (never blocking dev-server
   startup); `server.watcher` triggers a debounced (~500 ms) re-analysis on
   relevant file changes; every completed analysis updates the store and fans
   out over the existing SSE channel. Changes arriving mid-analysis coalesce
   into a single follow-up run.
2. **Merge rule: live overrides static, per route.** The store gains a
   _static layer_ (whole-project results) alongside the existing _live layer_
   (ingested rendered-page results). Snapshot composition per route: where a
   live result set exists, static results whose rule id appears in the live
   payload are replaced by the live ones — the handle reports passing as well
   as failing results, so the rule ids present in the payload ARE the evaluated
   set (a rendered page is closer to the truth, especially for dynamic
   values); everything else — component-scoped findings (CORRECT/ARCH),
   site-wide findings (robots/sitemap), and unvisited routes — keeps the
   static result.
3. **Provenance badges.** Route headings show whether a route's findings are
   `measured` (live) or `static`. Implemented as an optional argument on
   core's `buildHtmlDocument` (`opts?: { routeBadges?: Record<string,
'measured' | 'static'> }`) — core stays a pure string function and the CLI
   `--reporter html` path is untouched (argument omitted). No string
   post-processing hacks in `serve.ts`.
4. **Dependency direction: `@svelte-vitals/vite` depends on `svelte-vitals`.**
   This mirrors the existing precedent — `@svelte-vitals/mcp` already imports
   `analyzeProject` from the CLI package, and the function's own JSDoc declares
   it a shared entry point. The import lives inside the dev-only ui plugin as a
   **dynamic import**, so build-mode usage loads none of it. The CLI-only
   heavyweights (clack, mri, magicast) are not on `analyzeProject`'s import
   path; the cost is install size only. No dependency cycle (the CLI never
   imports the vite package).

   _Rejected:_ extracting an `@svelte-vitals/analyzer` package (cleanest graph
   but large churn for the same two consumers — YAGNI until a third consumer
   or a real weight problem appears); moving providers into core (conflicts
   with core's no-I/O purity rule).

## Components

- **Store (packages/vite/src/ui/store.ts)** — extended with a static layer:
  `setStatic(results)` replaces the whole static layer; existing
  `set(route, results)` remains the live layer. `snapshot()` returns the
  composed view per the merge rule and `badges()` exposes per-route provenance
  for the badge map. Composition logic is pure and unit-testable.
- **Analysis runner (new, packages/vite/src/ui/analysis.ts)** — owns the
  dynamic import of `svelte-vitals`, the startup run, the debounce/coalesce
  logic, and error containment. Interface shaped for tests (injectable
  `analyze` function and timers).
- **Watcher wiring (packages/vite/src/plugin.ts)** — `server.watcher.on('all', …)`
  filtered to `src/**`, `static/**`, `svelte.config.*`,
  `svelte-vitals.config.*`; ignores `node_modules`, `.svelte-kit`, `build`,
  `dist`. Registered only when `ui: true`.
- **Renderer (packages/core/src/reporter/html.ts)** — optional `routeBadges`
  rendering on route headings. Purely additive; no behavior change without the
  option.
- **serve.ts** — passes the badge map from the store snapshot into
  `buildHtmlDocument`.

## Data flow

```
vite dev 起動
  └─ ui plugin configureServer
       ├─ installUiMiddleware (既存)
       └─ analysis runner: dynamic import → analyzeProject(root) ──┐
発生イベント                                                        │
  ├─ ソース変更 → watcher → debounce 500ms → analyzeProject ────────┤
  └─ ページ訪問 → handle → POST /ingest → store.set(route, live) ──┤
                                                                    ▼
                                  store: static layer + live layer → SSE 'update'
                                                                    ▼
                     GET / → snapshot() 合成 + routeBadges → buildHtmlDocument
```

## Error handling

- Startup or re-analysis failure (not a SvelteKit root, internal error):
  `console.warn` once per failure and keep the previous static layer (or none —
  the dashboard then behaves like today's live-only mode). The dev server and
  the middleware never break.
- The analysis runs in the dev-server process; `analyzeProject` is pure
  in-process work (fs reads + parsing), a few seconds at most — no worker
  process in v1. If real projects report jank, moving it off-thread is a
  follow-up, not a v1 requirement.

## Non-goals

- Production serving, auth, multi-client coordination (unchanged deferral).
- Dark mode / syntax highlighting / route sort toggle (unchanged deferral).
- Changes to the build-mode plugin (`closeBundle` analysis of prerendered HTML).
- A public watch-mode API on `analyzeProject`.
- Per-file incremental re-analysis (full re-run is seconds; incremental is a
  follow-up if it ever isn't).

## Test plan

- **Store composition (unit, pure):** static only / live overrides matching
  rule ids on a visited route / component + site findings preserved /
  unvisited routes keep static / provenance map correctness.
- **Analysis runner (unit, fake timers, injected analyze fn):** startup run,
  debounce coalescing (N rapid changes → 1 run; change mid-run → exactly one
  follow-up), failure keeps previous layer + warns.
- **Plugin integration:** against a fixture SvelteKit project, `ui: true`
  `configureServer` populates the snapshot with all routes/categories without
  any page visit; SSE `update` fires after analysis completes.
- **Renderer:** `routeBadges` renders on route headings; omitted option
  produces byte-identical output to today.
