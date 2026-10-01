# v1 holdout 15 — result (2026-10-02)

Measured with `main` at ebd7b123 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-02-v1-holdout-15-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. Raw first look:
`scripts/corpus/holdout-15-2026-10-02.json`; verdicts: `scripts/corpus/holdout-15-2026-10-02-verdicts.json`
(8,727 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of the nine deciding criteria fail: C6 and C7. C3 passes with no false
critical finding, C4 (99.0%) and C5 (99.2%) pass, and there is no `unclear` verdict. C8, published
without deciding the result, is 28.2%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 9 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.0% (3,070 / 3,101)                          | pass     | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.2% (3,956 / 3,990)                          | pass     | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                              | fail     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 5 rules below                                  | fail     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 28.2% (1,223 / 4,344)                          | reported | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 7,046, fp 65, design 1,616, unclear 0.

C7's rules: `a11y/duplicate-landmark` 50.0% (6 / 12), `a11y/top-level-landmark` 60.0% (15 / 25),
`a11y/id-duplication` 72.7% (8 / 11, 22 findings, 11 of them design), `correctness/unmutated-state`
73.9% (17 / 23) and `seo/heading-level-skip` 87.7% (121 / 138). The first two and most of the last come
from one class in one app (omniget's layout flags, below).

## Critical findings (C3)

23 `title-presence`, the only critical findings: 20 tp (prima 19, snowballr-frontend 1) and 3 design
(prima's `/debug` and `/tests`, which `hooks.server.ts` answers with 403 off localhost, and its unlinked
`/statistics` page). Every key was decided on its route's full render chain, including the npm
components the chain renders.

## False-positive classes

| Class                                                                                                                                          | Findings | Apps | Rules                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ---------------------------------------------------------------------- |
| A layout renders the page only in the `{:else}` of `{#if !FLAG}`, `FLAG` being an app module's literal `false` (the template form, not `load`) | 32       | 1    | **duplicate-landmark**, **top-level-landmark**, **heading-level-skip** |
| A route no request reaches: `hooks.server.ts` sends session-less requests to `/login`, the page's load sends signed-in ones to `/`             | 12       | 1    | 12 route-level SEO and performance rules                               |
| A `$state` a function creates and returns, then the caller mutates                                                                             | 5        | 1    | **unmutated-state**                                                    |
| An imported constant list from a module whose name has a dot (`dua.model`) read as having a file extension                                     | 3        | 1    | each-key                                                               |
| **Prop-decided `{#if}` arms not resolved for ids** (`export let title = ''` never passed; `errors={{}}`)                                       | 2        | 2    | **id-duplication**                                                     |
| **An `<h1>` rendered through `{@html}`** (a guide's markdown, a frozen HTML template)                                                          | 2        | 2    | single-h1                                                              |
| A heading behind `{#if $store.flag}` that only one route's `onMount` sets                                                                      | 2        | 1    | single-h1                                                              |
| Headings a Prismic `SliceZone` lookup or `DefaultComponent` arm renders (or cannot)                                                            | 2        | 1    | single-h1                                                              |
| Two `<h1>`s in the arms of one `{#if}`/`{:else}` counted together                                                                              | 1        | 1    | single-h1                                                              |
| A heading inside a bits-ui `Portal`, which renders at the end of `<body>`                                                                      | 1        | 1    | heading-level-skip                                                     |
| A pathname test reached through two `$derived` bindings and `&&`                                                                               | 1        | 1    | id-duplication                                                         |
| A `$state` written through a `$derived` alias                                                                                                  | 1        | 1    | unmutated-state                                                        |
| A `<text>` outside any `<svg>` judged as `svg:text`                                                                                            | 1        | 1    | permitted-contents                                                     |

C6's two classes are the prop-decided id arms (Contour and beachfront-dentistry; holdout 14 had the same
gap as threadline's `{:else if}` chain) and `{@html}` headings (smart-job-seeker and
beachfront-dentistry). The layout-flag class is the template form of the load flag holdout 14 closed.

## C2 in detail

GitHub Actions run 36888329027 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Nine builds completed: faf-one (182 prerendered routes analyzed),
fmadore's Website (198), beachfront-dentistry (81), and omniget, snowballr-frontend, summit, BookShelf,
prima and twincars-manager with no prerendered page. The others failed on their own: `$env/static`
variables not set (duas-pro-frontend, comedy-connector-app, muenstererOS); and, before the plugin ran,
smart-job-seeker's build script running its own `npm i`, which removed the plugin the harness had
installed, and pnpm refusing Contour's Prisma build scripts.

## Labelling notes

- The design share is concentrated in `description-presence` (367), `canonical-url` (243),
  `image-dimensions` (200), `each-key` (199), `image-loading-hint` (182) and `raw-html` (113); omniget,
  smart-job-seeker, BookShelf and prima together have 764 of the 1,223.
- omniget's flagged study routes still serve a page (the shell and a maintenance card), so their
  canonical and og/twitter claims are design and tp; only the page's own headings and landmarks, which
  never render, are fp.
- Conventions the labellers applied but questioned: a desktop shell's canonical as tp (three Tauri apps)
  where an Electron one was design; og/twitter as tp on routes behind a login; description-presence on
  public login pages split by whether the app has a public deployment; token landing pages as design
  where an earlier invite page was tp; the 404-gate split for `sequential-awaits`; a hidden file input in
  a drop zone (design here, tp in older entries); prop-decided id arms as fp where an older entry said
  design; and Prisma on SQLite as tp for `sequential-awaits`, unlike a synchronous SQLite driver.
- Analyzer gaps that did not change a verdict: `{@const}` aliases are not treated as escapes by
  `state-raw` (each alias here was read-only); prima's session-only routes crash for anonymous visitors
  rather than redirect; and a `page.route.id` test in a layout is not read as a URL-decided arm.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
sixteenth holdout.
