# v1 holdout 19 — result (2026-10-03)

Measured with `main` at 40212bae on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-03-v1-holdout-19-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 of the 14 installed; d-scan.space's install stopped on its `engines` field
(Node ≥ 26), so it was measured uninstalled. Raw first look: `scripts/corpus/holdout-19-2026-10-03.json`;
verdicts: `scripts/corpus/holdout-19-2026-10-03-verdicts.json` (2,976 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of the nine deciding criteria fail: C6, on two classes shared by two or
more apps, and C7, on `correctness/prop-mutation`, whose false positives come from two apps. C3 passes
with no false critical finding, C4 (98.7%) and C5 (98.9%) pass, and no key is `unclear`. C8, published
without deciding the result, is 29.6%. Both failures rest on labelling and grouping calls the ledger
does not settle; the section on C6 gives the result under the other readings.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 10 apps, 7 of which built | pass     | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 98.7% (984 / 997)                              | pass     | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 98.9% (1,381 / 1,396)                          | pass     | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                              | fail     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 1 rule below (2 by the earlier definition)     | fail     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 29.6% (440 / 1,489)                            | reported | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns are the earlier definition, as published; the same holdouts under the current
one are in `2026-10-03-c7-multi-app.md` (holdout 18: 1).

Verdicts (distinct keys): tp 2,417, fp 28, design 531, unclear 0.

C7's rule: `correctness/prop-mutation` 42.9% (3 / 7, 30 findings, 23 of them design), with its 4 false
positives from couchmun (3) and mankunku (1). By the earlier definition `a11y/top-level-landmark` also
fails, at 87.0% (20 / 23, all 3 false positives from inkforum). `seo/single-h1` is at 95.2% (119 / 125),
with false positives from four apps.

## Critical findings (C3)

53 critical findings, all `title-presence`: 52 tp (comcent-ce 38, geometa 7, dotfyle 6, couchmun 1)
and 1 design, couchmun's `/admin/bloc-identifier`, whose page file is empty and linked from nowhere.
Each was decided on its route's full render chain, including the npm components the chain renders.

## False-positive classes

| Class                                                                                                                                                                  | Findings | Apps | Rules                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------- |
| **A mutating method name (`clear`, `delete`) called on a prop whose method does I/O or is a callback**: a Dexie table (`db.delegates.clear()`), an object of functions | 4        | 2    | **prop-mutation**                                 |
| **An arm on runtime state that never holds on the route**: a store field only another page sets, a store flag no reachable code sets, `page.data.bare` a load returns  | 8        | 3    | single-h1, top-level-landmark, duplicate-landmark |
| `{@html ldTag(item)}` over a list named `ld`, a JSON-LD `<script>` the naming patterns do not catch                                                                    | 8        | 1    | json-ld                                           |
| A path test called through a `$derived` (`isOnboardingRoute(page.url.pathname)`)                                                                                       | 2        | 1    | single-h1                                         |
| An alias of an imported store's `$state` member (`const s = store.field`) read as non-reactive                                                                         | 2        | 1    | effect-as-onmount                                 |
| A component `{#if}` on a prop in a compound test (`showcase && layout === 'cover'`), and a layout's regex path test on a route with a parameter                        | 1        | 1    | duplicate-landmark                                |
| Snippets passed as arguments to another snippet (`withSidebar(wide)`), counted outside their `{#if}` arms                                                              | 1        | 1    | single-h1                                         |
| A bits-ui `Dialog.Title` heading role carried in a prop spread, not read                                                                                               | 1        | 1    | heading-level-skip                                |
| A `robots.txt` the build script copies into the git-ignored `static/`                                                                                                  | 1        | 1    | robots-txt                                        |

C6's two classes:

- `prop-mutation` reads `clear`/`delete`/`add`/`set` on a prop as a mutation whatever the receiver is.
  The ledger already labels the same shape fp elsewhere (a service adapter's `delete`, a formatter's
  `messages.add`); this round it reaches two apps.
- The runtime-state arms reach the one limit the docs state: an arm behind a runtime condition is
  counted. They do it through three mechanisms: a store field set on one page and reset in
  `onNavigate` (couchmun), a store flag behind a navigation no caller reaches (genshin-music), and
  `page.data.bare`, a flag the route's load returns as `true` (inkforum, landmarks). They are counted
  as one class, as holdout 17 counted two apps' different request-path tests as one. The `page.data`
  arm is the shape holdout 18 left open (gustav's `hidePageHeading`), here in a second holdout.

Under the other readings:

- couchmun's three calls are on a Dexie table, a persistence client's own API. The ledger labels that
  shape both ways: `design` for a settings store's or a drafts client's persistence `set` (5 entries),
  `fp` for a service adapter's `delete` and a `set` that writes the database (2). Labelled `design`,
  `prop-mutation` keeps one false positive from one app: C7 passes and its C6 class reaches one app.
- Split by mechanism, the runtime-state arms are three single-app classes.
- With both, every deciding criterion passes. With either one alone, C6 still fails.

## C2 in detail

GitHub Actions run 37098763526 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 10 apps and crashed on none. Seven builds completed: fivethirtyeightindex.com (1,107
prerendered routes analyzed), geometa (19), mozilla/performance (its 11 prerendered routes are
`ssr = false` and were skipped), and ScoreGuide, comcent-ce, 10xPrivacy and social-front with no
prerendered page. After the plugin ran, couchmun's build was stopped by the plugin's own gate on its
critical findings (13 prerendered routes analyzed), and nguh.org's and mankunku's failed on
`$env/static` variables not set. Before the plugin ran, genshin-music's prerender stopped on a 404 for
`/favicon.ico`, dotfyle's build on a Prisma client not generated, and inkforum's on an unbuilt
workspace package. d-scan.space was not built: its install stopped on its `engines` field.

## Labelling notes

- The design share is concentrated in `each-index-key` (73), `raw-html` (70), `each-key` (63),
  `description-presence` (62) and `canonical-url` (57); comcent-ce, inkforum, social-front and
  mankunku together have 286 of the 440.
- Mixed keys were labelled by majority: mankunku's `Onboarding` `<h1>` (fp on 28 of 29 routes; on
  `/tricks/[id]` the overlay can mount), inkforum's `CustomPageContent` `<h1>` (fp on 2 of 3 routes) and
  `AuthCard` `<main>` (fp on 5 of 6).
- Conventions the labellers applied but questioned:
  - og/twitter tags and JSON-LD are never `design`, while canonical and description are `design` on
    routes that are not search targets; the same route can be `tp` for one and `design` for the other.
  - A `<style>`-dominated component over 200 lines is `tp` for `component-size`.
  - Admin-entered raw HTML is `tp` in one ledger entry and `design` in another.
  - The `each-key` exemption takes only `const`, while its docs say "nothing in the file can change it".
  - Method calls on a plain-class prop are `design`, though the docs' exemption speaks of classes with
    `$state` fields.
  - The dev-only route convention (`design` for description and title) was extended to `single-h1`
    (social-front, 9 keys).
- New shapes labelled for the first time: an empty `+page.svelte` (`tp` for the tags it lacks, `design`
  for `title-presence`); a `<select>` bound to state that matches no option (`tp`); an `aria-hidden`
  drawer that toggles (`tp`); a `robots.txt` `Disallow: /security/` that misses the served `/security`
  (`tp`).
- Analyzer gaps that did not change a verdict: `<dir>` is reported by both `permitted-contents` and
  `deprecated-element`; `seo/single-h1`'s per-route lists differed between the first look and a local
  run for one key (genshin-music's `PageHeading`, 8 against 11 routes).

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
twentieth holdout.
