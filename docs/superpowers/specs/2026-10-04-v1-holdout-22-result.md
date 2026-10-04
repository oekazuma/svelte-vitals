# v1 holdout 22 — result (2026-10-04)

Measured with `main` at 5e82471c on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-04-v1-holdout-22-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-22-2026-10-04.json`;
verdicts: `scripts/corpus/holdout-22-2026-10-04-verdicts.json` (5,068 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** One of the nine deciding criteria fails: C6, on a component arm that a literal
prop on the use rules out but the analyzer still counts, in three apps (four false positives). C3
passes with no false critical finding, C4 (99.8%) and C5 (99.9%) pass, no rule falls under 90% under C7, and
no key is `unclear`. C8, published without deciding the result, is 31.4%. Holdout 22 has the fewest
false positives of any holdout so far (6), and C6 rests on how they are grouped; the section below gives
the result under the other grouping.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 10 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.8% (1,811 / 1,814)                           | pass     | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (2,157 / 2,160)                           | pass     | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                 | fail     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (1 by the earlier definition)        | pass     | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 31.4% (864 / 2,750)                             | reported | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                   | pass     | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one). By
the earlier definition holdout 21 failed C7 on one rule.

Verdicts (distinct keys): tp 4,040, fp 6, design 1,022, unclear 0.

C7 judges one rule, above the threshold: `seo/single-h1` 97.2% (70 / 72, false positives from
DevelexTasks and storied). By the earlier definition `a11y/top-level-landmark` fails at 78.6% (11 / 14,
all 3 false positives from DevelexTasks).

## Critical findings (C3)

84 critical findings: 76 `title-presence`, 72 tp (kayordDX/pos 67, sci-manager-renew 3, DevelexTasks 2)
and 4 `design` (three unlinked developer pages in kayordDX/pos, and pussadu's empty
`/admin/departments`); and 8 `server-browser-global` in webutils's `src/lib/states.svelte.ts`, module-
scope `localStorage` reads in an app that sets `ssr = false` throughout and has no server module,
labelled `design` like the ledger's earlier entries of this rule. Each title was decided on its route's
full render chain, including the npm components it renders.

## False-positive classes

| Class                                                                                                                                                                                                                    | Findings | Apps | Rules                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ------------------------- |
| **A component arm a literal prop on the use rules out, still counted**: an `{:else if showError}` after state-decided arms; a `$derived(variant === 'embedded')`; an npm component's `<svelte:head>` `{#if includeFont}` | 4        | 3    | **single-h1**, preconnect |
| An unnamed `<aside>` in content a component renders inside its own `<section>`, read as a top-level landmark                                                                                                             | 3        | 1    | top-level-landmark        |

C6's class reaches the one limit the docs state for prop-decided arms: an `{#if}` decides by a prop only
when its test reads that prop directly (or through a `$derived` that trims or defaults it), as the first
test of the block, in a file the body walk reads. The three apps meet it through three mechanisms:

- DevelexTasks's `CapabilityGuard` renders its `<h1>` in a third arm, `{:else if showError}`, after two
  arms that test state; the page passes no `showError` (default `false`).
- storied's `discussion-thread` tests `{#if embedded}` with `embedded = $derived(variant === 'embedded')`;
  the page passes `variant="embedded"`, so the `{:else}` `<h1>` never renders.
- solyto passes `includeFont={false}` to `@svelte-plugins/datepicker`, whose `<svelte:head>` adds a
  Google Fonts link only `{#if includeFont}`; the installed head walk follows the package but not the
  prop.

They are counted as one class, as holdouts 17 and 19 counted classes that reach one documented limit
through different tests. Split by mechanism they are three single-app classes, and every deciding
criterion would pass.

Seen while labelling, inside a key labelled `tp` by majority: sci-manager-renew's root layout renders a
footer `<h3>` only `{#if !user || isPublicRoute(path)}`, while the `(app)` pages render only with a
user, so the footer and those pages' `<h1>` never show together; the key's `heading-level-skip` is false
on 7 of its 15 routes.

## C2 in detail

GitHub Actions run 37199231409 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Ten builds completed: DevelexTasks (4 prerendered routes
analyzed), and arthawks, preceptor-fisic, storied, kayordDX/pos, lunarr-go, u-cms, sci-manager-renew,
pussadu and solyto with no prerendered page. After the plugin ran, supatv's (8 prerendered routes
analyzed) and webutils's (its 57 prerendered routes are `ssr = false` and were skipped) builds were
stopped by the plugin's own gate on their critical findings. Before the plugin ran, gftb-site's build
script needed `just`, which the runner does not have, and dead-and-tattooed's stopped on
`STRIPE_SECRET_KEY` not set.

## Labelling notes

- The design share is concentrated in `canonical-url` (347), `description-presence` (252) and
  `image-dimensions` (76); kayordDX/pos, solyto, sci-manager-renew and storied together have 466 of the 864.
- Judgement calls the labellers flagged:
  - gftb-site's 28 `base-path-navigation` findings are `design`: its `base` is
    `process.env.BASE_PATH ?? ''` and the repository documents an apex deployment, with a sub-path only
    in preview tooling. Read as a documented sub-path deployment, all 28 are `tp`.
  - u-cms's 61 `prop-mutation` findings are `tp`: child components write into an element of the
    parent's `$state` array, a pattern the author documents as intentional.
  - pussadu's 13 routes whose every content query returns 401 without a session are `design` for
    canonical, a gate in the data rather than the route.
- Conventions the labellers applied but questioned:
  - `sequential-awaits` after a 404 or 403 check is split in the ledger, as noted after holdout 21.
  - The length rules are `tp` regardless of gating, though some ledger entries are `design` on gated
    routes.
  - A constant list filtered by search input, and runtime records fetched once and never reordered, are
    `design` for `each-key`.
  - Copied shadcn-svelte components, SVG artwork components and `<style>`-dominated components are `tp`
    for `prop-count` and `component-size`.
  - A public form's unbound `<select>` whose first option is preselected is `design`, where the ledger
    has `tp` for the same shape once.
  - A majority label hides a real duplicate: arthawks's layout `duplicate-title` key is `design` by its
    role dashboards, while its 13 public routes really share one title.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria again needs a
twenty-third holdout.
