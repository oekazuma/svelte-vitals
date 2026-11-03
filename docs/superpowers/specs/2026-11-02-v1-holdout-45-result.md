# v1 holdout 45 — result (2026-11-02)

Measured with `main` at 7247e110 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-11-02-v1-holdout-45-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-45-2026-11-02.json`;
verdicts: `scripts/corpus/holdout-45-2026-11-02-verdicts.json` (4,158 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.85% and C5 at 99.78%, no false-positive class reaches two apps, no rule is judged under C7, and no key is
`unclear`. C8, published without deciding the result, is 36.5%. The release decision stays with the owner,
as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H44    | H43    | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ------ | ------ | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 14 apps, 11 of which built | pass     | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0      | 0      | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.85% (1,304 / 1,306)                          | pass     | 99.09% | 99.69% | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.78% (1,804 / 1,808)                          | pass     | 99.73% | 99.4%  | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | none   | none   | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (1 below 90% by the earlier one)    | pass     | none   | none   | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 36.5% (787 / 2,156)                             | reported | 38.1%  | 35.0%  | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80     | 80     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,171, fp 6, design 981, unclear 0.

C7 judges no rule: every rule's false positives come from one app. By the earlier definition one rule falls
under 90%: `performance/lcp-image`, whose 11 findings are 6 `tp`, 4 `design` and 1 `fp` (feega), 85.7%.

## Critical findings (C3)

67 critical findings. 64 are `title-presence`: 60 `tp` (feega 24, colibri 20, open-loops 15 and tornscope 1)
and 4 `design`, feega's three native-bundle-only `/auth/native` pages and colibri's unlinked placeholder
`/works/[work=id]/cover`. The other 3 are `handler-state-write` on ldns's
`(tools)/[domain=validdomain]/+layout.js`, all `tp`: its universal `load` runs during SSR and writes the route
param and `?ep=` onto module singletons that the page reads while rendering.

## False-positive classes

| Class                                                                                                   | Findings | Apps | Rules     |
| ------------------------------------------------------------------------------------------------------- | -------- | ---- | --------- |
| JSON-LD from `<svelte:element this={NAME}>`, where `NAME` is a constant holding `'script'`              | 4        | 1    | json-ld   |
| An `<h1>` from a component picked out of a lookup table passed to a CMS's slice renderer                | 1        | 1    | single-h1 |
| A lazy image reported as the route's first when lazy images rendered by child components come before it | 1        | 1    | lcp-image |

The first is tran_real_estate's four `/tools/*` routes: each renders `ToolPage`, which passes `jsonLd` to
`SeoHead.svelte`, and that writes `const scriptTag = 'script'` and renders
`<svelte:element this={scriptTag} type="application/ld+json">` in its `<svelte:head>`. The second is paul's
blog post route, which renders `<SliceZone slices={data.post.data.slices} {components}>`; the table's
`main_title` entry renders the `<h1>`. The slice is optional in the CMS's type, so a post without it would
really have no `<h1>`. The third is feega's `/app/templates`, where the flagged poster is in the third shelf,
after the images of `ComponentShelf` and `PosterShelf`. Those are lazy too, so the route does have the defect,
on a different image. The rule's docs say source analysis leaves out images rendered by a child component, so
this `fp` follows the ledger's child-component entries; read by the docs alone it would be `design`.

One misreading hides in keys not labelled `fp`: uURU's `extension_edit.svelte` reports three `<h1>`s on
`/extensions/new`, but the arm at line 319 does not render there because no `extension` is passed, so the count
is two at most. "Multiple" still holds, so the key is `tp`.

## C2 in detail

GitHub Actions run 41378279467 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14 apps
installed. The plugin ran on all 14 and crashed on none. Eleven builds completed: tran_real_estate (44
prerendered routes analyzed), portalditek (5), storefront (4) and uURU (0, skipping 13 with `ssr = false`), and
paul, feega, Harbor, InTheKnow, open-loops, training-tools and FCA with no prerendered page. ldns's build stopped
on the plugin's critical gate: the three `handler-state-write` findings, which are true (above). colibri's and
tornscope's stopped after the plugin ran, on their workspace packages `@colibri-hq/ui` and `@tornscope/shared`,
whose entries are not built.

## Labelling notes

- Routes that never render: tornscope's `/faction/ranked-wars` and `/faction/organized-crimes`, InTheKnow's
  `/admin`, `/settings`, `/language` and `/sign-out`, colibri's `/api` and `/discover/[catalog=id]`, and
  feega's `/`, `/app/api-keys`, `/p/[projectId]/studio`, `/p/[projectId]/studio/[batchId]`,
  `/p/[projectId]/uncensored` and `/p/[projectId]/settings/billing` always redirect. None carries a finding.
- The design share is concentrated in `description-presence` (213), `canonical-url` (209) and `each-index-key`
  (162); feega, paul, colibri and Harbor together have 432 of the 787.
- colibri's `load-waterfall` at `[...segments]/+page.ts:47` is the closest `design` to `fp`: the browser's feed
  request depends on the catalog result, and `browser ? feed : await feed` streams it there, so the flagged
  `await` runs only during SSR.
- Conventions the labellers applied but questioned:
  - tornscope's 25 `canonical-url` keys are `design` under the client-side gate precedent, though it has no login
    and its README advertises a public instance: its root layout sends a visitor with no connected player to
    `/welcome`.
  - The `canonical-url` line between `tp` and `design` depends on whether a gate is written as a redirect, not on
    whether a crawler can reach the route: uURU's `/admin/*` and the internal portalditek are `tp` because their
    source has no gate.
  - `robots.txt` `Disallow` alone counts as "not a search target" for storefront's length rules, though it blocks
    crawling rather than indexing.
  - `seo/json-ld` stays `tp` on gated or `ssr = false` routes, where `description-presence` is `design`.
  - a11y markup claims on components nothing imports are `tp`, while `raw-html` and `iframe-loading` give the same
    shape `design`. colibri's `ModalCloseButton` (`no-autofocus`) is the weakest: nothing renders it.
  - `pattern-title` under `<form novalidate>` is `design` by extending the "no form" class, with no direct
    precedent.
  - Five older ledger entries for a `srcdoc` iframe are `unclear`; this round follows the later `design` entries.

## Next

Add these 14 apps to the tuning corpus. All three false-positive classes are single-app. The
`<svelte:element>` JSON-LD is the largest, but the shape is in one file of the corpus, and reading it also
silences ten true findings on the routes that render `SeoHead` without `jsonLd`, so it stays unread.
