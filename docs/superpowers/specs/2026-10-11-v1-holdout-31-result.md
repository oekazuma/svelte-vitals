# v1 holdout 31 — result (2026-10-11)

Measured with `main` at f74e02de on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-11-v1-holdout-31-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-31-2026-10-11.json`;
verdicts: `scripts/corpus/holdout-31-2026-10-11-verdicts.json` (6,157 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4
at 99.4%, C5 at 100.0%, no false-positive class reaches two apps, no rule is judged under C7, and no key
is `unclear`. Sixteen keys are false positives in all, in seven classes, each in one app. C8, published
without deciding the result, is 31.5%. The release decision stays with the owner, as the criteria say.
The result rests on two calls set out first under "What the result rests on": either one taken the
other way fails a criterion.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 8 of which built | pass     | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.4% (2,369 / 2,384)                          | pass     | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 100.0% (2,487 / 2,488)                         | pass     | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (3 by the earlier definition)      | pass     | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 31.5% (1,102 / 3,498)                          | reported | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 4,868, fp 16, design 1,273, unclear 0.

C7 judges no rule. `duplicate-landmark` has false positives from two apps (erp-bcs-frontend and wwiser),
but only six findings, under the ten C7 needs. By the earlier definition, three rules with ten or more
findings fall under 90%, each from one app: `top-level-landmark` at 69.2% (9 / 13), `prop-mutation` at
77.8% (7 / 9) and `description-presence` at 0% (0 / 1; 302 of its 303 findings are `design`).

## What the result rests on

- **dsa-woodshed's five `single-h1` "Missing `<h1>`" keys are `design`.** The page bodies are markdown
  that `scripts/sync-content.mjs` copies into `src/content/` from a separate repository before the build,
  and `src/content/**` is gitignored, which the repository's own comments call build input, not source.
  The checkout the analyzer reads, installed or not, holds no heading, which the rule docs say of
  content they cannot resolve; the ledger labels what a generator writes outside SvelteKit before
  `vite build` `design`, since the claim holds for the source. The synced bodies do open with `# `
  (read at the pinned commit of the other repository). Under `fp`, `single-h1` has false positives from
  two apps (clickclack 2, dsa-woodshed 5) and C7 judges it at 82.9% (34 / 41), so **C7 fails**.
- **erp-bcs-frontend's and wwiser's landmark classes are kept apart.** Both are a layout `{#if}` decided
  by the route that the route reading leaves undecided. erp-bcs-frontend's layouts render print routes
  bare under `{#if isPrintRoute}`, a `$derived` of `pathname.endsWith('/print') || …`; the reading takes
  `endsWith` against a literal, as the rule docs say, but leaves it undecided on a route with a parameter
  before the suffix (`/finance/invoices/[id]/print`), while the same layout on a route without one is
  decided. wwiser's tests `STANDALONE_PAGES.has(currentToolId)`, with `currentToolId` a `$derived.by`
  mapping the path, a test the docs do not list. One is a gap in a reading the docs describe and the
  other a documented limit, which holdout 29 kept apart (Hoop-Rush's offset defect against
  saffron-hive's unlisted `.some`). Counted as one class, **C6 fails**.
- **clickclack's `/` `description-presence` is `fp`.** The route picks its component by host through
  `{#await import(…)}`; on the public product host it renders `ProductSite`, whose head has a
  description, and on the app host it renders `ChatApp`, which has none. It is labelled by the public
  host. Under `design`, `description-presence` has no false positive.
- **listing-sync's `robots-txt` is `design`.** The app's Rust server answers `/robots.txt` at run time
  with its own body, outside the SvelteKit source, labelled as holdout 30 labelled ridgeline's
  server-written canonical; the ledger's whoearns-live has the same shape as `fp`.
- **18 component-scoped keys on pages whose `load` always redirects are `design`** (15 `each-key` in
  erp-bcs-frontend, three `base-path-navigation` in dsa-woodshed): the claim holds for the code, which
  never runs. The ledger has no earlier call for a component-scoped finding on such a page.

## Critical findings (C3)

14 critical findings, all `title-presence`: 12 tp (erp-bcs-frontend 9, racona-core 3) and 2 `design`,
racona-core's `/email-teszt` and `/admin/file-upload-test`, test pages nothing links to.

## False-positive classes

| Class                                                                                                               | Findings | Apps | Rules                                  |
| ------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------- |
| A layout `{#if}` on `endsWith` against a literal, left undecided on a route with a parameter before the suffix      | 8        | 1    | duplicate-landmark, top-level-landmark |
| A layout `{#if}` on `Set.has()` of a `$derived.by` that maps the path                                               | 1        | 1    | duplicate-landmark                     |
| A component chosen by host through `{#await import(…)}` on a route that is never server-rendered                    | 2        | 1    | description-presence, single-h1        |
| Two components with an `<h1>` in separate `{#if}` blocks whose tests on a `const` contradict (`a && b`, `!a`)       | 1        | 1    | single-h1                              |
| A constant list exported from a `.svelte` file's `<script module>`, not read as constant                            | 1        | 1    | each-key                               |
| A `QueryClient` prop's `clear()`, not awaited, read as a mutation of the prop                                       | 2        | 1    | prop-mutation                          |
| The route's first image rendered by a child component (a hero slideshow), so the flagged image is not the LCP image | 1        | 1    | lcp-image                              |

The last two classes have ledger precedents of the same shape.

## C2 in detail

GitHub Actions run 38062909427 (harness in `scripts/holdout-build/`). All 14 apps installed. The plugin
ran on 11 apps and crashed on none. Eight builds completed: radiologyos (1 prerendered route analyzed),
wwiser (13 skipped as `ssr = false`), xemarify (9 skipped as `ssr = false`), clickclack (1 skipped as
`ssr = false`), and gothic-garrison, erp-bcs-frontend, sparkles and remote-pulse with no prerendered page.
After the plugin ran, arguspam's build stopped on `$env/static` variables not set, and distroface's and
listing-sync's on generated modules the repositories do not commit. Before the plugin ran, dsa-woodshed's
build script needs `just`, which the runner does not have; jewelbb's Vercel adapter refuses Node 24; and
racona-core's environment schema stops on `DATABASE_URL` and others not set.

## Labelling notes

- No flagged route never renders. The routes whose `load` redirects or fails on every path (eleven in
  erp-bcs-frontend, seventeen in listing-sync's console, arguspam's `/`, clickclack's settings index)
  were already left out.
- The design share is concentrated in `canonical-url` (355), `description-presence` (302), `each-key`
  (142) and `each-index-key` (101); erp-bcs-frontend, listing-sync, distroface and radiologyos together
  have 732 of the 1,102.
- Keys labelled by their majority with some routes differing: listing-sync's `PageHead.svelte:56`
  `single-h1` is `tp` on a one-to-one split, false on `/resources/[id]`; wwiser's two `id-duplication`
  keys are `design`, false on three of thirteen routes for the same reason as its landmark class;
  clickclack's app-shell `title-length` and `duplicate-title` keys are `design`, with `/` differing on the
  product host.
- To read dsa-woodshed's synced markdown, a labeller fetched the other repository's files at the pinned
  commit through a public read-only mirror; the analysis itself never reads them.
- Conventions the labellers applied but questioned:
  - `og:*`, `twitter:*` and `json-ld` presence are `tp` on routes behind a sign-in or `noindex`, where
    `canonical-url` and `description-presence` are `design`.
  - `sequential-awaits` where the earlier await only decides a 404 is `tp` in most ledger entries and
    `design` in about eleven.
  - A `<main>` inside an `aria-modal` dialog is `design` in most ledger entries and `tp` in two.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
