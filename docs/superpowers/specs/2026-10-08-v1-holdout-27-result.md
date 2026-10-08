# v1 holdout 27 — result (2026-10-08)

Measured with `main` at 42ec68e7 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-08-v1-holdout-27-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 of the 14 installed; jump's install failed (its `postinstall` runs Prisma, whose
config needs `DATABASE_URL`), so jump was measured uninstalled. Raw first look:
`scripts/corpus/holdout-27-2026-10-08.json`; verdicts: `scripts/corpus/holdout-27-2026-10-08-verdicts.json`
(3,867 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** One of the nine deciding criteria fails. C6 fails on one class in two apps: routes
that never render, read as rendering. jump's `hooks.server.ts` answers every request to its three
`/parent` routes with a redirect from an imported guard, and coves-frontend's
`c/[handle=handle]/settings/+layout.ts` load throws `error(404)` on every call; 41 route-level claims on
those five routes are false. Counted by mechanism, as two single-app classes, C6 would pass. Every other
criterion passes: no crash in either mode, no false critical finding, C4 at 98.0% (just above its
threshold; 23 of its 26 false warnings are on those routes), C5 at 98.9%, no rule under 90% under C7, and one
key `unclear`. Both margins are one finding wide: one more false warning would fail C4
(1,275 / 1,301 is 98.002%), and one more false `title-length` finding would fail C7 (27 / 30). C8,
published without deciding the result, is 30.8%.

| #   | Criterion                          | Threshold      | Measured                                      | Result   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | --------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                             | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 9 apps, 6 of which built | pass     | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                             | pass     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 98.0% (1,275 / 1,301)                         | pass     | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 98.9% (1,748 / 1,768)                         | pass     | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                               | fail     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (1 by the earlier definition)      | pass     | none  | 2     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 30.8% (589 / 1,915)                           | reported | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.03%)                                 | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                 | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 3,048, fp 46, design 772, unclear 1.

C7 judges the eight rules whose false positives come from two apps: `seo/title-length` at 90.0% (27 / 30;
jump 2, SchoolXense 1), `seo/canonical-url` at 93.6% (73 / 78; jump 3, coves-frontend 2), and
`seo/json-ld`, the og rules and `seo/twitter-card` at 98.0–98.5% (5 false positives each, from the same
two apps). The earlier definition also fails `seo/description-presence` at 87.5% (21 / 24, all three
false positives from jump).

## Critical findings (C3)

30 critical findings, all `title-presence`: 25 tp (CloudMeet 7, rusty-shed 5, defisAsso's admin 5 and its
`sv create` demo routes 4, scipro_review 2, sylvode's `/`, Kalenj.in's `lessons/[id]`) and 5 `design`:
coves-frontend's `/util` routes, which its `util/+layout.ts` and `hooks.server.ts` answer with 404
outside `dev`.

## False-positive classes

| Class                                                                                                                                                                     | Findings | Apps | Rules                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| **A route that never renders, read as rendering** (a guard `hooks.server.ts` imports and returns before `resolve()`; a layout `load` that throws `error()` on every call) | 41       | 2    | **canonical-url**, **json-ld**, **og and twitter rules**, **title-length**, description-presence, heading-level-skip |
| A layout `<main>` behind `{#if}` on `page.data.user`, and the page's own `<main>` in the `{:else}` of `{#if}` on the same field                                           | 2        | 1    | duplicate-landmark, top-level-landmark                                                                               |
| A layout that renders another component in place of `{@render children()}` by a regular-expression test of `page.url.pathname`, with the page's `<title>` counted         | 1        | 1    | title-length                                                                                                         |
| An `<h1>` behind a prop test one component deeper than the literal (`view="compact"` forwarded as `{view}`)                                                               | 1        | 1    | single-h1                                                                                                            |
| An imported `const` list read only by `new Set(LIST)`, `indexOf` and `slice`, not read as constant                                                                        | 1        | 1    | each-key                                                                                                             |

C6's class reaches the limit the docs state for routes that never render: the forms they list are a page
`load` that throws or redirects on every path, directly, through a function of the same file or through an
imported factory. The two apps meet it differently:

- jump's `hooks.server.ts:316-319` returns the response of `applyRouteGuards()` from
  `lib/server/auth/guards.ts`, which sends every request to `/parent`, `/parent/enfant/[talentId]` and
  `/parent/settings` elsewhere with `Response.redirect`: to the login page, to the next step of a sign-up
  flow, or to a closing page ("no dashboard in this release"). 27 claims.
- coves-frontend's `c/[handle=handle]/settings/+layout.ts` exports a `load` that calls `error(404, …)`
  unconditionally, so neither `/c/[handle=handle]/settings` nor its `team` page renders. The analyzer reads
  the same call in a page's `load` (its `/profile/media` and `/settings` are left out) but not in a
  layout's. 14 claims.

They are counted as one class, as holdouts 17, 19, 22 and 25 counted classes that reach one documented
limit through different mechanisms. Split by mechanism they are two single-app classes, and every
criterion would pass.

The `<main>` class is the third holdout in a row to reach a layout branch decided by `load` data, after
holdout 25's cashflow and holdout 26's kitchenbrain, each time in one app.

## C2 in detail

GitHub Actions run 37654045782 (harness in `scripts/holdout-build/`). The plugin ran on 9 apps and crashed
on none. Six builds completed: syam-web (19 prerendered routes analyzed), rusty-shed (its 14 prerendered
routes are `ssr = false` and were skipped), and coves-frontend, SmartLock-Dashboard, CloudMeet and sylvode
with no prerendered page. After the plugin ran, SchoolXense's, ct-ftc-website's and bootpack-digital's
builds stopped on `$env/static` variables not set. Before the plugin ran, scipro_review's `build` script
asks for a build mode and exits 1, jonasleonhard.de's prerender fails on a 404 for a link to
`/undefined/`, defisAsso's build stops on `DATABASE_URL` not set and Kalenj.in's on a Prisma client not
generated; jump was not built, its install having failed.

## Labelling notes

- The design share is concentrated in `description-presence` (190), `canonical-url` (156) and `each-key`
  (121); sylvode, jump, Kalenj.in and coves-frontend together have 374 of the 589.
- The `unclear` key is scipro_review's `iframe-loading` on a sandboxed `srcdoc` iframe in a list of
  notebook cells: whether `loading="lazy"` defers an iframe that fetches no document is browser behaviour.
  The ledger has two more keys of this shape, both `unclear`.
- Judgement calls the labellers flagged:
  - coves-frontend's `/util` routes answer 404 outside `dev`, in `hooks.server.ts` as well as a layout
    `load`; they are labelled under the dev-only convention (`canonical-url` and `title-presence`
    `design`, og and twitter rules `tp`), not as never rendering.
  - scipro_review ships two builds from one source, a static student build and a Node teacher build, and
    a few routes redirect in one of them; each renders in the other and is labelled as rendering.
  - defisAsso's four `sv create` demo routes are `tp` for `title-presence` by the ledger's majority;
    tarkana's and one other app's are `design`.
  - SchoolXense's root-layout `description-length` and `duplicate-description` keys cover 77 routes and
    are `design` by majority (56 are signed-in or noindex), though the over-long description ships on its
    21 public pages.
  - coves-frontend's `Header.svelte` `single-h1` key is `tp` on three of its four routes; the fourth is a
    settings route that never renders.
- Conventions the labellers applied but questioned:
  - `each-key` on an authored list filtered at runtime is `tp` in most ledger entries and `design` in one.
  - `stale-prop-derivation` under a `[param]` route has both answers in the ledger; all 11 here are
    `design`.
  - `canonical-url` on pages reached only by a token or id link is `tp` in most entries and `design` in a
    few.
  - `load-waterfall` stays `design` where the awaited call makes no request.
  - A `display: none` file input inside a drop zone is `tp` in early entries and `design` in later ones.
- Seen while labelling, not false positives: sylvode's markdown renderer escapes text but restores
  `<video>` elements unescaped, so a user's issue text can run script for other members (`raw-html` tp);
  defisAsso's `/admin` pages and their actions have no authentication check, and `/admin/setup` creates
  an admin account with a committed password on every request.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria again needs a
twenty-eighth holdout.
