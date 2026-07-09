# Design: Live UI dashboard — closing the gap with `vitest --ui`

**Date:** 2026-07-09
**Status:** Proposed
**Packages:** `@svelte-vitals/vite` (all changes); `@svelte-vitals/core` unaffected

## Goal

The live dashboard (`svelteVitals({ ui: true })`, served at `/__svelte-vitals/`)
now shows every route and category from dev-server startup (whole-project
static analysis merged with live/rendered results per
`2026-07-08-dev-dashboard-whole-project-design.md`). This spec closes the
remaining experiential gap against `vitest --ui` (https://vitest.dev/guide/ui):
a master/detail layout, text search, sortable route list, a visible
analysis-in-progress state, and the three items earlier specs explicitly
deferred as non-goals — dark mode, fix-snippet syntax highlighting, and a
route sort toggle (`2026-06-23-vite-live-ui-design.md`,
`2026-07-08-dev-dashboard-whole-project-design.md`).

Scope is the **live UI dashboard only**. The CLI's `--reporter html` static
report and `packages/core/src/reporter/html.ts` (`buildHtmlDocument`) are
**not modified** — they keep rendering the current single-column report,
unchanged and byte-identical.

## Current pain points (why a layout rewrite, not incremental patches)

- Single-column layout with one `<details>` accordion per route makes large
  projects (dozens of routes) a long scroll with no overview-first entry
  point, unlike `vitest --ui`'s file list + detail pane.
- The live-update mechanism (`packages/vite/src/ui/serve.ts`'s injected
  `LIVE_SCRIPT`) re-fetches the full HTML document, parses it, and swaps the
  `.wrap` subtree, then re-executes a trailing `<script>` — this loses
  scroll position on anything but the swapped root and re-runs the gauge
  animation on every update. It's a workaround for the renderer being a pure
  string function with no client-side state.
- No way to search/filter by route path or rule id; no way to reorder the
  route list; no indication that a background re-analysis is in flight.

## Approach

Reuse `buildJsonReport` (from `@svelte-vitals/core`, unchanged) as the data
source, but replace the vite package's rendering path with a small,
dependency-free client-rendered dashboard:

1. **Shell + embedded JSON on first load.** `GET /__svelte-vitals/` returns
   an HTML shell (empty sidebar/detail containers, inline `<style>`, inline
   `<script>`) with the current snapshot embedded as
   `<script type="application/json" id="svelte-vitals-data">`. The inline
   script parses that element and renders the initial view — no second
   round trip for first paint.
2. **Live updates via re-fetch + client-side re-render.** The existing SSE
   channel (`GET /__svelte-vitals/events`, `event: update`) is unchanged in
   protocol. On `update`, the client fetches the same JSON payload from a new
   `GET /__svelte-vitals/data.json` endpoint and re-renders only the
   sidebar/detail DOM — selected route, search text, sort order, scroll
   position, and dark-mode preference all live in client-side state and
   survive the re-render.
3. **No new SSE event types.** The analyzing indicator piggybacks on the
   existing `update` notification (see Data & events below) rather than
   adding a second event kind — the store already has one change-notify path
   and this keeps the protocol as-is.

This is additive: `packages/core` is untouched, so the CLI's static report
and the MCP JSON path have zero blast radius.

## Data & events

- `packages/vite/src/ui/store.ts` gains:
  - `setAnalyzing(analyzing: boolean): void`
  - `isAnalyzing(): boolean`
  - Both participate in the existing `subscribe`/`notify` mechanism — setting
    analyzing state fires the same `update` SSE event as a findings change.
- `packages/vite/src/ui/analysis.ts`'s `AnalysisRunnerOptions` gains an
  optional `onStatusChange?(analyzing: boolean): void`, called with `true`
  right before `runOnce` starts its analyze call, and with `false` right
  after that call resolves — including when `runOnce` immediately schedules
  a coalesced follow-up (`pending` was set), so a rapid burst of changes may
  emit `false` then `true` again synchronously between runs rather than
  staying `true` throughout. That's an acceptable (if slightly noisy) signal
  for a UI indicator and requires no change to the runner's existing
  start/coalesce logic. `packages/vite/src/plugin.ts` wires this to
  `store.setAnalyzing`.
- A single payload shape is shared by the embedded-JSON shell and the
  `/data.json` endpoint, produced by one function (new,
  `packages/vite/src/ui/snapshot.ts` or colocated in `dashboard.ts`):
  ```ts
  interface DashboardSnapshot {
    report: JsonReport; // from buildJsonReport — unchanged
    badges: Record<string, 'measured' | 'static'>;
    analyzing: boolean;
    meta: { version: string; coreVersion?: string };
  }
  ```

## Layout

**Sidebar (left; collapses to a drawer under 640px, same breakpoint
philosophy as the existing responsive rule):**
- Search input — case-insensitive substring match against route path and,
  for the currently rendered set, finding rule id / title. Matching is
  client-side only (no server round trip).
- Sort control — Score (worst first) [default], Score (best first),
  Alphabetical, Most findings.
- "Overview" entry (default selection).
- Route list — one row per route with score chip, severity-count summary,
  and the existing `measured`/`static` badge. Click to select.

**Detail pane (right):**
- "Overview" selected → the existing hero gauge, per-category score bars,
  and site-wide checks (siteIssues) — the same content as today's top
  section, just relocated.
- A route selected → that route's finding cards (same card content as
  today: rule id, title, severity tag, location/line, recommendation, fix
  snippet, docs link).
