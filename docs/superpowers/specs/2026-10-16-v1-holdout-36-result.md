# v1 holdout 36 — result (2026-10-16)

Measured with `main` at 0b2ff7dc on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-16-v1-holdout-36-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 installed; match-manager's install failed (its `engines` asks for Node 22) and it
was measured uninstalled. Raw first look: `scripts/corpus/holdout-36-2026-10-16.json`; verdicts:
`scripts/corpus/holdout-36-2026-10-16-verdicts.json` (4,861 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: C7 fails.** `a11y/top-level-landmark` is at 76.9% (20 / 26), under its 90%, with false
positives from two apps: NerdDen's root layout drops its `<main>` on routes it names in a `new Set([…])`
tested with `.has(page.route.id)`, which the route reading does not decide (4), and MiniERP's unlabelled
`<aside>`s sit in the `<section>` a page-shell component wraps its content in, which makes them no landmark
(2). The two are separate classes, so C6 passes. Every other deciding criterion passes: no crash in
either mode, no false critical finding, C4 at 99.6%, C5 at 99.9%, and no key is `unclear`. C8, published
without deciding the result, is 34.0%. The release decision stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 8 of which built | pass     | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.6% (1,665 / 1,672)                          | pass     | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (1,983 / 1,984)                          | pass     | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 1 below 90% (the same 1 by the earlier one)    | fail     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 34.0% (923 / 2,712)                            | reported | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (1 new)                                     | pass     | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,765, fp 8, design 1,088, unclear 0.

C7 judges one rule, `a11y/top-level-landmark`, the only rule with false positives from two apps. By the
earlier definition the same rule is the only one with ten or more findings under 90%. C10 gains
`a11y/no-duplicate-dt`.

## What the result rests on

- **MiniERP's two asides are `fp`.** `finance/doc-hub/[id]/+page.svelte:169` and
  `finance/inbox/[id]/+page.svelte:103` pass an unlabelled `<aside>` as content of `PageShell`, whose
  `app/components/PageShell.svelte:17` renders it inside `<section class="space-y-6">`. The rule's docs say
  an `<aside>` inside sectioning content is a `complementary` landmark only with an `aria-label` or
  `aria-labelledby`, as the HTML accessibility mapping specifies, and they make no component exception for
  `<aside>` as they do for `<header>`/`<footer>`; the ledger labels an aside a component wraps in sectioning
  content the same way (chipi/orrery). The other reading rests on the docs' "Not flagged" note that
  detection does not trace every intermediate component, which would make the two `design`. Taken that
  way, the rule has false positives from one app, C7 judges no rule, and every deciding criterion passes.

## Critical findings (C3)

117 critical findings, all `title-presence` and all `tp`: MiniERP 49, match-manager 38, mill 17, NerdDen
10, Foldnano 2, Alkebu-Load 1. None of those apps has a `<title>` in `app.html`, a page, a layout or a
component on those routes, and none of the routes is one that never renders.

## False-positive classes

| Class                                                                                                                                                | Findings | Apps | Rules                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------- |
| A layout `{#if}` on `new Set([…]).has(page.route.id)` (through a `$derived`) not decided per route, so its `<main>` is counted on routes it excludes | 5        | 1    | top-level-landmark, duplicate-landmark |
| An unlabelled `<aside>` passed as content of a component that renders it inside `<section>`, read as a `complementary` landmark                      | 2        | 1    | top-level-landmark                     |
| A `$state` array mutated through a `for…of` loop variable and a `const` holding one of its elements (`day.blocks.push(…)`), not read as mutated      | 1        | 1    | unmutated-state                        |

The route reading already decides `.includes` on an array literal or a `const` list, `.some`, a regex
`.test()` and template literals; `Set.has` is not among them. The `unmutated-state` class has a ledger
precedent (holdout 35's `const tile = tiles[i]` write).

## C2 in detail

GitHub Actions run 38778306805 (harness in `scripts/holdout-build/`). 13 apps installed; match-manager's
npm install refused Node 24 against its `engines` (`22.x`), so it has no build. The plugin ran on 11 apps
and crashed on none. Eight builds completed: astrophoto (1 prerendered route analyzed), lyrion-anywhere
(0 analyzed, 1 skipped with the hash router), and agent-profile, mill, openslot, Foldnano, coldframe and
MiniERP with no prerendered page. After the plugin ran, RestoStaff's build stopped on `$env/static`
variables not set, forge's on a WebAssembly module its runtime workspace package generates and does not commit, and
yen-idhazh's (1 analyzed, 6 skipped as `ssr = false`) on its own build certification: its
`scripts/build-state.ts` fingerprints untracked files at the start and the end of `vite build`, and the
`svelte-vitals-report.json` the harness has the plugin write into the app directory (`outFile`) appeared
in between. The plugin writes no file unless `outFile` is set. Before the plugin ran, Alkebu-Load's build
script stopped on `svelte-check` errors from unset `$env/static` variables, and NerdDen's build on
`DATABASE_URL` not set.

## Labelling notes

- No route a route-level finding is on never renders. The routes that always redirect (MiniERP's
  `(auth)/login` and three `projects/[id]` sub-routes, astrophoto's `/settings`, `/admin`, `/drafts` and
  `/account/frames/drafts`, NerdDen's `/profile`, Foldnano's `/docs`) carry none; every redirect and error
  in the hooks and loads of the other routes depends on the session, the data or the platform.
- The design share is concentrated in `description-presence` (320), `canonical-url` (266) and `each-key`
  (156); MiniERP, RestoStaff, match-manager and openslot together have 443 of the 923.
- match-manager was measured uninstalled. The labellers judged its npm Svelte dependencies (bits-ui,
  mode-watcher and others) as rendering no `<title>` or social tags from what those libraries are, without
  fetching their files.
- Conventions the labellers applied but questioned:
  - `og:*`, `twitter:*` and `json-ld` presence stay `tp` on routes behind a sign-in or marked `noindex`,
    where `canonical-url` and `description-presence` are `design`.
  - Leftover `sv create` demo and test pages are `tp` in some ledger entries and `design` in others;
    NerdDen's `/demo*` and Foldnano's `/testpage` were labelled `tp`, as pages served in production.
  - `sequential-awaits` after a 404 or ownership gate is `tp` in most ledger entries and `design` in
    others.
  - An image in an `{#if}` that never holds is `design` in the ledger (Alkebu-Load's preloader, 3 keys).
  - `responsive-image` has no small-raster exemption, so NerdDen's 3 KB pixel-art sprite is `tp`.
  - Alkebu-Load's two `heading-level-skip` findings past CMS rich text rendered with `{@html}` are `tp`,
    extending the `single-h1` convention for user-authored markdown to heading order.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
