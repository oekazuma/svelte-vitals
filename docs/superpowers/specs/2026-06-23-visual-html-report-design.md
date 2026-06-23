# Design: Visual HTML report — toward 1.0

The "Lighthouse-like visualization" pillar of the 1.0 product thesis: a good-looking, self-contained HTML page that presents an analysis run (Health score, per-category and per-route scores, findings with fixes) so results are **easy to read** in a browser — the differentiated "presentation" capability alongside the just-shipped docs site.

## Scope

This spec covers **sub-project A** only:

- A shared, runtime-agnostic **HTML renderer** in `@svelte-vitals/core`.
- A CLI **`--reporter html`** that writes a self-contained `.html` file.

**Sub-project B** — a live UI mode in `@svelte-vitals/vite` (a `vitest --ui`-style dashboard that re-analyzes and updates as you edit) — is a **separate, later spec**. A is designed so B reuses the same renderer with zero changes (see "Reuse by sub-project B"). B is out of scope here.

## Goal

`svelte-vitals --reporter html` produces a single self-contained HTML file — inline CSS and JS, the report data baked into the markup, no external resources — that opens in any browser and shows the analysis as a polished report. It reuses the existing core scoring/JSON pipeline; the CLI owns file I/O. ESM-only.

## Approach: server-side templating + progressive-enhancement JS

`core` builds the **full HTML string with the report data already rendered into the markup** (not a client-side data→DOM renderer). A small inlined vanilla-JS layer adds interactivity (filter, expand, sort) on top of the already-rendered DOM — progressive enhancement.

Rationale:

- Core stays a **pure string function** — deterministic, snapshot-testable, no `node:` imports.
- Content is visible even with JS disabled; interactivity is additive.
- **Zero external dependencies** — no syntax highlighter, no chart lib, no framework — so the file is genuinely self-contained and CSP-safe.
- Maximal reuse for B: the vite UI calls the same `buildHtmlDocument` and hot-swaps the rendered HTML on each re-analysis; it needs no separate client-side renderer.

Rejected: a client-side renderer (ship an empty shell + inlined JS that renders a baked `JsonReport`). It would push core's rendering logic into a JS-string-in-TS that is awkward to test and maintain, for no benefit A or B needs.

## Components

### core — `packages/core/src/reporter/html.ts`

Mirrors the existing reporter signatures (`formatXReport(results, config, meta) → string`).

- `buildHtmlDocument(report: JsonReport, meta: { version: string }): string`
  Assembles the self-contained HTML document from an already-built `JsonReport`: inline `<style>`, the rendered report markup, and an inline `<script>` for interactivity. Pure; no I/O.
- `formatHtmlReport(results: Result[], config: Config, meta: { version: string }): string`
  Convenience matching the other reporters: calls `buildJsonReport(results, config, meta)` then `buildHtmlDocument(report, meta)`.

The CSS, interactivity JS, and markup helpers live as string constants/helpers in `html.ts` (or small sibling modules under `reporter/html/`). No `node:` imports, no external URLs (except the per-finding `docsUrl` links, which are normal anchors).

Exported from `packages/core/src/index.ts`: `buildHtmlDocument`, `formatHtmlReport`, and any public option type.

The renderer consumes the **existing `JsonReport`** (`buildJsonReport`) verbatim — no new data model:

```
JsonReport {
  version, score /* Health */, weights,
  categories: Record<cat, { score, scoreModel }>,
  summary, routes: [{ route, score, issues[] }], siteIssues[]
}
// each issue: { id, category, title, severity, detection, location, line?, recommendation, docsUrl?, fix? }
```

### cli — wiring

- `packages/cli/src/reporter-resolve.ts`: add `'html'` to `ReporterName` and `isReporterName`. `resolveReporter` treats `html` as an explicit-only choice (never auto-selected).
- `packages/cli/src/resolve-args.ts`: parse and carry a new `--out-file` string option; include `html` in the "unknown reporter" valid-values message.
- `packages/cli/src/index.ts` (`run`): when `reporter === 'html'`, render `formatHtmlReport(results, config, { version })` and write it:
  - default path `svelte-vitals-report.html` (cwd) when `--out-file` is absent;
  - `--out-file <path>` writes to that path;
  - `--out-file -` writes to stdout via the existing `log` (escape hatch for pipes/CI);
  - on file write, print `svelte-vitals: wrote report to <path>` to stderr (`console.error`).
  - File writing uses `node:fs` in the CLI (`writeFileSync`); core never touches the filesystem.
