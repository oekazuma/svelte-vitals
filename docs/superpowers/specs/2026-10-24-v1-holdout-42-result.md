# v1 holdout 42 — result (2026-10-24)

Measured with `main` at 8b825bb9 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-24-v1-holdout-42-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 of 14 installed; edsuwarna/anjungan, whose `npm` install failed on a
peer-dependency conflict (ERESOLVE), was measured uninstalled. Raw first look:
`scripts/corpus/holdout-42-2026-10-24.json`; verdicts: `scripts/corpus/holdout-42-2026-10-24-verdicts.json`
(4,967 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.95% and C5 at 99.9%, no false-positive class reaches two apps, no rule is judged under C7, and no key is
`unclear`. C8, published without deciding the result, is 26.2%. The release decision stays with the owner,
as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 9 of which built | pass     | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.95% (1,995 / 1,996)                         | pass     | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (2,094 / 2,097)                          | pass     | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (1 below 90% by the earlier one)   | pass     | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 26.2% (719 / 2,747)                            | reported | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                  | pass     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 4,121, fp 4, design 842, unclear 0.

C7 judges no rule: every rule's false positives come from one app. By the earlier definition
`correctness/prop-mutation` falls under 90%: of its 15 findings 14 are `design` and 1 is `fp`, so it has
no `tp` at all here.

## Critical findings (C3)

32 critical findings, all `title-presence` and all tp: anjungan 28, zfaktury 3 and pokedumpster 1. None
of those routes sets a `<title>`, server- or client-side.

## False-positive classes

| Class                                                                                                                                                    | Findings | Apps | Rules              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------ |
| A collection method name (`clear`) called on a prop that holds an object of functions, whose named generic type the type exemption does not read         | 1        | 1    | prop-mutation      |
| A component's heading behind an `{#if}` of its own that tests the same value as the flagged heading's `{:else if}` arm, dropped as the heading before it | 1        | 1    | heading-level-skip |
| A layout that passes a snippet in place of `children` (`children={featureOff ? featureOffState : children}`), whose `<h1>` is counted beside the page's  | 1        | 1    | single-h1          |
| A `data:image/svg+xml` `src` held in an expression, not read as an SVG                                                                                   | 1        | 1    | responsive-image   |

The first three are trooptotask's `RosterPicker.svelte:126` (`selection.clear()` on the object
`useDataTableSelection` returns), Tessera's `/requirements/verification` (the `<h4>` in
`{:else if matrixData}` follows five `CardTitle` `<h3>`s in a separate `{#if matrixData}`) and trooptotask's
`WorkspaceFeatureOff.svelte:20`. The fourth is trooptotask's TOTP QR code (`totp.qr_code`, an inline SVG
data URI). The first class is the one holdout 19 settled the shape of (a client's own method named like a
collection's); the fourth is the class holdout 39 found in finance-owl, now in a second app across
holdouts.

One misreading hides in a key labelled `tp`: musicrain's settings layout renders
`<svelte:element this={index ? 'h1' : 'p'}>` with `index` read from `page.route.id`, and the analyzer
counts it as an `<h1>` on the subpages where it renders a `<p>`; the page's own `<h1>` and another
component's still make two.

## C2 in detail

GitHub Actions run 40086614200 (harness in `scripts/holdout-build/`; no stage ran into its limit). 13 apps
installed. The plugin ran on 12 apps and crashed on none. Nine builds completed: inertia (10 prerendered
routes skipped as `ssr = false`), depotin (3 prerendered routes analyzed), and deck, The-Whatever-Tracker,
offkai-manager, veterinary-clinic, Tessera, zfaktury and pokedumpster with no prerendered page (zfaktury
sets `prerender.entries: []`). After the plugin ran, the Cooper site's and trooptotask's builds stopped on
`$env/static` variables not set, and twoblade's on an import of a `websocket/` directory the repository
does not contain. Before it ran, musicrain's build script stopped in its `tsc` step on type errors in
`vite.config.ts`. anjungan was not built, its install having failed.

## Labelling notes

- Every route with a route-level finding renders. vet-clinic's `/settings`, whose `+page.ts` always
  redirects, carries none.
- anjungan exports `ssr = false` and `prerender = true` from `src/+layout.js`, outside `src/routes`, which
  SvelteKit does not load; the analyzer reads its routes as server-rendered, as SvelteKit renders them.
- The design share is concentrated in `description-presence` (266), `canonical-url` (203) and `each-key`
  (96); trooptotask, anjungan, The-Whatever-Tracker and zfaktury together have 388 of the 719.
- `performance/state-raw` flagged trooptotask's `read` though the component aliases it with
  `{@const options = read.options}` and passes members as props, which the rule's docs say rules a
  candidate out; the claim holds there, so it is `tp`, but the docs and the detector disagree.
- Conventions the labellers applied but questioned:
  - A desktop shell's missing canonical is `tp` (Tauri) in most entries while its missing description is
    `design` ("not a search target"); the one Electron app's canonical is `design`.
  - Whether a list of one record's parts is `tp` or `design` for `each-key` turns on whether the record
    can be swapped while the component stays mounted; the ledger is split close to evenly on that shape,
    and it decides about 60 keys here.
  - A sign-in or sign-up page's missing description is `design` in most entries and `tp` in about one in
    eight; this round reads it `tp` on hosted products and `design` on self-hosted apps.
  - A literal list exported from a workspace package is not exempt for `each-key`, though the analyzer
    follows workspace packages for components.

## Next

Add these 14 apps to the tuning corpus. The `data:image/svg+xml` source held in an expression has now
appeared in two apps across holdouts and is the first candidate; the snippet passed in place of `children`
and the shared-condition component heading are single-app classes.
