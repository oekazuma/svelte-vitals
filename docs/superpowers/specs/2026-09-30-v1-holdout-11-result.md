# v1 holdout 11 — result (2026-09-30)

Measured with `main` at d282d4da on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-30-v1-holdout-11-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: 13 of 14 installed; dsh's
install stopped because its `hub/` directory carries an npm lockfile while the repository is a pnpm
workspace whose `hub` depends on `workspace:*` packages, and it was measured uninstalled. Raw first
look: `scripts/corpus/holdout-11-2026-09-30.json`; verdicts:
`scripts/corpus/holdout-11-2026-09-30-verdicts.json` (8,050 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: not ready.** Four of ten criteria fail: C3, C6, C7 and C8. C3 fails on one app — an
`ssr = false` SPA whose root layout sets `document.title` from an `$effect`, which the analyzer does
not read. C4 (99.7%) ties holdout 5 and C5 (99.8%) is the best of any holdout.

| #   | Criterion                          | Threshold      | Measured                                       | Result | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass   | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 6 of which built | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 62 (`title-presence`)                          | fail   | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.7% (2,593 / 2,600)                          | pass   | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.8% (3,494 / 3,500)                          | pass   | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                | fail   | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 3 rules below                                  | fail   | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 35.1% (1,503 / 4,286)                          | fail   | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass   | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 6,208, fp 75, design 1,767, unclear 0.

C7's rules: `seo/title-presence` 66.1% (121 / 183), `performance/lcp-image` 83.3% (5 / 6, 19
findings) and `correctness/unmutated-state` 87.5% (21 / 24).

## Critical findings (C3)

184 `title-presence`, the only critical findings: 121 tp (thower-app 70, zveltio 42, prejemesi 5,
nypsi-website 3, BeautySalon 1), 1 design (prejemesi's `/playground`, whose load throws a 404 outside
dev) and 62 fp. The 62 are every flagged route of Exceptionless: its root `+layout.ts` sets
`ssr = false`, and the root `+layout.svelte` sets `document.title` in an `$effect` on every path
(`${route.title} - Exceptionless`, or `'Exceptionless'`), except under `/stack`, `/event` and
`/stream`, whose pages set it in their own `$effect`. The routes never render on the server, so the
title the browser shows is the page's title. BeautySalon's one tp is a `<svele:head>` typo: its
`<title>` renders in `<body>`.

## False-positive classes

| Class                                                                                               | Findings | Apps | Rules               |
| --------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------- |
| **`document.title` set from an `$effect` on `ssr = false` routes not read as a title**              | 62       | 1    | **title-presence**  |
| A `use:portal` action moves a popup's buttons to `<body>`; the source nesting is reported           | 4        | 1    | interactive-nesting |
| **A `$state` exposed through an object getter and written through it elsewhere**                    | 3        | 2    | unmutated-state     |
| A layout's heading in one `{#if}` arm counted with the page's, which renders only in the other arms | 2        | 1    | single-h1           |
| Headings inside `{@html}` markdown not seen                                                         | 2        | 1    | single-h1           |
| An `{#await}` pending arm counted when the awaited value is a plain array                           | 1        | 1    | single-h1           |
| A layout's image counted before the page's, though the layout renders `{@render children()}` first  | 1        | 1    | lcp-image           |

C6's class is the getter-exposed `$state` (Exceptionless, resonans), which holdout 10 also found. In
Exceptionless the same `$state` is also written by `bind:` to a member behind a non-null assertion
(`bind:limit={params.limit!}`), which the write scan does not see either. Headings inside `{@html}`
are a documented limit, and dsh's markdown comes from a separate content repository fetched at build
time.

## C2 in detail

GitHub Actions run 36596282059 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 11 apps and crashed on none. Six builds completed (f95-france, prejemesi, Exceptionless,
orchestra-canvas-tokyo, rapkumer and traceway); none prerenders a page, so the build pass analysed
source only — traceway's 32 routes are all `ssr = false`. The others failed on their own: an import
whose case does not match the file (BeautySalon's `$lib/Zodschema`), generated files the checkout
lacks (groly's paraglide messages, nypsi-website's Prisma client), `$env/static` variables not set
(thower-app) and a workspace package export the checkout does not build (zveltio's
`@zveltio/sdk/studio`); and, before the plugin ran, resonans's unset `DATABASE_URL`, lingolearn's
Prisma client that its ignored install scripts never generated, and dsh's failed install.

## Labelling notes

- The design share is concentrated in `canonical-url` (412), `description-presence` (350),
  `each-key` (335) and `sequential-awaits` (159); resonans, Exceptionless, BeautySalon and rapkumer
  together have 770 of the 1,503.
- Conventions the labellers applied but questioned: whether a `robots.txt` `Disallow` alone makes a
  route `design` for `canonical-url` (the ledger has both); login pages of self-hosted tools as
  `design` for `description-presence` but `tp` for `canonical-url` on 19 routes; og/twitter as `tp` on
  signed-in routes; zveltio's schema-driven lists (from its API) as `design` for `each-key`; and
  `@libsql/client` on a `file:` URL treated as synchronous SQLite (`design`) for `sequential-awaits`.
- dsh's `duplicate-landmark` finding names the app's `sidebar-inset.svelte` where the second `<main>`
  comes from the workspace package `@dsh/ai-catalogue`: the analyzer resolved the package's `$lib` to
  the app's. Both files render `<main>`, so the claim holds.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
twelfth holdout.
