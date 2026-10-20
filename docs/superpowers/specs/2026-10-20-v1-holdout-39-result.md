# v1 holdout 39 — result (2026-10-20)

Measured with `main` at b102e0f2 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-20-v1-holdout-39-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-39-2026-10-20.json`;
verdicts: `scripts/corpus/holdout-39-2026-10-20-verdicts.json` (4,962 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.6% and C5 at 99.9%, no false-positive class reaches two apps, no rule is judged under C7, and no key is
`unclear`. C8, published without deciding the result, is 32.6%. The release decision stays with the owner,
as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 9 of which built  | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.6% (1,715 / 1,722)                           | pass     | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (2,126 / 2,129)                           | pass     | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (none below 90% by the earlier one) | pass     | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 32.6% (847 / 2,598)                             | reported | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,870, fp 10, design 1,082, unclear 0.

C7 judges no rule. `id-duplication` has false positives from two apps (trakt-web and matthias-brodbeck, in
different classes) but only five findings, under the ten C7 needs. By the earlier definition no rule with
ten or more findings falls under 90%.

## Critical findings (C3)

30 critical findings, all `title-presence`: 29 tp (rs-of 19, ai-marketing-platform 7, finance-owl 2,
telomere.ai 1) and 1 `design` (ai-marketing-platform's unlinked `/login/error` stub).

## False-positive classes

| Class                                                                                                                                                   | Findings | Apps | Rules                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------ |
| A layout `{#if}` on `page.route.id?.startsWith('/admin') ?? false` (through a `$derived`) not decided per route, so its `<main>` counts on admin routes | 3        | 1    | duplicate-landmark, id-duplication, top-level-landmark |
| A component `{#if}` on `["hot", "unrated"].includes(style)`, with `style` passed literally, not decided                                                 | 1        | 1    | id-duplication                                         |
| A component `{#if}` on a prop read through `...rest` of `$props()` (`$derived(rest.type)`), not decided                                                 | 1        | 1    | id-duplication                                         |
| A heading a modal renders from a `title` prop given a non-empty `?:` of two literals, not counted before the content's `<h3>`                           | 1        | 1    | heading-level-skip                                     |
| An `<h1>` in a component loaded with `import()` on an `ssr = false` route, not counted                                                                  | 1        | 1    | single-h1                                              |
| A `data:image/svg+xml` `src` a server load builds, not read as an SVG                                                                                   | 1        | 1    | responsive-image                                       |
| A browser global read on the right of `typeof localStorage === 'undefined' \|\|`, not read as guarded                                                   | 1        | 1    | instance-browser-global                                |
| An await whose request goes to a base URL an earlier await wrote into module state, read as independent                                                 | 1        | 1    | sequential-awaits                                      |

The first is matthias-brodbeck: `src/routes/+layout.svelte:13` holds `isAdmin = $derived(page.route.id?.startsWith('/admin') ?? false)`
and renders `{@render children()}` bare in `{#if isAdmin}`, so the admin layout's `<main id="main">` is the
only `<main>` on its 13 routes. The route reading decides `startsWith` on the path and `includes` /
`===` on the route id, not `startsWith` on the route id. The two trakt-web classes and the kepin-official
heading class are prop decisions the analyzer leaves open; baleia's `/_dev/patterns` renders only in dev,
where its client-loaded examples open with an `<h1>`.

## C2 in detail

GitHub Actions run 39384030516 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14
apps installed. The plugin ran on 12 apps and crashed on none. Nine builds completed: the Astrosky website
(48 prerendered routes analyzed), matthias-brodbeck (12 analyzed), baleia and series-tracker (19 each
skipped as `ssr = false`), axon (1 skipped), and ai-detector, ai-marketing-platform, archive and telomere.ai
with no prerendered page. After the plugin ran, kepin-official's build stopped on `$env/static` variables
not set, finance-owl's on a workspace package not built before the app, and rs-of's on a workspace package
whose built exports are behind its source. Before the plugin ran, curarehab's build stopped in a GraphQL
codegen step that needs its CMS. trakt-web built, but the plugin never reported: the app's own Vite plugin
(`.vite/deno-sveltekit-exit.ts`) calls `process.exit(0)` in `closeBundle` once the server manifest exists,
before the plugin's own `closeBundle` runs.

## Labelling notes

- No route a route-level finding is on never renders. The routes that always redirect (trakt-web's
  `/_design_system`, ai-marketing-platform's `/` and `/brands`, baleia's `/`, `/settings` and `/profile`,
  ai-detector's `/`, the Astrosky website's `/posts`, rs-of's `/setup` and `/logout`) carry none.
- The design share is concentrated in `description-presence` (304), `canonical-url` (300) and `each-key`
  (131); axon, baleia, trakt-web and series-tracker together have 469 of the 847.
- Conventions the labellers applied but questioned:
  - `og:*`, `twitter:*` and `json-ld` presence stay `tp` on routes behind a sign-in, where `canonical-url`
    and `description-presence` are `design`.
  - Client-side redirect and OAuth callback stubs are `tp` for `title-presence` and `single-h1` in most
    ledger entries and `design` in a few.
  - Messages of one fetched result are `design` for `each-key` while form validation errors are `tp`; the
    ledger is split on that line.
  - The analyzer reads `typeof localStorage` as proving nothing (Node 25 defines `localStorage`), while the
    `instance-browser-global` docs call `typeof` checks guards without that caveat.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
