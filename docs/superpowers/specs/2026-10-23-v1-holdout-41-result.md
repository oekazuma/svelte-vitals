# v1 holdout 41 — result (2026-10-23)

Measured with `main` at 30f75e3c on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-23-v1-holdout-41-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-41-2026-10-23.json`;
verdicts: `scripts/corpus/holdout-41-2026-10-23-verdicts.json` (4,510 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.9% and C5 at 99.8%, no false-positive class reaches two apps, the one rule C7 judges is at 96.2%, and
no key is `unclear`. C8, published without deciding the result, is 36.8%. The release decision stays with
the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                           | Result   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | -------------------------------------------------- | -------- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                  | pass     | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 13 apps, 12 of which built    | pass     | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                                  | pass     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.9% (1,484 / 1,485)                              | pass     | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.8% (1,869 / 1,872)                              | pass     | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                               | pass     | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 1 judged, none below 90% (none by the earlier one) | pass     | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 36.8% (910 / 2,472)                                | reported | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                              | pass     | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                      | pass     | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,430, fp 4, design 1,076, unclear 0.

C7 judges one rule: `seo/single-h1` has false positives from two apps (skill_pool and mnema, in different
classes) and 82 findings, 76 tp and 3 fp, so 96.2%. By the earlier definition no rule with ten or more
findings falls under 90%; `seo/heading-level-skip` (26 findings, one fp) is also at 96.2%.

## Critical findings (C3)

82 critical findings, all `title-presence`: 77 tp (okpan-app 35, gofolio-web 20, pure3d 14, jv 8) and 5
`design` (okpan-app's `/debug`, `/test/assets`, `/test/ui`, `/logs` and `/translations`, reached only from
a menu its sidebar renders under `{#if systemInfo.isDev}`).

## False-positive classes

| Class                                                                                                                                                 | Findings | Apps | Rules              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------ |
| An `<h1>` rendered by `{@html}` of committed markdown that opens with `# `                                                                            | 1        | 1    | single-h1          |
| A heading in a snippet rendered only from another snippet, placed after the layout's heading instead of the outer snippet's                           | 1        | 1    | heading-level-skip |
| A layout `{#if}` on the window a desktop shell opens (`isMainWindow`), not on the route, so a modal's `<h1>` counts on routes only other windows load | 2        | 1    | single-h1          |

The first is skill_pool's `/help/[slug]`, which renders `marked.parse()` of a committed `docs/*.md` file
with `{@html}`; it is the class earlier holdouts left open, since reading `{@html}` headings cost real
findings elsewhere. The second is pure3d's `/admin/workflow`: the `<h4>` sits in `{#snippet
assignmentTable}`, rendered only from the `editionCard` snippet right after an `<h3>`, and was read as
following the admin layout's `<h2>`. The third is mnema, a Tauri app whose root layout mounts
`LicenseDeepLinkModal` only `{#if isMainWindow}`, while `/onboarding`, `/access/request` and `/update`
load in their own windows.

One more misreading hides inside a key labelled `design` by its majority: on pure3d's `/test-voyager`,
`id-duplication` counts `<voyager-explorer id="voyager">` twice, though it sits in an `{:else if direct}`
arm and the page's first viewer passes `direct={false}` literally. The analyzer leaves a literal-prop arm
undecided when the chain's first test is not a prop test.

## C2 in detail

GitHub Actions run 39892531099 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14
apps installed. The plugin ran on 13 apps and crashed on none. Twelve builds completed: shed (11
prerendered routes skipped as `ssr = false`), the Ku6epXBOCTuK site (7 skipped), and jv, skill_pool, mnema,
VulnArena, muelle, gofolio-web, support, mowdeck, Casals and hack with no prerendered page. After the
plugin ran, pure3d's build stopped on a `$env/static/public` variable not set. Before it ran,
okpan-app's build script called `vite` from the `node_modules` of its nested `src/website/` project,
which the install does not populate.

## Labelling notes

- No route a route-level finding is on never renders. The routes that always redirect (gofolio-web's
  `/`, `/home`, `/portfolio` and `/admin`, pure3d's `/about` and `/reviews`, jv's `/guitar`, muelle's
  `/settings`) carry none.
- The design share is concentrated in `canonical-url` (310), `description-presence` (294), `each-key`
  (110) and `each-index-key` (108); okpan-app, pure3d, support and mnema together have 511 of the 910.
- okpan-app contains a second SvelteKit project under `src/website/`, which the scan reads as components
  of the outer app; its findings are real code, labelled as such.
- Conventions the labellers applied but questioned:
  - A desktop shell's missing canonical is `design` for the one Electron app in the ledger and `tp` for
    the Tauri ones; okpan-app (Electron) and mnema (Tauri) follow those precedents.
  - A client-side redirect stub's missing `<h1>` is `tp` in most ledger entries and `design` in about a
    quarter; this round follows the majority.
  - A 404 gate before an independent query is `tp` for `sequential-awaits` in most entries and `design`
    in about eleven.
  - An in-place `.sort()` of a prop inside `$derived` is `design`, though on a `$state` array it throws
    `state_unsafe_mutation`.

## Next

Add these 14 apps to the tuning corpus. The snippet-in-snippet heading placement and the `{:else if}`
literal-prop arm are the fixable candidates; the `{@html}` markdown heading stays open as before, and the
window-gated layout branch depends on desktop-shell state the source does not fix.
