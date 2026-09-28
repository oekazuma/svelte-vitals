# v1 holdout 9 — result (2026-09-28)

Measured with `main` at 45cce07c on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-28-v1-holdout-9-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. The packed CLI
reports version 0.55.2, the last release; the code is `main` after it. Raw first look:
`scripts/corpus/holdout-9-2026-09-28.json`; verdicts: `scripts/corpus/holdout-9-2026-09-28-verdicts.json`
(6,167 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit,
with npm package components read from their published files).

**Result: not ready.** Three of ten criteria fail: C6, C7 and C8. C3 passes with no false critical
among 50 critical findings, C1 passes on the app with a 305 KB component, and C4 (99.0%) and C5
(98.5%) pass.

| #   | Criterion                          | Threshold      | Measured                                       | Result | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 5 of which built | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0 (42 tp, 8 design)                            | pass   | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.0% (1,744 / 1,761)                          | pass   | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 98.5% (2,882 / 2,926)                          | pass   | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                              | fail   | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 4 rules below                                  | fail   | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 42.7% (1,342 / 3,145)                          | fail   | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.02%)                                  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 77 (no new rule)                               | pass   | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 4,668, fp 61, design 1,437, unclear 1.

C7's four rules: `security/server-module-state` 33.3% (1 / 3), `correctness/prop-mutation` 75.0%
(3 / 4), `seo/single-h1` 82.6% (19 / 23), `seo/heading-level-skip` 88.9% (40 / 45).

## Critical findings (C3)

44 `title-presence` (42 tp: routes with no `<title>` anywhere on their render chain, in commons,
applykit, Facet, emm and grav-admin-next; 2 design: commons's iframe-embedded campaign widget and
ochorus's `noindex` crawl anchor), 5 `handler-state-write` and 1 `server-browser-global`, all design.
The five writes do run on the server, but none holds per-user data: emm's site-wide settings and
initialisation stage and its content-hash ETag cache, and commons's two `Map`s keyed by random
single-use nonces. cloudlands-fe reads `window` at module scope in a runes module that only the browser
evaluates (root `ssr = false`, adapter-static, no server files).

## False-positive classes

| Class                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Findings | Apps | Rules                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| JSON-LD from `{#each structuredData as ld}{@html ld}{/each}`, with neither the list nor the item named for JSON-LD; and `{@html siteLd}` built by an imported call                                                                                                                                                                                                                                                                                                                        | 28       | 1    | json-ld                                                                                                     |
| Routes whose load throws 404 on a feature flag that is the literal `false` in an imported `as const` object                                                                                                                                                                                                                                                                                                                                                                               | 18       | 1    | canonical-url, og-\*, twitter-card, json-ld, title-length, description-presence, heading-level-skip         |
| **An extra `<h1>` in a sibling `{#if}` whose condition excludes the first** (`{#if pitch}` / `{#if !pitch}`, `{#if step === n}`)                                                                                                                                                                                                                                                                                                                                                          | 3        | 3    | single-h1                                                                                                   |
| **A child component's heading before the flagged heading, not seen** (Facet `AccordionSection`, grav-admin-next `PageMedia`)                                                                                                                                                                                                                                                                                                                                                              | 3        | 2    | heading-level-skip                                                                                          |
| Reassignments only the browser reaches (inside `if (browser)`) reported as server module state                                                                                                                                                                                                                                                                                                                                                                                            | 2        | 1    | server-module-state                                                                                         |
| Single findings: a component chosen from a lookup table (`<svelte:component this={Component}>`); an `<h2>` inside `{@html}` post content; `<button>` in a customizable `<select>` (`appearance: base-select`), newer than the vendored spec data; a layout arm that renders the page bare on one route, folded to `<main>`; `.set()` on a prop whose method does not mutate it; a constant list whose name a parameter elsewhere shadows; a sitemap served by a Firebase function rewrite | 7        | 4    | single-h1, heading-level-skip, permitted-contents, top-level-landmark, prop-mutation, each-key, sitemap-xml |

C6's two classes are the separate `{#if}` blocks whose conditions exclude each other (ochorus, emm,
cloudlands-fe), which the prop-decided arm handling does not cover because the condition is local
state, and child-component headings for `heading-level-skip`, the documented limit that failed C6 in
earlier holdouts (Facet, grav-admin-next). The JSON-LD class is the shape holdout 8's fix left open:
OpenCW's `{#each structuredDataScripts}` gave no finding, ochorus's did.

## C2 in detail

GitHub Actions run 36365927997 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Five builds completed (patterns, which prerenders 71 routes,
grav-admin-next, Facet, atmoBB and applykit). wordplay's `vite build` finished with the plugin
analysing 353 prerendered routes; the build script then failed compiling its Firebase functions. emm
and commons stopped at the plugin's own critical gate. The others failed on their own, after the plugin's
source pass: `$env/static` variables not set (boris, rescued, rwm-front, OpenCW). Two failed before the
plugin ran: ochorus's build first fetches its language list from its API and stops without it, and
cloudlands-fe's `vite.config.mjs` could not be wrapped, because the harness imports the renamed config
without its extension, which an `.mjs` config does not resolve (a harness defect, not the app's).

## Labelling notes

- The design share is concentrated in `raw-html` (334), `each-key` (315), `description-presence`
  (218) and `canonical-url` (201); Facet, grav-admin-next and commons together have 717 of the 1,342.
  `raw-html` is design for HTML the app renders from its own or its admin's content; 18 are tp,
  including mermaid rendered with `securityLevel: 'loose'` and unsanitised markdown of agent output.
- Conventions the labellers applied but questioned: og/twitter findings on an Electron renderer
  (cloudlands-fe) as `tp`; `role="tooltip"` with `aria-label` as `tp` under ARIA 1.3's prohibition;
  a child-component heading before the flagged one as `fp` although the page still skips a level at the
  component's heading; an init-only reassignment reached through helper calls as `design`.
- The one `unclear` is an `srcdoc` iframe without `loading` (commons), as in the ledger: whether lazy
  loading defers `srcdoc` decides it.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a tenth
holdout.
