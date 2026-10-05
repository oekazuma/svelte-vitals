# v1 holdout 23 — result (2026-10-05)

Measured with `main` at 187a6362 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-05-v1-holdout-23-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-23-2026-10-05.json`;
verdicts: `scripts/corpus/holdout-23-2026-10-05-verdicts.json` (4,378 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of the nine deciding criteria fail. C3 fails on one false critical finding: a
`<title>` a route never lacks, because a layout `$effect` sets `document.title` through a function in
another module. C6 fails on one class in two apps: two `<h1>`s in separate `{#if}` blocks that cannot
both render, read as rendering together because one block has an `{:else}`. C4 (99.7%) and C5 (99.8%)
pass, no rule falls under 90% under C7 by either definition, and no key is `unclear`. C8, published
without deciding the result, is 26.6%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 6 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 1 (`seo/title-presence`, 1 app)                | fail     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.7% (1,577 / 1,581)                          | pass     | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.8% (1,889 / 1,893)                          | pass     | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                | fail     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (none by the earlier definition)    | pass     | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 26.6% (588 / 2,209)                            | reported | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 3,505, fp 9, design 864, unclear 0.

C7 judges one rule, above the threshold: `seo/single-h1` 93.6% (73 / 78, false positives from ACO,
escalas and cordn-web). The earlier definition judges the same rule and nothing else; the rules below
90% (`correctness/unmutated-state` 7 / 9, `performance/lcp-image` 1 / 2) have fewer than 10 findings.

## Critical findings (C3)

41 critical findings, all `title-presence`: 39 tp (puzzle_league 22, ACO 15, novellum's `/onboarding`,
kurosearch's `/share`), 1 `design` (kurosearch's unlinked `/statistics`, which charts the data dumps
and has no title) and 1 fp. Each title was decided on its route's full render chain, including the npm
components it renders.

The false one is cordn-web's `/chat/config/multi-device`. The app sets `ssr = false` at its root, so a
title set in the browser counts. `chat/+layout.svelte` runs `syncChatAttention()` in an `$effect` on
every `/chat` route, and that function, in `src/lib/services/chatAttention.svelte.ts`, sets
`document.title` to "Chat | Cordn" (with an unread count when there is one). The analyzer reads a
`document.title` write only in a component's own script, not in a module function the component calls.

## False-positive classes

| Class                                                                                                                                      | Findings | Apps | Rules           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | --------------- |
| **Two `<h1>`s in separate `{#if}` blocks whose conditions cannot both hold, one of them with an `{:else}`**, read as rendering together    | 2        | 2    | **single-h1**   |
| An `<h1>` in committed HTML a page renders with `{@html}` (JSON data whose text opens with `<h1>`)                                         | 3        | 1    | single-h1       |
| A `document.title` write in a module function a layout `$effect` calls, on an `ssr = false` route                                          | 1        | 1    | title-presence  |
| A `$state` array handed out in an object passed to a callback prop (`onSave({ …, ids })`, also through an intermediate `const`)            | 2        | 1    | unmutated-state |
| The route's first image rendered earlier by a child component (a slideshow's eager first slide), so the flagged image is not the LCP image | 1        | 1    | lcp-image       |

C6's class reaches the limit the docs state for headings in separate blocks: blocks are read as
exclusive only when none of them has an `{:else}` and no other block sits between them. Both apps reach
the `{:else}` part of it:

- cordn-web's `/chat` renders `<h1>Chats</h1>` under `{#if hasAccount}` and `<h1>Welcome to Cordn</h1>`
  in the `{:else}` of a second `{#if hasAccount}` block.
- escalas's `/login` renders its `<h1>` under `{#if !recuperacao && !primeiroAcesso}`, and
  `FormRecuperacaoSenha`, whose `<h1>`s are in every arm, in the `{:else if recuperacao}` arm of a
  second block; a banner `{#if}` also sits between the two.

The `{@html}` class is the same limit holdout 21 failed C6 on (`2026-10-04-markdown-html-headings.md`),
met here through HTML stored in JSON rather than markdown, in one app.

## C2 in detail

GitHub Actions run 37222553868 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Six builds completed: martinemde.com (74 prerendered routes
analyzed), hiroleague (its 13 prerendered routes are `ssr = false` and were skipped), and booklist,
arista-web, escalas and cordn-web with no prerendered page. After the plugin ran, ACO's (511 prerendered
routes analyzed) and kurosearch's (15) builds were stopped by the plugin's own gate on their critical
findings, and four stopped on their own: skilless, puzzle_league and NoFluxoUnB on `$env/static`
variables not set, senftube on an image its source imports but the repository does not contain. Before
the plugin ran, HUMAN's build stopped in `vite-plugin-pwa` (nothing to precache) and novellum's on
`better-sqlite3`'s native build, which pnpm did not run.

## Labelling notes

- The design share is concentrated in `canonical-url` (148), `description-presence` (148) and
  `each-key` (127); novellum, hiroleague, HUMAN and NoFluxoUnB together have 313 of the 588.
- Judgement calls the labellers flagged:
  - kurosearch's `/statistics` `title-presence` is `design` by the ledger's "unlinked developer page"
    precedent; it is prerendered and ships publicly, and read narrowly it is `tp`.
  - booklist's `/` and `/books` are `tp` for `canonical-url`: guests without a `?user=` share id are
    redirected, but the app's public share link is that query string.
  - novellum's 10 `load-waterfall` findings are `design`: a desktop app whose data API is a sidecar on
    the loopback interface. The ledger has no precedent for loopback HTTP.
  - kurosearch's `{@html query}` is `design` for `raw-html`: the value is a `URL` object, whose
    serialization percent-encodes markup characters. ACO's two `{@html}` of route parameters are
    `design` only because the site is prerendered to a static host.
  - HUMAN's `finance/reports` "Multiple `<h1>`" is `design`: one heading is screen-only and the other
    print-only.
- Conventions the labellers applied but questioned:
  - og and twitter rules are `tp` on routes where `canonical-url` is `design` as not a search target
    (gated, localhost-only, `robots.txt` disallowing everything).
  - The ledger's link rules are `tp` on local desktop apps (novellum), which are never served publicly.
  - `deprecated-element` is `tp` on martinemde.com's deliberate obsolete-HTML page.
  - Dev-only routes are `design` for `single-h1` but `tp` for the landmark rules.
  - `robots-txt` is `tp` on a GitHub Pages project-path deployment, where a crawler never reads the file.
  - `image-dimensions` exempts `src="{base}/x.svg"` but not the same path as a template literal.
  - `each-index-key` is `design` for append-only lists and `tp` for lists trimmed from the front, chat
    lists included.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria again needs a
twenty-fourth holdout.
