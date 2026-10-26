# v1 holdout 43 — result (2026-10-25)

Measured with `main` at 1beaefe6 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-25-v1-holdout-43-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-43-2026-10-25.json`;
verdicts: `scripts/corpus/holdout-43-2026-10-25-verdicts.json` (3,746 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.69% and C5 at 99.4%, no false-positive class reaches two apps, no rule is judged under C7, and no key is
`unclear`. C8, published without deciding the result, is 35.0%. The release decision stays with the owner,
as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 10 of which built | pass     | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.69% (1,268 / 1,272)                          | pass     | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.4% (1,673 / 1,683)                           | pass     | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (1 below 90% by the earlier one)    | pass     | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 35.0% (707 / 2,019)                             | reported | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 2,981, fp 14, design 751, unclear 0.

C7 judges no rule: every rule's false positives come from one app. By the earlier definition
`seo/heading-level-skip` falls under 90%: of its 11 findings 8 are `fp`, all from dynodoc, and 3 are `tp`.
`a11y/duplicate-landmark` and `a11y/id-duplication` have false positives too, from callfs only, but fewer
than 10 findings each.

## Critical findings (C3)

41 critical findings. 40 are `title-presence` and `tp`: AidLog 31, coursedeck 8 and bigmarket-mr 1. The
other is innerio's `server-browser-global` on `window.location.origin` at module scope in
`src/lib/stores/session.svelte.ts:29`, `design`: the root `+layout.ts` sets `ssr = false`, nothing sets it
back, and the app has no server module, so the module is never evaluated on the server. It is the shape
the ledger already labels `design` in six corpus apps. The plugin's critical gate stopped innerio's build
on it (C2 below).

## False-positive classes

| Class                                                                                                                                                                                                            | Findings | Apps | Rules                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ---------------------------------- |
| A layout passes the page as children of a component that renders them in one `{#if}` arm, and another arm's landmark and ids are counted beside the page's                                                       | 4        | 1    | duplicate-landmark, id-duplication |
| A component's heading set by ``<svelte:element this={`h${level}`}>`` with a defaulted `level`, behind `{#if hasTitle}` with `hasTitle = $derived(!!(title \|\| heading))`, not read before the children's `<h3>` | 8        | 1    | heading-level-skip                 |
| JSON-LD from `{@html}` of a binding built by a helper whose name does not say JSON-LD                                                                                                                            | 2        | 1    | json-ld                            |

The first is callfs: the root layout renders `<ConsoleUniverse>{@render children()}</ConsoleUniverse>`,
and ConsoleUniverse renders the children only in its final `{:else}` and the sign-in shell (its `<main>`
and a second `LiveRegions`) only in the `/login` arm, so the two never render together. The analyzer folds
the component's arms on their own and adds the page's landmarks and ids on top. The second and third are
dynodoc's marketing pages: each `<h3>` follows a `<Section title="…">` that renders an `<h2>` first, and
`/add-ins` and `/support` write `{@html faqScript}`, where `faqScript = scriptTag({...})` returns a
`<script type="application/ld+json">` string; the sibling routes whose bindings are named `faqJsonLd` or
`structuredDataScript` are read.

Two misreadings hide in keys not labelled `fp`:

- bigmarket-mr's root layout renders `{@render children()}` only in the `{:else}` of `{#if !ready …}`, and
  `ready` turns true only in `onMount`, so no page head renders on the server for any route. The analyzer
  reports `description-presence` on 2 of the 19 routes and `title-presence` on 1; it misses the rest. Its
  length and duplicate findings on those routes are `tp`, read as the values the browser renders.
- innerio's two crypto modals each hold an `<h1>` and show at most one at a time; `single-h1` counts them as
  two on 9–10 routes whose pages have no `<h1>` of their own (`design` under the ledger's convention for
  separate state-dependent blocks), where the true finding is a missing `<h1>`.

## C2 in detail

GitHub Actions run 40198919873 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14
apps installed. The plugin ran on 12 apps and crashed on none. Ten builds completed: ESPresense-companion
(6 prerendered routes skipped as `ssr = false`), and callfs, dynodoc, Dwello, vertualspace, kvitto,
coursedeck, atmo-board, the ranga blog and vigie-web with no prerendered page. innerio's build stopped on
the plugin's critical gate (the `server-browser-global` finding above). agent-lens's stopped after the
plugin ran, on a `$env/static/private` variable not set. Before the plugin ran, bigmarket-mr's build
stopped on its workspace package `@bigmarket/sdk`, whose `dist` is not built, and AidLog's on
`vite-plugin-pwa` failing to read its `swSrc`.

## Labelling notes

- Routes that never render: Dwello's `/`, vertualspace's `/`, coursedeck's `/prompts` and
  `/settings/sync-mcp`, innerio's `/waiting`, and the ranga blog's `/blog/posts`, `/experiments/posts` and
  `/resume_engineer` always redirect. Only coursedeck's `/prompts` carries a finding
  (`base-path-navigation`), labelled `design`.
- The design share is concentrated in `description-presence` (270), `canonical-url` (210) and `each-key`
  (68); vertualspace, callfs, Dwello and dynodoc together have 446 of the 707.
- callfs serves its console under `paths.base: '/ui'`, so its `robots.txt` is not at the site root and
  does not reach crawlers; its `/login` canonical is `tp` on that reading.
- Conventions the labellers applied but questioned:
  - For `sequential-awaits` behind a cache, a call that can find the cache cold is `tp`, and one that reads
    the entry the previous await has just filled is `design`; the ledger has not drawn that line before.
  - A second `<main>` hidden by a Tailwind `hidden` class until its tab is active is `design` for
    `duplicate-landmark`, though the ledger labels class-hidden duplicates `tp` for `id-duplication`.
  - A desktop shell's missing canonical is `design` for Electron and `tp` for Tauri.
  - A redirect stub's missing canonical is `design` while its missing `og:*` tags are `tp`.
  - `performance/state-raw` still accepts a candidate with a `{@const}` alias whose only use is a
    function argument (AidLog), though the rule's docs say any aliasing reference rules a candidate out; the claim holds, so it is `tp`.

## Next

Add these 14 apps to the tuning corpus. All three false-positive classes are single-app; the callfs class
is the cheapest to measure, as it would also stop the two `a11y` rules counting a component's other arms
on every route under that layout.
