# Design: Vite live UI mode — toward 1.0

Sub-project **B** of the "Lighthouse-like visualization" pillar. A `vitest --ui`-style live dashboard served by `@svelte-vitals/vite` during `vite dev`: as you navigate your app, each page's rendered `<head>` is analyzed and the dashboard updates live in the browser. It **reuses the core `buildHtmlDocument` renderer shipped in sub-project A** (PR #47) unchanged.

(Sub-project A — the CLI `--reporter html` self-contained report — already shipped. This spec is B.)

## Goal

`svelteVitals({ ui: true })` in `vite.config` serves a live svelte-vitals dashboard at `/__svelte-vitals/` during dev. The existing `svelteVitalsHandle` (already added to `hooks.server.ts` for the dev overlay) feeds it findings as you browse, and the dashboard re-renders without a full reload. Same look as the CLI HTML report, because it is the same renderer.

## Scope & coverage (honest, by the rendered model)

The data source is **rendered HTML, navigation-driven** — the same model as the dev overlay. Consequences, stated up front:

- Only **visited routes** appear; the dashboard accumulates as you browse (empty state invites navigation). Listing every route from the SvelteKit manifest is a **follow-up**, not v1.
- Coverage matches the dev handle: **SEO `<head>` rules** evaluated against real rendered values. **Performance image rules and project-wide checks (robots/sitemap) are not covered** by this mode (the handle marks them present to suppress, and collects no image data) — consistent with the existing dev overlay. The dashboard's category breakdown therefore shows **SEO** for now.
- **Health** is computed over the visited routes only (an evolving snapshot, not the whole-project score the CLI produces).