- Severity/category filter chips remain, now scoped to filtering the
  detail pane's visible findings (both for Overview's site checks and for a
  selected route).

**Topbar:**
- Brand, version, core version (unchanged content).
- "Analyzing…" indicator, visible only while `analyzing` is true.
- SSE connection state (connected / reconnecting) — a small dot, mirroring
  `vitest --ui`'s watch-mode status.
- Dark-mode toggle.

## The three deferred items

- **Dark mode.** Toggle button in the topbar; preference persisted in
  `localStorage`; initial value follows `prefers-color-scheme` when no
  stored preference exists. Implemented as CSS custom-property overrides
  under `:root[data-theme="dark"]`, layered the same way the existing
  `--ground`/`--panel`/`--ink`/etc. tokens already work in
  `packages/core/src/reporter/html.ts`'s `STYLE` — the new dashboard defines
  its own token set (it has its own stylesheet; see Non-goals) rather than
  importing core's.
- **Fix-snippet syntax highlighting.** No new dependency. A small hand-rolled
  client-side tokenizer (keywords / strings / comments / punctuation) good
  enough for the JS/TS/Svelte/HTML/CSS snippets `fix.snippet` actually
  contains, keyed off the existing `fix.lang` hint when present and falling
  back to plain (unhighlighted) text otherwise. Consistent with the
  project's zero-runtime-dependency, self-contained-HTML ethos — a full
  grammar-based highlighter (Shiki/Prism) is explicitly rejected as
  disproportionate weight for this.
- **Route sort toggle.** The sidebar sort control described above.

## New / changed files (`packages/vite/src/ui/`)

- `dashboard.ts` (new) — builds the shell HTML (containers + inline
  `<style>` + inline `<script>` + embedded initial `DashboardSnapshot` JSON).
- `dashboard-style.ts` (new) — the new layout's CSS as a template string,
  including light/dark tokens. Hand-authored, following the precedent set by
  core's `STYLE` constant.
- `dashboard-script.ts` (new) — the client-side renderer as a template
  string: parses the embedded/fetched `DashboardSnapshot`, renders
  sidebar + detail pane, owns search/sort/selection/dark-mode/highlighting
  state, opens the `EventSource` and re-fetches `/data.json` on `update`.
- `store.ts` — add `setAnalyzing`/`isAnalyzing` (additive; existing exports
  unchanged).
- `analysis.ts` — add `onStatusChange` option (additive; optional, existing
  behavior unchanged when omitted).
- `middleware.ts` — add `GET /__svelte-vitals/data.json`; `/`, `/ingest`,
  `/events` keep their existing contracts (loopback-origin check reused
  as-is for the new route).
- `serve.ts` — superseded by `dashboard.ts` for the UI's own HTML; whether
  it's deleted or kept as a thin re-export is an implementation-time call
  (no design impact either way).

## Testing

- **store:** unit tests for `setAnalyzing`/`isAnalyzing`, and that setting
  analyzing state notifies subscribers the same way a findings change does.
- **analysis runner:** fake-timer test asserting `onStatusChange` fires
  `true` at the start of a run and `false` once it (and any coalesced
  follow-up) settles.
- **dashboard/snapshot:** the shell HTML contains a well-formed embedded
  `DashboardSnapshot` JSON (parseable, matches the given store snapshot);
  `GET /data.json` returns the same shape. String/structure assertions only.
- **middleware:** integration test for the new `/data.json` route
  (loopback-origin enforcement, 200 + correct JSON shape); existing route
  tests (`/`, `/ingest`, `/events`) continue to pass unmodified.
- **Client-side rendering (search/sort/selection/dark-mode/highlighting)
  is not unit-tested in Node**, matching the existing stated approach for
  the injected live-update script (string-presence/shape only). Verify
  manually against a fixture SvelteKit app (`pnpm --filter @svelte-vitals/vite dev`)
  before shipping — golden path (browse routes, confirm sidebar/detail sync)
  and edge cases (zero routes, all-passing project, dark mode + reduced
  motion, narrow viewport drawer).

## Non-goals

- Changes to `packages/core/src/reporter/html.ts` or the CLI's
  `--reporter html` output — stays byte-identical.
- A module dependency graph (unlike `vitest --ui`'s module graph) — no
  matching concept in svelte-vitals's domain; not requested.
- Any new external dependency (highlighting, icons, CSS framework) — the new
  dashboard-specific CSS/JS are hand-authored template strings, same pattern
  as core's existing `STYLE`/`SCRIPT`.
- Production serving, auth, multi-client coordination beyond the existing
  simple SSE fan-out (unchanged deferral, carried from both prior specs).
- Per-file incremental re-analysis, worker-thread analysis (unchanged
  deferral, carried from `2026-07-08-dev-dashboard-whole-project-design.md`).
- New SSE event types — the analyzing indicator rides the existing `update`
  event.

## Release

`@svelte-vitals/vite` **minor** (dashboard UX changes are additive and
opt-in behind `ui: true`, no breaking change to the plugin's public API).
No `@svelte-vitals/core` changeset needed (no change). Requires a changeset
per `AGENTS.md`.

## Documentation

Update the existing "Live UI dashboard" section in
`docs/src/content/docs/guides/dev-overlay.md` (en) and
`docs/src/content/docs/ja/guides/dev-overlay.md` (ja) to describe the new
layout (sidebar/detail, search, sort, dark mode) — folded into the
implementation plan's final task, per repo convention of keeping en/ja docs
in sync.
