# v1 holdout 47 — result (2026-11-06)

Measured with `main` at 434c1311 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-11-06-v1-holdout-47-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts, except ir-anthology and menagerist, whose installs stopped on an engines check and which
were measured uninstalled. Raw first look: `scripts/corpus/holdout-47-2026-11-06.json`; verdicts:
`scripts/corpus/holdout-47-2026-11-06-verdicts.json` (5,321 distinct keys from 14 apps, every one labelled by
checks over the source at the pinned commit).

**Result: every deciding criterion passes, on one correction to the first labels.** The labellers marked
`correctness/prop-mutation`'s three `.set()` calls on a store or form-field prop `fp`, which put the rule at
57.1% with false positives from two apps; the corpus labels a store's `.set()` `design`, and with those labels no rule
falls under C7 and no class is shared by two apps. No crash in either mode, no false critical finding, C4 at
99.55%, C5 at 99.87%, one key of 5,321 `unclear`. C8, published without deciding the result, is 32.6%. The release
decision stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H46    | H45    | H44    | H43    | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ------ | ------ | ------ | ------ | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 9 of which built | pass     | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0      | 0      | 0      | 0      | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.55% (1,774 / 1,782)                         | pass     | 99.38% | 99.85% | 99.09% | 99.69% | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.87% (2,357 / 2,360)                         | pass     | 99.73% | 99.78% | 99.73% | 99.4%  | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | none   | none   | none   | none   | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none (1 below 90% by the earlier one)          | pass     | 1      | none   | none   | none   | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 32.6% (881 / 2,701)                            | reported | 35.5%  | 36.5%  | 38.1%  | 35.0%  | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.02%)                                  | pass     | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                  | pass     | 80     | 80     | 80     | 80     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 4,169, fp 11, design 1,140, unclear 1.

C7 judges one rule, `seo/single-h1`, the only rule with false positives from two apps: 96.3% (52 / 54). By the
earlier definition `a11y/top-level-landmark` also falls under 90%: its 13 findings are 10 `tp` and 3 `fp`, all from
lumastra, 76.9%.

## What the result rests on

- **Three `prop-mutation` keys moved from `fp` to `design` after labelling.** Under the first labels the rule's 22
  findings were 4 `tp`, 15 `design` and 3 `fp` from two apps, which fails C7 at 57.1% and, read as one class, C6.
  - lumastra's `HeroSection.svelte:761` and `:799` call `muteStore.set(…)` on a prop typed
    `Writable<boolean> | undefined`. The corpus has 22 keys of a svelte store's `.set()` on a prop, all `design`, and
    none `fp`; `temporalio/ui`'s `filter-bar.svelte:49` is the same call on a prop typed `Writable<…>`.
  - orion's `HiddenField.svelte:12` calls `field.set(value)` on a `RemoteFormField<V>`. Kit's `form-utils.js` turns
    that call into `set_input`, which writes the form's state, so it changes state through the field's own API as a
    store's `.set()` does. The corpus's `fp` keys for this rule are calls that do I/O or change nothing. This key
    has no direct precedent, but it does not decide the result: left `fp`, the rule would have false positives from
    one app and C7 would not judge it.
- **One key stays `unclear`.** lumastra's `admin/system/instance/+page.server.ts:167` awaits
  `getLicenseServerContact()` after `getLicenseStatus()`. Both go through a provider that is not in the repository,
  so whether the first updates what the second reads cannot be decided from the source.

## Critical findings (C3)

40 critical findings, all `title-presence`: 38 `tp` (auditlift-v2 18, sunlight 10, ir-anthology 8 and orion 2) and 2 `design`, on deskfolk's `/` and ir-anthology's `/callback`, both pages that only redirect.

## False-positive classes

