# v1 holdout 16 — result (2026-10-02)

Measured with `main` at dace645a on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-02-v1-holdout-16-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. Raw first look:
`scripts/corpus/holdout-16-2026-10-02.json`; verdicts: `scripts/corpus/holdout-16-2026-10-02-verdicts.json`
(5,514 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of the nine deciding criteria fail: C3 and C7. C4 (99.95%) and C5 (99.9%)
pass, no fp class is shared by two apps (C6 passes), and one key is `unclear`. C8, published without
deciding the result, is 27.3%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 8 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 5                                              | fail     | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.95% (1,850 / 1,851)                         | pass     | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (2,552 / 2,555)                          | pass     | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 1 rule below                                   | fail     | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 27.3% (718 / 2,626)                            | reported | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.02%)                                  | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 4,453, fp 9, design 1,051, unclear 1.

C7's rule: `seo/heading-level-skip` 85.7% (12 / 14), both fp in one app.

## Critical findings (C3)

56 critical findings: 51 `title-presence`, all tp (mmr-project 23, Herocraft 17, duitgee 4,
lyriks-community 3, OxiCloud 2), and 5 `security/handler-state-write`, all fp (leagr). Every
title-presence key was decided on its route's full render chain, including the npm components the
chain renders. The five fp also failed leagr's build in build mode: the plugin's gate stops a build on
a critical finding, so a false critical stops a user's CI the same way.

## False-positive classes

| Class                                                                                                                                                        | Findings | Apps | Rules                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ----------------------- |
| **`.set()` on an imported object literal whose own properties are all functions** (`export const data = { get, set, setMany, remove }`, a file-store facade) | 5        | 1    | **handler-state-write** |
| A heading a local wrapper renders through bits-ui `Accordion.Header level={3}`, not seen as the heading before                                               | 1        | 1    | **heading-level-skip**  |
| The heading before taken from an arm of `{#if !data.rule}` that cannot render with a dialog behind `{#if … && data.rule}`                                    | 1        | 1    | **heading-level-skip**  |
| An `<h1>` rendered through `{@html}` of the page's markdown (seeded `# …` content)                                                                           | 1        | 1    | single-h1               |
| A second `await` that needs the first through a field of a module `$state` object (`auth.user` after `await auth.initialize()`)                              | 1        | 1    | sequential-awaits       |

The facade class decides C3: the rule reads any object literal without a spread as a hand-rolled store,
and a store module that exports an object of its own functions is persistence, not shared state. The
`{@html}` heading class is the one holdout 15 left open, here in one app.

## C2 in detail

GitHub Actions run 36976461270 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Eight builds completed: Santrionline web (9 prerendered routes
analyzed), and OxiCloud, duitgee, lyriks-community, nasty, mmr-project, hybridsocial and indelible with no
prerendered page. After the plugin ran, its gate stopped Herocraft (critical title-presence findings,
true) and leagr (the five false critical findings above), daggerbrain's build failed on a
`$env/static/public` variable not set, and caelo-cms's on an unbuilt workspace package. Before the
plugin ran, openlobbying and tierdom-app stopped on environment variables their server modules
require at build time.

## Labelling notes

- The design share is concentrated in `canonical-url` (311), `description-presence` (281), `raw-html`
  (102), `each-key` (72) and `image-dimensions` (53); daggerbrain, duitgee, indelible and nasty
  together have 391 of the 718.
- The `unclear` key is tierdom-app's `/about` "Missing `<h1>`": the page is only `{@html}` of
  admin-edited markdown, and whether it starts with `# …` depends on which setup preset an instance
  chose.
- Conventions the labellers applied but questioned: og/twitter tags are never `design` while a
  canonical on the same gated or noindex route is; length rules stay `tp` on noindex routes; login
  pages of self-hosted products are `design` for description-presence and `tp` for canonical; marketing
  pages a hooks allowlist forgot (duitgee) labelled `design` for canonical; a page that errors for
  guests (Herocraft `/account`) and a first-run setup wizard (tierdom `/setup`) labelled `design`; the
  each-index-key line between fetched records (`tp`) and positional rows (`design`); vendored
  shadcn-svelte components counted as `tp` for prop-count and component-size; a ternary of two `.svg`
  imports labelled `design` for the image rules.
- Analyzer gaps that did not change a verdict: `route-component-import`'s default `exemptImporters`
  misses `*.test.svelte.ts` test modules (2 `design`); a nested list inside an exempt constant, and an
  alias of one, are still reported by `each-key` (`design`); `effect-as-onmount` does not see the
  `$state` of `untrack(() => new Store())`; Herocraft `/cards` is reported for multiple `<h1>` from
  opt-in views while its default view renders none; duitgee's mdsvex docs pages get no `json-ld`
  findings.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
seventeenth holdout.
