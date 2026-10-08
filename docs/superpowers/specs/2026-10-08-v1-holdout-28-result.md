# v1 holdout 28 — result (2026-10-08)

Measured with `main` at 9fe2dece on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-08-v1-holdout-28-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-28-2026-10-08.json`;
verdicts: `scripts/corpus/holdout-28-2026-10-08-verdicts.json` (4,810 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4
at 99.8% and C5 at 99.9%, no false-positive class reaches two apps, no rule falls under 90% under
either C7 definition, and no key is `unclear`. Five keys are false positives in all. C8, published
without deciding the result, is 36.5%. The release decision stays with the owner, as the criteria say.
The result rests on the labelling and grouping calls set out under "What the result rests on".

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 8 of which built | pass     | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.8% (1,605 / 1,608)                          | pass     | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (2,032 / 2,034)                          | pass     | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (none by the earlier definition)    | pass     | none  | none  | 2     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 36.5% (945 / 2,587)                            | reported | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 3,671, fp 5, design 1,134, unclear 0.

C7 judges one rule, `seo/heading-level-skip`, at 94.1% (32 / 34; speedfog-racing and
Conectando-Corazones, one false positive each). No rule falls under 90% with ten or more findings, so
the earlier definition judges nothing below it either.

## What the result rests on

- **C6: the two `heading-level-skip` classes are kept apart.** speedfog-racing's is a snippet passed to
  a component as a prop (`rules={playoffRules}`), read where it is defined instead of where the
  component renders it, after the component's own `<h2>`. Conectando-Corazones's is a modal `<h3>`
  after a `{#if data.error || !proyecto}` block, compared with the `<h1>` of the error arm, which never
  renders with it. The second is the behaviour the rule's docs describe (each arm of the block before
  counts, and the lowest level wins); the first is not covered by the docs at all. They are counted as
  two single-app classes because they reach different limits, as holdout 26 kept a never-render case apart
  from an SSR-off case. Counted as one class, C6 would fail.
- **Conectando-Corazones's `heading-level-skip` is `fp`.** Because the docs describe this reading, `design`
  is arguable, as holdout 20 noted for the same shape. Under `design`, `heading-level-skip` has a false
  positive from one app only, and neither C6 nor C7 judges it.
- **Conectando-Corazones's `top-level-landmark` on `proyectos/[id]/+page.svelte:1665` is `design`.** The
  `<main>` is the `{:else}` of `{#if proyecto}` nested in the `{:else}` of `{#if data.error || !proyecto}`,
  an arm that can never render; the ledger labels an arm the analyzer credits but that never renders
  `design` (three entries). Under `fp`, `top-level-landmark` would have false positives from two apps
  (93.5%, above 90%), and C6 would fail if it were grouped with haps's `<main>` class below as one limit
  (an arm read as rendering when it cannot).
- **EZHarness's `HubComponentRenderer` `single-h1` is `design`.** Both counted `<h1>`s render only after a
  client-side fetch on a server-rendered route, so neither is in the server HTML; the second appears only
  when an extension's hub page has a level-1 heading. Read as "client-only counts as absent", it is `fp`,
  in one app.

## Critical findings (C3)

43 critical findings: 42 `title-presence` and one `handler-state-write`. Of the `title-presence` findings,
34 are tp (Conectando-Corazones 15, minilib 13, chapterlane's three `sv create` demo routes,
speedfog-racing's `/auth/callback` and `/daily`, umbod's `/`) and 8 are `design`: speedfog-racing's seven
`/overlay` routes, browser-source overlays for streaming software under a `noindex` layout, and an
unlinked three-line stub in Conectando-Corazones. The `handler-state-write` is across-frontend's
`/user/logout` universal load writing the constant `false` to a store nothing else reads, labelled
`design`.

## False-positive classes

| Class                                                                                                                                | Findings | Apps | Rules                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | -------------------------------------- |
| A layout `<main>` behind `{#if data.user}`, and the page's own `<main>` behind `{#if !data.user}` on the same field                  | 2        | 1    | duplicate-landmark, top-level-landmark |
| A heading in a snippet passed to a component as a prop, read where the snippet is defined rather than where the component renders it | 1        | 1    | heading-level-skip                     |
| A modal heading after a block, compared with the `<h1>` of an arm that never renders with it                                         | 1        | 1    | heading-level-skip                     |
| The route's first image rendered earlier by a child component (a project cover), so the flagged image is not the LCP image           | 1        | 1    | lcp-image                              |

haps's `<main>` class is the fourth holdout in a row to reach a layout branch decided by `load` data,
after holdout 25's cashflow, holdout 26's kitchenbrain and holdout 27's SmartLock-Dashboard, each time
in one app. The `lcp-image` class has a ledger precedent of the same shape.

## C2 in detail

GitHub Actions run 37747574047 (harness in `scripts/holdout-build/`). The plugin ran on 11 apps and
crashed on none. Eight builds completed: filemat (17 prerendered routes analyzed, 2 skipped as
`ssr = false`), wrenn (its 25 prerendered routes are `ssr = false` and were skipped), and merckel.dev,
umbod, Puds2, chapterlane, frostbase and haps with no prerendered page. After the plugin ran,
across-frontend's build was stopped by the plugin's own gate on its one critical finding, the
`handler-state-write` on `/user/logout` labelled `design` above, so a documented over-report stopped a
real build; and
Conectando-Corazones's and speedfog-racing's stopped on `$env/static` variables not set. Before the
plugin ran, minilib's build stopped on `DATABASE_URL` not set and EZHarness's on a server route
importing a module the checkout does not contain; artgod's wrapped Vite config could not import the
plugin at all, since the app installs with Yarn Plug'n'Play and does not declare it, a limit of the
harness rather than of the plugin.

## Labelling notes

- The design share is concentrated in `description-presence` (314), `canonical-url` (277) and `each-key`
  (195); EZHarness, speedfog-racing, Puds2 and artgod together have 521 of the 945.
- Judgement calls the labellers flagged:
  - across-frontend's `localOnlyRoute()` routes answer 404 unless `PUBLIC_RUNTIME_ENV` is `local`, the
    default; they are labelled under the dev-only convention.
  - artgod's routes that render only in its "standard" deployment mode, which the source calls the
    operator's private routes, are `design` for description and title.
  - EZHarness's database reads stay `design` for `sequential-awaits`: its shipped database is embedded
    PGlite, which serves one connection at a time.
  - speedfog-racing's layout image keys cover 28 routes and are labelled by the 21-route majority; on
    the seven `/overlay` routes the image sits in the `{:else}` of a `pathname.startsWith('/overlay/')`
    test, which the heading rules decide by route and the image rules do not.
- Conventions the labellers applied but questioned:
  - `sequential-awaits` where the earlier await is a 404 check is `tp` in about 78 ledger entries and
    `design` in 11.
  - Login and sign-up pages are `tp` or `design` for description and title depending on whether the app
    has a separate marketing site, a line the ledger draws loosely.
  - `sv create` demo routes are `tp` for `title-presence` in most ledger entries and `design` in two.
  - A column list toggled at runtime is `design` for `each-key`, as a static column definition.
- Seen while labelling, not false positives: haps's root layout emits its og and twitter tags only under
  `{#if data.meta}`, and its layout `load` returns `meta: null` on every route but `/event/[slug]`, so
  those tags are missing on its other routes and nothing reports it.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