| Class                                                                                                             | Findings | Apps | Rules                                  |
| ----------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------- |
| A root layout's `{#if isAuthPage}` arm with no `<main>`, on a flag a local function derives from the pathname     | 6        | 1    | duplicate-landmark, top-level-landmark |
| `aria-label` on a `use:dndzone` item, which svelte-dnd-action gives `role="listitem"` at runtime                  | 2        | 1    | disallowed-aria-props                  |
| A layout's `{:else if}` arm with no `<h1>`, on a `$derived` that holds `page.route?.id === …` beside another test | 1        | 1    | single-h1                              |
| A component's `level === 1` arm, reachable only through a prop its caller forwards from a default of 3            | 1        | 1    | single-h1                              |
| An await after one whose result guards a value the later query takes                                              | 1        | 1    | sequential-awaits                      |

The first is lumastra's `/login`, `/setup` and `/setup/locked`: the root layout puts children in a plain `<div>`
in that arm, and the root `<main>` sits only in the `{:else}`, so each page's own `<main>` is the only one. The
second is `FullScreenPlayer.svelte:885` and `QueuePanel.svelte:592`, checked against svelte-dnd-action 0.9.80's
`keyboardAction.js`. The third is lumastra's `/livetv/simple-setup`. The fourth is llama-forge's
`DynamicHeading`, used by `EmptyState`, `ModelCard` and `ServerCard`, none of which passes level 1. The fifth is
lumastra's `admin/library/fix-matches/+page.server.ts:109`, whose filters take `libraryGroupId` only when
`libraries.some(…)` accepts it.

## C2 in detail

GitHub Actions run 42053525611 (harness in `scripts/holdout-build/`; no stage ran into its limit). 12 apps installed;
ir-anthology's stopped on pnpm's engines check and menagerist's on npm's, which requires Node 26. The plugin ran on
11 and crashed on none. Nine builds completed: games.jakob-r.de (7 prerendered routes analyzed), and sunlight,
llama-forge, Kampusia, libby, lumastra, rustbase, teweicun and orion with no prerendered page. deskfolk's build
stopped on the plugin's critical gate after 39 prerendered routes were analyzed: the `title-presence` finding on
`/`, which is `design`. Ripper-Radar's stopped after the plugin ran, on a `$env/static/public` variable with no env
file. auditlift-v2's stopped before the plugin reported, when Kit's analysis imported a database module with no
`DATABASE_URL`.

## Labelling notes

- Routes that never render: lumastra's `/admin/developer`, `/admin/library`, `/admin/system` and `/settings/devices`,
  ir-anthology's `/`, and orion's `/` and `/staff` always redirect. None carries a finding.
- The design share is concentrated in `description-presence` (350), `canonical-url` (327) and `each-index-key` (121);
  lumastra, teweicun, orion and menagerist together have 646 of the 881.
- `performance/state-raw` flags two shapes in lumastra that its docs seem to exclude, a read-only `{@const}` alias
  and a read through a local snippet's argument object; both are `tp` because the use is read-only.
- Conventions the labellers applied but questioned:
  - Client redirect stubs on `title-presence` and `single-h1` are `design` this round, where holdout 46 followed the
    `tp` majority. Either way no criterion changes, though deskfolk's stub stopped its build at the gate.
  - Seven lumastra `sequential-awaits` keys are `tp` although `loadSettingsForSections` has a lazy config fallback
    that `loadSearchExposure` depends on; the config also initializes at import, and another route runs the pair in
    `Promise.all`.
  - `sequential-awaits` after a cache-hit or empty-list early return is `design`, following the auth-gate convention,
    while the ledger has `import()` awaits as `tp`.
  - `responsive-image` on an operator-set logo URL is mixed in the ledger; lumastra's is `design`.
  - The `each-key` line between read-only parts of one record (`design`) and runtime result lists (`tp`) stays blurry.

## Next

Add these 14 apps to the tuning corpus. Candidates to measure: a layout arm on a flag derived from `page.route?.id`
beside another test, a role svelte-dnd-action sets on a zone's items, and a prop forwarded from a default. The
qualified type name from holdout 46 and `handler-state-write` on a chain that exports `prerender = true` remain
candidates. Labelling should state the store `.set()` convention, which this round's labellers did not apply.
