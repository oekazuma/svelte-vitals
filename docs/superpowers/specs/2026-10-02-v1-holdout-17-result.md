# v1 holdout 17 — result (2026-10-02)

Measured with `main` at dbed6f49 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-02-v1-holdout-17-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. Raw first look:
`scripts/corpus/holdout-17-2026-10-02.json`; verdicts: `scripts/corpus/holdout-17-2026-10-02-verdicts.json`
(4,144 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of the nine deciding criteria fail: C6 and C7. C3 passes with no false
critical finding, C4 (99.3%) and C5 (99.6%) pass, and no key is `unclear`. C8, published without
deciding the result, is 20.1%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 7 of which built | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.3% (1,864 / 1,878)                          | pass     | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.6% (1,599 / 1,606)                          | pass     | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                | fail     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 2 rules below                                  | fail     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 20.1% (472 / 2,353)                            | reported | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 3,466, fp 21, design 657, unclear 0.

C7's rules: `a11y/id-duplication` 20.0% (1 / 5, 17 findings, 12 of them design) and
`seo/heading-level-skip` 58.3% (7 / 12). Both come from one app (ja-automation-platform): its layout's
URL-decided arm and its `SectionCard` heading, below. `seo/single-h1` is at 90.7% (78 / 86), just above
the threshold.

## Critical findings (C3)

3 critical findings, all `title-presence` and all tp: Black-Whale's `/strategy`, family-reunion's
`/admin/event/[eventId]/checkin` and gov-vote's `/`. Each was decided on its route's full render chain,
including the npm components the chain renders.

## False-positive classes

| Class                                                                                                                                                                                                                          | Findings | Apps | Rules                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ----------------------------- |
| **A layout `{#if}` on the request path the URL-arm reading does not cover**: `$page.route.id` in a list plus a pathname regex (ja-automation), a pathname compared with a non-literal (`` `/c/${slug}` ``, untitledconference) | 5        | 2    | **id-duplication**, single-h1 |
| **A component's `<h2>` behind `{#if title}` inside the component**, on a required prop every use passes (`SectionCard`)                                                                                                        | 5        | 1    | **heading-level-skip**        |
| An `<h1>` rendered through `{@html}` of markdown (legal pages)                                                                                                                                                                 | 4        | 1    | single-h1                     |
| A component imported from a directory barrel as `from '.'`, not followed to its `<h1>`                                                                                                                                         | 2        | 1    | single-h1                     |
| A `robots.txt` and `sitemap.xml` the app's own API server serves on the same origin                                                                                                                                            | 2        | 1    | robots-txt, sitemap-xml       |
| An `<h1>` in mdsvex `.svx` content the page renders                                                                                                                                                                            | 1        | 1    | single-h1                     |
| An `<aside>` inside a local component whose root is `<article>`, read as a top-level landmark                                                                                                                                  | 1        | 1    | top-level-landmark            |
| A second `await` that needs the first through a `Set` filled in a `forEach` over its result                                                                                                                                    | 1        | 1    | sequential-awaits             |

C6's class is the URL-decided layout arm. The two apps reach it through different tests, but both are
the one limit the docs state: only `page.url.pathname` (or `$page.url.pathname`) tested with
`startsWith`, `endsWith`, `includes` or `===` against a string literal decides an arm, so every other
request-path test leaves both arms counted. The `{@html}` heading class is the one holdouts 15 and 16
left open, here in one app; the `.svx` heading is a different mechanism and counted apart.

## C2 in detail

GitHub Actions run 37013508746 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 11 apps and crashed on none. Seven builds completed: dotsem.be (16 prerendered routes
analyzed), habit-runner (38), whoearns-live and Granthalay (their prerendered routes are all
`ssr = false` and were skipped), and dledger, untitledconference and family-reunion with no prerendered
page. After the plugin ran, LemonTV's and nrdbv2's builds failed on `$env/static/private` variables not
set, pulse's on an unbuilt sibling WASM package, and Black-Whale's on an unbuilt workspace package.
Before the plugin ran, ja-automation-platform, orderhive and gov-vote stopped on environment
configuration their server modules require at build time.

## Labelling notes

- The design share is concentrated in `description-presence` (140), `canonical-url` (130), `each-key`
  (88), `each-index-key` (48), `raw-html` (33) and `placeholder-label-option` (29); ja-automation, pulse,
  dledger and gov-vote together have 256 of the 472.
- Mixed keys were labelled by majority: two `PortalChrome` ids (fp on 5 of 6 routes), a dialog id
  (design on 4 of 5), and one `portal-main` id that is fp on `/app/manage` and a real duplicate on
  `/app/manage/worker-pay`, labelled tp.
- Conventions the labellers applied but questioned: og/twitter tags are never `design` and JSON-LD and
  the length rules stay `tp` on gated or noindex routes, while canonical and description there are
  `design`; a site's deliberate, commented omission of `og:title` labelled `tp`; the `SectionCard`
  headings labelled fp where an older entry with the `{#if}` at the use site was `design`; a computed
  `paths.base` whose default the app hard-codes into its redirects labelled `design` (ja-automation);
  `ssr-disabled` split between public content pages (`tp`) and tool screens (`design`); index-keyed
  validation messages labelled `tp`.
- Analyzer gaps that did not change a verdict: `load-waterfall` follows a dependent await inside an
  `if` branch although its docs say the scan does not enter one (nrdbv2, a real chain); the literal-
  `false` load flag that makes route-level rules skip a page is not applied to `sequential-awaits`
  (Black-Whale's `compare`/`perspectives`); `ssr-disabled`'s message says the whole app when some child
  pages set `ssr = true` (whoearns-live).

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs an
eighteenth holdout.