These are deliberate v1 boundaries that keep B vite-native and dependency-free; the whole-project static analysis (the CLI's `analyzeProject`) is **not** pulled into vite.

## Architecture & data flow

`svelteVitalsHandle` (SSR, inside the dev server process) and the plugin's dev middleware run in the same Node process but may be **different module instances** (SvelteKit's SSR module runner vs the plugin's context). So they communicate over **HTTP on the dev server's own origin**, not a shared module singleton.

1. **Navigate** → SvelteKit SSR → `svelteVitalsHandle` captures the rendered `<head>` via `transformPageChunk` and analyzes it (existing `analyzeAndWarn` logic).
2. When the UI is enabled, the plugin sets `process.env.SVELTE_VITALS_UI` (dev only). The handle, seeing that flag, also **`POST`s the route's findings** to `${event.url.origin}/__svelte-vitals/ingest` (fire-and-forget, errors swallowed — dev tooling must never break a request). Dev-overlay-only users (flag unset) are unaffected: no POST, no behavior change.
3. The plugin's `configureServer` middleware owns an **in-memory store** (`Map<route, Result[]>`, plus the resolved `Config` + version) and serves:
   - `GET /__svelte-vitals/` → `buildHtmlDocument(buildJsonReport(allResults, config, { version }), { version })`, the dashboard page, **with a small live-update script injected before `</body>`**.
   - `POST /__svelte-vitals/ingest` → parse `{ route, results }`, merge into the store (replace that route's entry), notify SSE subscribers.
   - `GET /__svelte-vitals/events` → an **SSE** stream; emits an `update` event whenever the store changes.

`buildJsonReport` groups results by `result.route` and computes Health, so the store keeps results keyed by route and concatenates them per request. Results already carry `route` (the build-time `analyze` path relies on it); the store stamps the ingest key onto any result missing one, so grouping is robust regardless.

## Reuse of `buildHtmlDocument` (unchanged)

`buildHtmlDocument` returns a full self-contained `<html>…</html>` document. The plugin reuses it **verbatim** and injects the live-update behavior by inserting a `<script>` immediately before the closing `</body>` in the served string. Core is not modified; the live script is a vite-side concern. The CLI static file (sub-project A) and the live UI thus render identically; only the live UI carries the extra injected script.

**Live-update script (injected):** opens `EventSource('/__svelte-vitals/events')`; on `update`, fetches `/__svelte-vitals/` HTML, parses it, and swaps the `.wrap` element's contents into the current document, then re-runs the gauge/filter init (so scroll position and active filter survive — no full-page reload). On SSE error it falls back to nothing (the last render stays).

## Components

- **`packages/vite/src/ui/store.ts`** — the findings store: `set(route, results)`, `snapshot(): Result[]` (flattened), change subscription for SSE. Pure data; unit-testable.
- **`packages/vite/src/ui/serve.ts`** — builds the served HTML: `renderDashboard(results, config, meta): string` = `buildHtmlDocument(buildJsonReport(...))` + injected live script. Pure; unit-testable.
- **`packages/vite/src/ui/middleware.ts`** — wires the three routes (`/`, `/ingest`, `/events`) onto the vite dev server, backed by the store. Owns SSE subscriber management.
- **`packages/vite/src/plugin.ts`** — gains a `ui?: boolean` option; when `ui` and in dev, a second plugin object (or `configureServer` + `apply` adjustment) installs the middleware and sets `process.env.SVELTE_VITALS_UI`. The existing build-time behavior is unchanged.
- **`packages/vite/src/hooks/handle.ts`** — when `process.env.SVELTE_VITALS_UI` is set, additionally POSTs `{ route, results }` to the ingest endpoint (fire-and-forget). Terminal-warning behavior is unchanged.
- Core: **no changes** — consumes `buildHtmlDocument` / `buildJsonReport` from `@svelte-vitals/core`.

## Enable / setup (two files, same as the dev overlay)

```js
// vite.config — serve the dashboard at /__svelte-vitals/ in dev
svelteVitals({ ui: true });
```

```ts
// src/hooks.server.ts — already present for the dev overlay; feeds the UI
export const handle = sequence(svelteVitalsHandle());
```

The build-time plugin (`apply: 'build'`) keeps gating builds; `ui` only affects `vite dev`.

## Testing

- **store** (`packages/vite/test/ui-store.test.ts`): `set`/`snapshot` flattens across routes; re-`set` of a route replaces (not appends); subscribers fire on change.
- **serve** (`packages/vite/test/ui-serve.test.ts`): `renderDashboard` output contains the `buildHtmlDocument` markup (Health score, a finding) AND the injected live script (`EventSource('/__svelte-vitals/events')`); the injection sits before `</body>`.
- **middleware** (`packages/vite/test/ui-middleware.test.ts`): a `POST /__svelte-vitals/ingest` then `GET /__svelte-vitals/` reflects the ingested route; `GET /__svelte-vitals/events` opens an SSE stream and an ingest emits an `update`. (Drive the connect handler directly with mock req/res; no real socket.)
- **handle** (extend `packages/vite/test/…`): with `SVELTE_VITALS_UI` set, the handle issues the ingest POST; unset, it does not. (Mock `fetch`; assert call/no-call.)
- Browser runtime behavior of the injected script is not unit-tested (string-presence + wiring only), matching sub-project A's approach.

## Release

`@svelte-vitals/vite` **minor** (new `ui` option + dev dashboard; handle gains opt-in ingest). No core change → no core changeset. `svelte-vitals` (CLI) unaffected.

## Documentation

Add a "Live UI" section to the docs site (en + ja) — a guide page or a section in the Plugin-mode / Dev-overlay guide — covering `svelteVitals({ ui: true })`, the `/__svelte-vitals/` URL, the two-file setup, and the rendered-model coverage caveats. Folded into the plan's final task.

## Non-goals / follow-ups

- **All-routes-from-manifest** upfront listing (v1 accumulates visited routes).
- **Performance/image and site-wide (robots/sitemap) coverage** in the live UI — would need image collection in the rendered provider or a different analysis source.
- **Whole-project static analysis in vite** (the CLI's `analyzeProject`) — intentionally not pulled in; would require extracting it to a shared lib.
- Production serving, auth, multi-client coordination beyond simple SSE fan-out.
- Syntax highlighting / dark mode (inherited from sub-project A's deferrals).
