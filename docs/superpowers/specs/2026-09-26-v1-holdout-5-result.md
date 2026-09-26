# v1 holdout 5 — result (2026-09-26)

Measured with `main` at d2800470 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-26-v1-holdout-5-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. This is the first holdout measured on installed checkouts: 12
apps installed; easyfest and langx failed to install and were measured uninstalled. Raw first look:
`scripts/corpus/holdout-5-2026-09-26.json`; verdicts: `scripts/corpus/holdout-5-2026-09-26-verdicts.json`
(5,643 distinct keys, every one labelled by checks over the source at the pinned commit, with npm
package components read from their published files).

**Result: not ready.** Four of ten criteria fail. C3 fails on one class: baca-quran renders its head
through a local `MetaTag` component placed inside `<svelte:head>`, and the `<title>` at that
component's top level is dropped, so 31 routes report a missing title they ship. C6 passes for the
first time: no false-positive class appears in more than one app.

| #   | Criterion                          | Threshold      | Measured                                       | Result | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0 of 14 apps                                   | pass   | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 5 of which built | pass   | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 31 (`title-presence`, one app)                 | fail   | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.7% (1,913 / 1,919)                          | pass   | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 93.5% (2,320 / 2,482)                          | fail   | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass   | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 4 rules below                                  | fail   | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 35.6% (1,090 / 3,059)                          | fail   | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass   | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 75 (new: `preconnect`, `positive-tabindex`)    | pass   | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 4,252, fp 199, design 1,192, unclear 0.

C7's four rules: `seo/json-ld` 69.7% (320 / 459), `seo/title-presence` 34.0% (16 / 47),
`seo/sitemap-xml` 80.0% (4 / 5), `performance/preconnect` 0% (0 / 16).

## False-positive classes

| Class                                                                                                                                        | Findings | Apps | Rules                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------------------------- |
| JSON-LD written literally in `app.html` is not read                                                                                          | 119      | 1    | json-ld                                   |
| **A `<title>` at the top level of a component rendered inside `<svelte:head>` is dropped**                                                   | 31       | 1    | **title-presence**                        |
| JSON-LD through `{@html VAR}` whose name does not match the pattern (documented limit)                                                       | 20       | 1    | json-ld                                   |
| A `<link rel="preconnect">` in `app.html` is not read                                                                                        | 16       | 1    | preconnect                                |
| A load that throws `error()` on every path is not recognised as never rendering the page                                                     | 7        | 1    | canonical, og-\*, twitter-card, single-h1 |
| `%placeholder%` tokens in `app.html` that `hooks.server` replaces are read as the literal text                                               | 2        | 1    | title-length, description-length          |
| Single findings: a sitemap served through `reroute`; `role="heading"`; an arm a store default rules out; an await dependent through `push()` | 4        | 4    | various                                   |

The title class is the only critical one. `MetaTag.svelte` has `<title>{title}</title>` at its top
level, which Svelte parses as a regular element outside `<svelte:head>`; the source pass's head-tag
extraction handles `<title>` only as the `<svelte:head>` title element, while the `<meta>` tags of the
same component are read.

## Installed measurement

Following components from installed npm packages met its first holdout. The three apps whose head
comes from a package without an adapter (`@foxui/core`, `sk-seo`, svelte-ux) produced no false
positive from that path: their remaining "Missing" findings are tags the package components do not
render on those routes (for example `@foxui/core`'s `Head` has no canonical), labelled `tp`. The
labellers read the packages from their published files at the locked versions.

## C2 in detail

GitHub Actions run 36213977115 (harness in `scripts/holdout-build/`; an earlier run, 36213675974,
had the same build outcomes but no first look because the harness checkout lacked `scripts/corpus`).
The plugin ran and wrote its report on 11 apps and crashed on none. Five builds completed (cosmic,
atmo-events, istota, baca-quran, catalogmx); baca-quran prerenders 19,074 pages and catalogmx 48.
Avi-ADAM and behovskartan failed only at the plugin's own critical gate. The others failed on their
own: a Prisma client not generated (Bria-nutrition), a missing source file (bocchio.dev), a workspace
SDK without a built entry (roomy), `DATABASE_URL` not set (open-reception), a workspace package
without its generated tsconfig (typie), and failed installs (easyfest, langx).

## Labelling notes

- The design share is concentrated: Avi-ADAM alone has 498 of the 1,090 critical and warning
  `design` findings, 264 of them one component's SVG ids in an `{#if}` arm a literal prop rules out.
  Across apps, `id-duplication` (341), `each-key` (198), `canonical-url` on non-search routes (133)
  and `raw-html` (104) make up most of it.
- Conventions the labellers applied but questioned: a load that always throws `error()` as "never
  renders" (`fp`, extending the always-redirect precedent); JSON-LD through an unmatched `{@html}`
  as `fp` although documented; a sitemap reached through an in-app `reroute` as `fp` (an external one
  was `design`); `design` only for `canonical-url` on gated routes, never for og-\* or twitter-card;
  named length-only lists (`new Array(100)`) still reported by each-key; and admin-written HTML split
  between `tp` and `design` across apps.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
sixth holdout.
