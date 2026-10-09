# v1 holdout 30 — result (2026-10-10)

Measured with `main` at fb6d6182 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-10-v1-holdout-30-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-30-2026-10-10.json`;
verdicts: `scripts/corpus/holdout-30-2026-10-10-verdicts.json` (4,707 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, no
false warning (C4 at 100.0%), C5 at 99.6%, no false-positive class reaches two apps, no rule falls under
90% under either C7 definition, and no key is `unclear`. Seven keys are false positives in all, in three
classes, each in one app. C8, published without deciding the result, is 30.5%. The release decision
stays with the owner, as the criteria say. The result rests on the labelling calls set out under "What
the result rests on".

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 10 of which built | pass     | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 100.0% (1,610 / 1,610)                          | pass     | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.6% (1,907 / 1,914)                           | pass     | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (none by the earlier definition)    | pass     | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 30.5% (770 / 2,525)                             | reported | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                   | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 3,662, fp 7, design 1,038, unclear 0.

No rule has false positives from two apps, so C7 judges none. No rule with ten or more findings falls
under 90% either: `responsive-image` is at 95.7% (90 / 94) and `single-h1` at 98.4% (120 / 122);
`unmutated-state`, at 85.7%, has seven findings.

## What the result rests on

- **sekai-viewer-reborn's two `single-h1` keys are `fp`.** The root layout holds
  `showPageTitle = $derived(page.url.pathname === "/")` and passes it to the workspace package's
  `ViewerShell` as `showTitle={showPageTitle}`; the shell renders its `<h1>` only `{#if showTitle}`, so on
  the eleven flagged routes there is one `<h1>`, not two. The rule docs say a prop passed as an
  expression leaves both arms counted, so `design` is arguable, as holdout 28 noted for a documented
  reading. Under `design`, `single-h1` has no false positive.
- **techguide's four `responsive-image` keys are `fp`.** Each image is an SVG reached through a call:
  `asset('/images/social/instagram.svg')`, or a helper over a data field whose only values are `.svg`
  paths. The rule docs exempt vector images but list the source shapes they recognise as one, and a
  call is not among them; under `design`, `responsive-image` has no false positive.
- **ai-almanac's `duplicate-landmark` on `AdminGuard.svelte:17` is `tp`.** It covers six routes. On the
  five `/settings*` routes the layout's `<main>` and the guard's own render together, which is real. On
  `/forecast-data` the page passes its `<main>` to `AdminGuard` as children, which the guard renders only
  in its admin arm and its own `<main>` only in the other, so the claim is false there. The key is
  labelled by its majority; counted `fp`, it is one more single-app class and no result changes.
- **ridgeline's canonical and `og:url` on `/identity` and `/m/identity` are `design`.** The app's Go
  server writes both tags into the SPA shell when it serves those pages. The ledger labels a head tag a
  build script writes outside SvelteKit `design`; a server that writes it at request time is taken the
  same way.

## Critical findings (C3)

147 critical findings, all `title-presence`: 145 tp (tybalt_turbo 92, schoolrise 37, fluffly 16) and 2
`design`, schoolrise's `/demo` and `/demo/playwright`, pages left from the project template that nothing
links to.

## False-positive classes

| Class                                                                                                                        | Findings | Apps | Rules            |
| ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ---------------- |
| A component `{#if}` on a prop passed as an expression: a route test held in a `$derived` and passed to a workspace component | 2        | 1    | single-h1        |
| An SVG image given through a call (`asset('/x.svg')`, a helper over a data field)                                            | 4        | 1    | responsive-image |
| A `$state` placed in an object literal passed to `setContext`, written through the context by another component              | 1        | 1    | unmutated-state  |

The third class has ledger precedents of the same shape: state inside an object literal argument is not
read as handed out.

## C2 in detail

GitHub Actions run 37992394355 (harness in `scripts/holdout-build/`). All 14 apps installed. The plugin
ran on 12 apps and crashed on none. Ten builds completed: HadesCompanion (31 prerendered routes
analyzed), techguide (25 analyzed), statistik-interaktiv (19 analyzed), CrispDeck (1 skipped as
`ssr = false`), fluffly (6 skipped as `ssr = false`), ridgeline (2 skipped as `ssr = false`), and
ai-almanac, tessera, site-scanner and madonnahist with no prerendered page. After the plugin ran,
sekai-viewer-reborn's build stopped on a sibling workspace app's missing generated `tsconfig.json`, and
tybalt_turbo's on `PUBLIC_POCKETBASE_URL` not set. Before the plugin ran, Patrik-Homelab's build stopped on
its environment schema (`JWT_SECRET` not set) and schoolrise's on `MINIO_ACCESS_KEY` not set.

## Labelling notes

- No flagged route never renders. The routes whose `load` redirects on every path (schoolrise's and
  tessera's `/`, tessera's `/p/[pageSlug]`, sekai-viewer-reborn's `/events/[region]/list`) were already
  left out; `/p/[pageSlug]`'s `sequential-awaits` is `tp`, since both awaits run before the redirect.
- The design share is concentrated in `canonical-url` (282), `description-presence` (247),
  `each-index-key` (95) and `each-key` (92); tybalt_turbo, fluffly, CrispDeck and ai-almanac together have
  460 of the 770. tybalt_turbo is an internal application that sends every signed-out visitor to its
  sign-in page.
- Judgement calls the labellers flagged:
  - shadcn-svelte primitives copied into an app are `tp` for `prop-count`, as the ledger has them.
  - A `<select required>` with a literal `selected` default and a spinner id repeated on separate
    buttons are `design`, as the ledger has them.
  - `sequential-awaits` is `tp` on 75 of 81 keys, against about half in the ledger: these loads chain
    independent database or API calls with few sign-in checks before them.
- Conventions the labellers applied but questioned:
  - `og:*`, `twitter:*` and `json-ld` presence are `tp` on routes behind a sign-in or `noindex`, where
    `canonical-url` and `description-presence` are `design`.
  - The ledger splits `Object.entries` over one fetched record's fields between `tp` and `design`.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
