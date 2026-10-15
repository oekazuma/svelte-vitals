# v1 holdout 35 — result (2026-10-15)

Measured with `main` at 321cc5ea on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-15-v1-holdout-35-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-35-2026-10-15.json`;
verdicts: `scripts/corpus/holdout-35-2026-10-15-verdicts.json` (3,612 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: C4 fails.** Warning precision is 92.8%, under its 98%. 137 of the 142 false positives are one
class in one app: fastpitstop's `hooks.server.ts` replaces an HTML-comment placeholder in `app.html`
with a block of head tags on every response, and the analyzer reads the head as lacking them. Every
other deciding criterion passes: no crash in either mode, no false critical finding, C5 at 97.0%, no
false-positive class reaches two apps, no rule is judged under C7, and no key is `unclear`. C8,
published without deciding the result, is 26.6%. The release decision stays with the owner, as the
criteria say. The result rests on one call set out first under "What the result rests on": taken the
other way, C4 is 99.8% and every deciding criterion passes.

| #   | Criterion                          | Threshold      | Measured                                            | Result   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | --------------------------------------------------- | -------- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                   | pass     | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 14 apps, 10 of which built     | pass     | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                                   | pass     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 92.8% (1,262 / 1,360)                               | fail     | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 97.0% (1,437 / 1,481)                               | pass     | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                                | pass     | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (2 below 90% by the earlier definition) | pass     | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 26.6% (496 / 1,863)                                 | reported | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                               | pass     | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                       | pass     | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 2,706, fp 142, design 764, unclear 0.

C7 judges no rule: no rule has false positives from two apps. By the earlier definition, two rules with
ten or more findings fall under 90%, both from fastpitstop: `canonical-url` at 83.8% (98 / 117) and
`description-presence` at 53.7% (22 / 41).

## What the result rests on

- **fastpitstop's hook-written head is read as rendered, so the 137 claims are `fp`.** `src/app.html:47`
  holds `<!--seo-head-->`, and the `handle` in `src/hooks.server.ts:27-43` replaces it through
  `transformPageChunk` with `renderSeoHead(seoFor(path))` (`src/lib/seo.ts:368-396`): a description,
  canonical, `og:*` and `twitter:*` tags on every path (`seoFor` ends in a fallback), and JSON-LD on four.
  Only a failure inside the hook's `try` leaves the placeholder empty. The ledger labels a hook that fills
  an `app.html` placeholder as rendering what it writes (Avi-ADAM's `%desc%`, `fp`); the `design` call of
  holdout 31 covers a server outside SvelteKit, and `hooks.server.ts` is SvelteKit source the analyzer
  reads. The analyzer already reads a `%…%` placeholder in a head tag as present with a dynamic value;
  it does not read a placeholder that stands for whole tags. Under `design`, warning precision is 99.8%
  (1,262 / 1,265) and info precision 99.9%, and **every deciding criterion passes**.

## Critical findings (C3)

8 critical findings, all `title-presence`: 7 tp (bmccorm2's web, an `ssr = false` app with no title on
those routes) and 1 `design` (R2WX's `/devroom`, an unlinked developer icon gallery).

## False-positive classes

| Class                                                                                                                                      | Findings | Apps | Rules                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ----------------------------------------------------------------- |
| Head tags a `handle` writes into an `app.html` comment placeholder through `transformPageChunk`, not read                                  | 137      | 1    | canonical-url, description-presence, json-ld, og-\*, twitter-card |
| A component's own `<main id="main">` in its error and loading arms, counted with the `<main>` in the children it renders only in `{:else}` | 2        | 1    | duplicate-landmark, id-duplication                                |
| A write through a `const` holding an element of a `$state` array (`const tile = tiles[i]; tile.turn += 1`), not read as a mutation         | 1        | 1    | unmutated-state                                                   |
| Five sibling `{#if}` blocks on one `stage` value, one of them an `\|\|` of two values, counted as two                                      | 1        | 1    | single-h1                                                         |
| The route's first image rendered by a child component (a hero), so the flagged image is not the LCP image                                  | 1        | 1    | lcp-image                                                         |

The landmark class (Mithra's `SessionGate`) is labelled by the ledger's rule that copies in arms of one
`{#if}` chain counted together are `fp`; the landmark docs, unlike the heading docs, do not say where
content passed to a component sits, and under `design` nothing changes. The `single-h1` and `lcp-image`
classes have ledger precedents, and the `single-h1` one contradicts the docs' reading of `||`.

## C2 in detail

GitHub Actions run 38674737942 (harness in `scripts/holdout-build/`). All 14 apps installed. The plugin
ran on all 14 and crashed on none. Ten builds completed: GF-HOME-NEXT (52 prerendered routes analyzed),
orchestrate (22 analyzed), vnta (14 analyzed, 1 skipped as `ssr = false`), and kesh, carbon-panel,
fastapi-svelte, cowkoszyku, fastpitstop, Mithra and concepts-browser with no prerendered page. After the
plugin ran, Taqdeer-Alitura's build stopped on lightningcss rejecting its CSS when minifying, and orca's,
bmccorm2's and R2WX's on `$env/static` variables not set.

## Labelling notes

- No route a route-level finding is on never renders. The routes that always redirect (GF-HOME-NEXT's
  `/`, `/l` and `/s`, cowkoszyku's and Taqdeer-Alitura's `/admin`, concepts-browser's `/`, orca's
  `/logout`, Taqdeer-Alitura's `/profile/logout`) carry none; GF-HOME-NEXT's `/[lang]/l` and `/[lang]/s`
  are prerendered interstitials that render.
- The design share is concentrated in `description-presence` (216), `canonical-url` (187) and `each-key`
  (97); kesh, cowkoszyku, vnta and Mithra together have 275 of the 496.
- orca's head library, svelte-meta-tags 4.7.0, emits canonical, `og:*` and `twitter:*` only for the
  props passed (read on jsDelivr); its `MetaTags` uses pass a title and description only, so those
  "missing" claims are `tp`.
- Conventions the labellers applied but questioned:
  - `og:*` and `twitter:*` presence stay `tp` on routes behind a sign-in, where `canonical-url` and
    `description-presence` are `design`.
  - A layout-wide title shared mostly by gated routes is labelled by the majority; Taqdeer-Alitura's
    15-character title is `design` by that rule although it is short on its public shop pages too.
  - `sequential-awaits` after a 404 gate is `tp` in most ledger entries and `design` in about fifty.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
