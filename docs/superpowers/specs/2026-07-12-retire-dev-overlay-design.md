# Design: retire the dev overlay, default the live dashboard on

**Date:** 2026-07-12
**Status:** Accepted (maintainer-approved in session)
**Packages:** `@svelte-vitals/vite` (main), `svelte-vitals` (CLI installer copy/ids)

## Goal

As the project approaches v1.0, remove a feature made redundant by later work
instead of carrying it forward. `svelteVitalsHandle()`'s `console.warn`
output (docs call this the "dev overlay") predates the live dashboard
(`svelteVitals({ ui: true })`, `2026-06-23-vite-live-ui-design.md`) and is
now strictly worse for the same information: warnings print into the `vite
dev` log, interleave with HMR/Vite's own output, and scroll away. The live
dashboard shows the same findings (and more — whole-project coverage,
filtering, persistence) without disappearing.

Maintainer context (2026-07-12): the live dashboard is the intended primary
dev-time surface going forward; a failing `vite build` (via the existing
build-mode plugin, unaffected by this change) is considered a sufficient
safety net for anyone who doesn't check the dashboard. The dev overlay has
near-zero existing adoption, so this change carries **no backward-compatibility
constraint** — ids, labels, and doc URLs are free to change to whatever best
fits the new shape, not preserved for migration.

## Decisions (maintainer-approved)

1. **Remove `console.warn` from `svelteVitalsHandle` unconditionally** —
   regardless of the vite plugin's `ui` setting (including when the plugin
   isn't installed at all, or `ui: false`). The handle keeps running
   server-side (it's still what upgrades a route's dashboard findings from
   `static` to `measured`), it just never prints to the terminal.
2. **`@svelte-vitals/vite`'s `svelteVitals()` plugin: `ui` defaults to
   `true`.** Passing `ui: false` opts out (keeps only the build-time gate).
   This is the plugin's real dev-time value now — without it, `svelteVitals()`
   registers only the `apply: 'build'` plugin and does nothing during `vite
   dev` (confirmed in `plugin.ts`: `if (!options.ui) return buildPlugin;`).
3. **CLI installer: rename the `vite-dev-overlay` target to `vite-hooks`**,
   with copy describing its real effect (dashboard accuracy, not terminal
   warnings). No back-compat shim for the old id — `--client vite-dev-overlay`
   simply becomes invalid, same as any other typo.
4. **Docs: rename the guide file** `guides/dev-overlay.md` (en+ja) to
   `guides/dev-dashboard.md`, mirroring `guides/plugin-mode.md`'s naming for
   the build-gate guide. Content rewritten dashboard-first; the handle's setup
   section reframed as "improves dashboard accuracy," dropping every mention
   of terminal warnings. `sidebar.order: 5` (the existing value) carries over.

## Components