- `packages/cli/src/bin.ts`: update `HELP` — add `html` to the `--reporter` list and document `--out-file <path>` (default `svelte-vitals-report.html`; `-` for stdout); add `--out-file` to mri's `string` options.

Exit codes are unchanged: HTML is an output format, not a gate. Failure/CI gating still derives from findings and `--min-health`.

## Rendered content (v1)

Matches the approved mockup:

- **Top bar** — wordmark with the `↯` motif; run meta (mode, version, path, route/check counts) in monospace.
- **Hero** — a Health gauge (circular arc, color by score band) with the score in tabular monospace; severity tallies (critical/warning/info/passed); per-category bars (SEO, Performance) with their weights.
- **Routes** — a table of routes: path (monospace, `↯` marker when the route has dynamic metadata), a score chip (colored dot + number), an issue summary; rows expand to reveal that route's findings.
- **Findings** — grouped by route and a site-wide group; each finding is a card with a severity-colored left border, the rule-id chip, title, file location/line, recommendation, the fix snippet, and a "Learn more" link to `docsUrl`.

**Interactivity (inline vanilla JS):** filter findings by severity and category; expand/collapse route rows; sort the route table by score/route. Operates on the rendered DOM via data attributes — no data model on the client.

**Score color bands:** good `≥ 90` (green `#2FA968`), needs-work `50–89` (amber `#E8A317`), poor `< 50` (red `#E5484D`). Svelte orange `#FF3E00` is reserved for brand chrome (wordmark, eyebrows, links, the `↯` marker) and never used for score semantics.

**Fix snippets:** rendered as **uncolored** monospace code in `<pre><code>` for v1 (no syntax highlighting — that would require a highlighter dependency and breaks self-containment). Syntax highlighting is a possible follow-up.

## Correctness & security

- **Escape all interpolated content** — rule titles, messages, file paths/locations, and fix snippets — before inserting into HTML, to prevent broken markup or injection from project-derived strings. Fix snippets render as escaped text inside `<pre><code>`.
- **Self-contained guard:** the document references no external resources (no CDN CSS/JS/fonts/images). The only external links are per-finding `docsUrl` anchors. A test asserts the output contains no `src=`/`href=`/`url(` pointing at `http(s)://` except whitelisted `docsUrl` hosts.
- Deterministic output (no timestamps/random) so snapshots are stable. (Run metadata like a timestamp, if shown, is injected by the CLI via `meta`, not generated in core.)

## Reuse by sub-project B (designed-in, not built)

`@svelte-vitals/vite`'s future live UI mode will call the same `buildHtmlDocument(jsonReport, meta)` to render the page, serve it from the dev server, and on each re-analysis push a freshly rendered document (or just the body) to hot-swap. No client-side renderer is required; the interactivity JS is identical. Nothing in A is vite-specific.

## Testing

- **core** (`packages/core/test/html-report.test.ts`): `buildHtmlDocument` / `formatHtmlReport` output asserts — contains the Health score, each category score, a row per route, a card per finding, the rule-id and severity, the escaped fix snippet; HTML-escaping of a crafted malicious title/path; the self-contained guard (no non-`docsUrl` external references); a `<title>` and valid top-level structure.
- **cli** (`packages/cli/test/html-reporter.test.ts`): `--reporter html` writes the default file; `--out-file <path>` honored; `--out-file -` goes to stdout (not the filesystem); the stderr "wrote report to" message; `html` accepted by `isReporterName` and present in the unknown-reporter message; exit code unaffected by choosing html.

## Release

`@svelte-vitals/core` (new renderer) + `svelte-vitals` (new `--reporter html` + `--out-file`) **minor** changeset. `@svelte-vitals/vite` / `@svelte-vitals/mcp` cascade a patch via `workspace:*` as usual; no behavior change there.

## Documentation

Add the HTML report to the docs site (a short guide page or a section in the Reporters guide, en + ja) and mention `--reporter html` / `--out-file` in the CLI guide. Folded into the implementation plan's final task.

## Non-goals / follow-ups

- **Live vite UI mode** (sub-project B) — separate spec; the renderer here is built to be reused by it.
- **Syntax highlighting** of fix snippets — would add a dependency; revisit later.
- **Dark mode** (`prefers-color-scheme`) — v1 is light only.
- **Trend/history** across runs, and **charts** beyond the gauge/bars.
- **Bundling a framework** (Svelte/others) into the report — kept dependency-free and self-contained.
