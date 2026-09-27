# v1 holdout 8 — result (2026-09-27)

Measured with `main` at 4b233ff6 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-27-v1-holdout-8-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. Raw first
look: `scripts/corpus/holdout-8-2026-09-27.json`; verdicts:
`scripts/corpus/holdout-8-2026-09-27-verdicts.json` (4,538 distinct keys from 13 apps, every one
labelled by checks over the source at the pinned commit, with npm package components read from their
published files).

**Result: not ready.** Five of ten criteria fail. C1 fails for the first time: on eco the CLI did not
finish within the runner's 180-second limit and was killed, so that app has no findings. C3 fails on a
single finding. C4 (99.6%) and C5 (98.5%) pass, with the fewest false positives of any holdout (36).

| #   | Criterion                          | Threshold      | Measured                                              | Result | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 1 of 14 apps (eco: killed after 180 s)                | fail   | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 9 apps, 3 of which built         | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 1 (`handler-state-write`)                             | fail   | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.6% (1,449 / 1,455)                                 | pass   | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 98.5% (1,943 / 1,972)                                 | pass   | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                       | fail   | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 4 rules below                                         | fail   | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 37.8% (938 / 2,482)                                   | fail   | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                 | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 77 (new: `performance/preconnect`, `a11y/abbr-title`) | pass   | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 3,480, fp 36, design 1,022, unclear 0.

C7's four rules: `performance/lcp-image` 71.4% (5 / 7), `seo/heading-level-skip` 82.4% (28 / 34),
`seo/single-h1` 84.1% (37 / 44), `a11y/top-level-landmark` 88.9% (16 / 18).

## The eco timeout (C1)

eco's `src/lib` holds generated components of 2–3 MB each. Every line number the analysis records goes
through one helper that counted newlines from the start of the file on each call, so a file with tens
of thousands of elements cost time quadratic in its size. Reproduced locally: the CLI did not finish
within 200 seconds on the uninstalled clone. With the helper answering from a per-file index of line
starts, the same run takes 3 seconds and the helper's results are unchanged; the fix follows with the
other fixes.

## False-positive classes

| Class                                                                                                                                                  | Findings | Apps | Rules                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ----------------------------- |
| JSON-LD emitted per item of a list (`{#each jsonLdScripts as script}{@html script}{/each}`) not recognised                                             | 18       | 1    | json-ld                       |
| **An `{#if}` a prop decides that the prop handling does not cover** (`title.length > 0`, `typeof title === 'string'`, a snippet rendered in both arms) | 3        | 3    | single-h1                     |
| A heading level taken from data in an `{#each}` (`{#if level === 2}<h2>{:else}<h3>`) compared across iterations                                        | 5        | 1    | heading-level-skip            |
| An extra `<h1>` behind a pathname condition in the layout                                                                                              | 2        | 1    | single-h1                     |
| A layout that renders the page bare in one arm and in `<main>` in another, folded to the `<main>` arm                                                  | 2        | 1    | top-level-landmark            |
| `lcp-image` pointing at an image when a component renders an earlier, eager one                                                                        | 2        | 1    | lcp-image                     |
| **A store write after `if (!browser) return;` read as a per-request server write**                                                                     | 1        | 1    | **handler-state-write**       |
| Single findings: an `<h1>` inside `{@html}` content (2); a heading level from `<svelte:element this={map[variant]}>` (1)                               | 3        | 2    | single-h1, heading-level-skip |

C6's class is the prop-decided `{#if}` whose test is not one of the forms holdout 7's fix reads; it
appears in convertigo, aid-ly and aqsha. The critical finding is PIC-SURE's root `+layout.ts`, which
returns on `!browser` before `user.set({})`: the browser-global rules read that early return as a
guard, `handler-state-write` does not.

## C2 in detail

GitHub Actions run 36282749549 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 9 apps and crashed on none. Three builds completed (aid-ly, catechismecatholique,
nino-chavez-photography); catechismecatholique prerenders 471 pages. convertigo, PIC-SURE and
heffdotdev stopped at the plugin's own critical gate, on the same critical findings the first look
reports: 37 and 2 `title-presence` findings labelled `tp`, and PIC-SURE's `handler-state-write`, the
one false critical. The others failed on their own: `$env` variables not set (forumgw, honeylink,
superyayas, MediaManager), the LFS check FSM's build script runs first (the checkout has LFS pointers),
`adapter-vercel` rejecting Node 24 (eco), a content schema error (aqsha), and knowledgebasket's route
analysis, which loads native modules its install left unbuilt (it installed only on the
`--ignore-scripts` retry).

## Labelling notes

- The design share is concentrated in `each-key` (200), `canonical-url` (160), `raw-html` (157) and
  `description-presence` (137); knowledgebasket, catechismecatholique and superyayas together have 538
  of the 938.
- Conventions the labellers applied but questioned: pathname-gated extra `<h1>`s are labelled both
  `design` and `fp` in the ledger (this round followed `fp`); an `aria-hidden` `<aside>` inside `<main>`
  as `design`; the top-level-landmark branch fold as `fp` while the same shape under duplicate-landmark
  is documented `design`; JSON-LD from repo data without `<` escaping as `tp` while the same data through
  `{@html}` is `design`; a `lcp-image` whose real first image is in a child component as `fp`.

## Next

Fix the classes above, including the timeout, and add these 14 apps to the tuning corpus. Claiming the
criteria needs a ninth holdout.