- **`packages/vite/src/hooks/handle.ts`** — `analyzeAndWarn` renamed
  `analyzeAndIngest` (it no longer warns). Drop the `formatDevReport` call
  and the `console.warn(report)` line entirely. Keep the
  `findingSignature`/`lastSignature` dedup — it still gates the `postIngest`
  call, preventing redundant SSE churn when an HMR pass re-renders a route
  with identical findings. The JSDoc above `svelteVitalsHandle` ("prints SEO
  warnings for each visited page's rendered `<head>`") is updated to describe
  the ingest-only behavior.
- **`packages/vite/src/hooks/format.ts`** — `formatDevReport` deleted
  (dead code once nothing calls it). `findingSignature` unchanged, still
  exported (used by `handle.ts` and its own test).
- **`packages/vite/src/plugin.ts`** — `const uiEnabled = options.ui ?? true;`
  replaces the current `if (!options.ui) return buildPlugin;` truthiness
  check. `SvelteVitalsOptions.ui`'s JSDoc gains "Default: `true`."
- **`packages/cli/src/install/vite-targets.ts`** — `id: 'vite-dev-overlay'`
  → `id: 'vite-hooks'`; `label: 'Dev overlay'` → `label: 'Live dashboard
  accuracy'`; `hint` changes from "Live warnings in `vite dev` only — never
  fails a build or CI" to "Feeds real rendered results into the live
  dashboard as you browse — improves per-route accuracy, never fails a
  build."
- **`packages/cli/src/install/index.ts`** — `planForDevOverlay`'s two
  `'vite-dev-overlay'` string literals (the `id` field and the
  `viteTargetById(...)` lookup) updated to `'vite-hooks'`. Function itself
  can keep its name or be renamed to `planForViteHooks` — implementer's call,
  no behavior difference.
- **`packages/cli/src/install/cli.ts`** — `INSTALL_HELP`'s `--client`
  description string updated: the enumerated id list and the sentence
  explaining what each target does.
- **Docs** — `docs/src/content/docs/guides/dev-overlay.md` and
  `docs/src/content/docs/ja/guides/dev-overlay.md` renamed to
  `dev-dashboard.md` in the same directories, content rewritten. Cross-links
  updated in (found via grep; the implementation plan should re-grep to
  confirm nothing's missed): `guides/cli.md`, `guides/plugin-mode.md`,
  `guides/choosing-a-package.md` (en+ja), and the root `README.md`.

## Non-goals

- Renaming `svelteVitalsHandle` itself, or moving/restructuring its export
  path (`@svelte-vitals/vite/hooks`). "Handle" is a SvelteKit term
  (`Handle` in `hooks.server.ts`), unrelated to the "overlay" branding being
  retired — no reason to churn a real API name here.
- Any change to the build-mode plugin (`apply: 'build'`, `closeBundle`) —
  explicitly called out by the maintainer as the safety net this change
  leans on. Untouched.
- Any change to how the live dashboard itself renders or what it shows
  (out of scope; covered by the two just-shipped Overview fixes in
  `fix/dashboard-logo-and-mouth`).
- A migration path or deprecation warning for the old `vite-dev-overlay`
  installer id — per the maintainer, adoption is near zero and no
  compatibility shim is needed.

## Testing

- **`packages/vite/test/dev-handle.test.ts`** — remove/replace assertions
  that expect `console.warn` to fire with a formatted report; add/keep
  assertions that `postIngest`-equivalent behavior (the SSE-facing side
  effect) still fires, gated by the existing signature dedup.
- **`packages/vite/test/dev-format.test.ts`** — drop `formatDevReport`
  tests; keep `findingSignature` tests.
- **`packages/vite/test/ui-plugin.test.ts`** (or wherever `plugin.ts` is
  covered) — add a test that `svelteVitals()` called with no options installs
  the ui plugin (dashboard middleware present) by default; keep/add a test
  that `svelteVitals({ ui: false })` returns only the build plugin.
- **`packages/cli/test/install/*.test.ts`** — update any test asserting on
  the `vite-dev-overlay` id, its label/hint text, or the `--client` help
  string, to the new `vite-hooks` id and copy.

## Release

- **`@svelte-vitals/vite`**: **minor** (removes a documented behavior —
  terminal warnings — and flips a documented option's default). Changeset
  describes both the removal and the default flip.
- **`svelte-vitals`**: **minor** (installer target id/label/hint change is a
  user-facing CLI surface change, even without a runtime behavior change to
  the analyzed project).
- **`@svelte-vitals/core`**: no change, no changeset.

## Documentation

- `docs/src/content/docs/guides/dev-overlay.md` → `dev-dashboard.md` (en),
  same rename for `docs/src/content/docs/ja/guides/`, per `AGENTS.md`'s
  en/ja-stay-in-sync rule. Content leads with the live dashboard as the
  default dev-time experience; the `svelteVitalsHandle()` setup section is
  reframed as "opt in for accurate per-route (`measured`) results" rather
  than "get warnings in your terminal."
- Update the `guides/cli.md`, `guides/plugin-mode.md`, and
  `guides/choosing-a-package.md` cross-links (en+ja) and the root
  `README.md` link found during this design's investigation to point at the
  new path/title. The implementation plan re-greps
  `dev-overlay|Dev overlay|vite-dev-overlay` across the repo (excluding
  `CHANGELOG.md` and `docs/superpowers/`, which are historical) to confirm
  full coverage before marking the doc task done.
