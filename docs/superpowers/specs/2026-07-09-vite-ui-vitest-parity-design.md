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

**Tradeoff, stated explicitly:** this abandons `2026-06-23-vite-live-ui-design.md`'s
core value that the live UI and the CLI's `--reporter html` are pixel-identical
because they share one renderer. The new dashboard reimplements finding
cards, the score gauge, category bars, and severity clamping in
`dashboard-script.ts`/`dashboard-style.ts` instead of reusing core's
`render*` functions. That's an accepted cost — the two surfaces are already
free to diverge in the whole-project-analysis spec (badges are dashboard-only)
— but it means a new `Issue`/`JsonReport` field or a severity-handling fix
must be applied in **two places** (`packages/core/src/reporter/html.ts` and
`packages/vite/src/ui/dashboard-script.ts`) going forward, not one.

## Data & events

- `packages/vite/src/ui/store.ts` gains:
  - `setAnalyzing(analyzing: boolean): void`
  - `isAnalyzing(): boolean`
  - `sequence(): number` — an internal counter incremented on every
    `notify()` call (i.e. by `set`, `setStatic`, and the new `setAnalyzing`
    alike), exposed for the payload's `sequence` field below.
  - All participate in the existing `subscribe`/`notify` mechanism — setting
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
    sequence: number; // monotonically increasing per store notify
    meta: { version: string; coreVersion?: string };
  }
  ```
- **Notify ordering.** `runOnce` in `analysis.ts` calls `opts.onResults(results)`
  inside the `try` block, before the `finally` where `onStatusChange(false)`
  would fire — so `store.setStatic(...)` (→ notify) always happens before
  `store.setAnalyzing(false)` (→ notify) for the same run. Consumers therefore
  never observe `analyzing: false` paired with a stale (pre-run) snapshot.
  This ordering falls out of `analysis.ts`'s existing control flow and needs
  no new logic — only the `plugin.ts` wiring (`onResults` → `store.setStatic`,
  `onStatusChange` → `store.setAnalyzing`) has to preserve it, i.e. don't
  reorder or batch these two calls.
- **Sequence number guards out-of-order fetches.** Because a single analysis
  run can fire two or three `update` events in quick succession
  (`setAnalyzing(true)` → `setStatic` → `setAnalyzing(false)`), the client may
  have more than one `GET /data.json` in flight at once, and network jitter
  can resolve them out of order. `store` increments an internal counter on
  every `notify()` and stamps it onto `DashboardSnapshot.sequence`; the client
  tracks the highest `sequence` it has rendered and discards any response
  with a lower one.
- **SSE reconnection resync.** `EventSource` auto-reconnects on a dropped
  connection (dev-server restart, laptop sleep/wake) but replays no missed
  events. The client re-fetches `/data.json` not only on `update` but also on
  the `EventSource`'s `open` event (which also fires on the initial
  connection and every reconnect) — cheap and idempotent given the sequence
  guard above, and it's what makes the topbar's connected/reconnecting dot
  meaningful rather than cosmetic.

## Security: embedded JSON and client-side rendering

Finding content (`location`, `recommendation`, `fix.snippet`, route paths)
originates from analyzed source and, for live results, from rendered `<head>`
values ingested at `POST /ingest` — `middleware.ts`'s `isResultLike` (line 23)
validates *types* only, not content, so any of these fields can legitimately
contain `<`, `</script>`, or similar. Two places need explicit treatment that
`buildHtmlDocument` already handles for the CLI report but the new dashboard
must reimplement, since it no longer goes through `escapeHtml`/`safeHref`:

- **Embedding the snapshot as `<script type="application/json">`.** After
  `JSON.stringify(snapshot)`, replace every less-than character (codepoint
  U+003C) in the result with its 6-character `\uXXXX` JSON escape form —
  this blocks a `</script>` breakout — and do the same for U+2028/U+2029
  (which some environments still choke on inside inline `<script>` content)
  before writing the tag. Apply this once, in the shared function that
  produces the shell HTML and the `/data.json` body — the latter doesn't
  strictly need it (it's served as `application/json`, not inlined), but
  using one code path avoids a forgotten special case.
- **Rendering finding fields into the DOM client-side.** Build nodes via
  `textContent`/`setAttribute`, never by interpolating finding strings into
  an `innerHTML` template — this is the client-JS equivalent of core's
  `escapeHtml`. For `docsUrl`, reimplement `safeHref`'s http(s)-only check
  (`packages/core/src/reporter/html.ts` line 33) before setting `href`, since
  the dashboard no longer runs the value through core's renderer. The
  syntax-highlighting tokenizer must escape token text the same way — it
  operates on `fix.snippet`, which is unescaped source-like text.

## Layout

**Sidebar (left; collapses to a drawer under 640px, same breakpoint
philosophy as the existing responsive rule):**
- Search input — case-insensitive substring match, filtering **which routes
  appear in the sidebar list** (not the detail pane's contents). A route
  matches if its path matches, or if any of its findings' rule id/title/
  location matches. Selecting a route from a filtered list still shows all
  of that route's findings in the detail pane — narrowing the detail pane
  itself remains the severity/category chips' job, kept separate so the two
  controls don't fight over what "filtered" means.
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

**Selection persistence.** The selected route (or "Overview") is reflected in
`location.hash` (`#overview` or `#route/<slug>`, reusing the slugging scheme
from `packages/core/src/reporter/html.ts`'s `slug()`, reimplemented
client-side since that helper isn't exported). On load, the client selects
from the hash if present and valid, else defaults to Overview. This is a
small addition on top of the client-state selection model already required
for live updates, and it's what keeps a reload or a shared link from losing
the user's place — a gap the current accordion layout doesn't have
(browser-native anchor scrolling to a route's `id`) and the new layout would
otherwise introduce.

**Baseline accessibility.** The sidebar route list and Overview entry get
list semantics and `aria-current`/`aria-selected` on the active item; focus
states follow the existing filter chips' `:focus-visible` treatment
(`packages/core/src/reporter/html.ts`'s `STYLE`, `.chip:focus-visible`). Full
screen-reader/a11y audit of the new layout is out of scope for this pass (see
Non-goals) — this is the same baseline the existing chips already meet, not a
new accessibility initiative.

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
  (no design impact either way). If deleted, `packages/vite/test/ui-serve.test.ts`
  (which asserts on the old `LIVE_SCRIPT`-injection behavior per
  `2026-06-23-vite-live-ui-design.md`'s test plan) is retired along with it;
  its assertions are superseded by the new dashboard/snapshot tests below.

## Testing

- **store:** unit tests for `setAnalyzing`/`isAnalyzing`, that setting
  analyzing state notifies subscribers the same way a findings change does,
  and that the snapshot's `sequence` strictly increases across `set`/
  `setStatic`/`setAnalyzing` calls.
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
  motion, narrow viewport drawer, a stopped/restarted dev server to confirm
  the reconnect resync actually recovers the dashboard).

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
- Showing passing (non-penalized) results. `JsonReport.routes[].issues` only
  ever contains penalized findings (`packages/core/src/reporter/json.ts`,
  the `isPenalized` filter) — the new dashboard shows the same set as today.
  A "passed rules" view would need a `JsonReport` shape change and is a
  separate follow-up.
- Full accessibility audit / screen-reader testing of the new layout — only
  the baseline parity described under Layout is in scope.

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
