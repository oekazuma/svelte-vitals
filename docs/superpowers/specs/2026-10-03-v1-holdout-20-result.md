# v1 holdout 20 — result (2026-10-03)

Measured with `main` at 90893030 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-03-v1-holdout-20-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-20-2026-10-03.json`;
verdicts: `scripts/corpus/holdout-20-2026-10-03-verdicts.json` (6,099 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** C3 has no false critical finding, C4 and C5 are both
99.8%, no false-positive class reaches two apps, no rule falls under 90% (under either C7
definition), and no key is `unclear`. C8, published without deciding the result, is 32.8%. The
release decision stays with the owner, as the criteria say. The result rests on three labelling
calls, set out under "What the result rests on".

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 10 of which built | pass     | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.8% (2,189 / 2,193)                           | pass     | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.8% (2,592 / 2,596)                           | pass     | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (none by the earlier definition)     | pass     | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 32.8% (1,077 / 3,287)                           | reported | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                   | pass     | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63  |

The C7 history columns are the earlier definition, as published; the same holdouts under the current
one are in `2026-10-03-c7-multi-app.md` (holdout 18: 1; holdout 19: 1).

Verdicts (distinct keys): tp 4,798, fp 8, design 1,293, unclear 0.

C7 judges two rules, both above the threshold: `seo/heading-level-skip` 93.8% (45 / 48, false
positives from netscope and Entropia-Nexus) and `seo/single-h1` 94.9% (37 / 39, from xinity-ai and
Entropia-Nexus). No rule with ten or more findings has a false positive from only one app.

## What the result rests on

- **xinity-ai's `/api` `title-presence` (critical, C3).** The page sets `ssr = false` and writes a
  literal `<head><title>API Reference</title></head>` in its component markup; Svelte renders that
  `<title>` inside the body, never in the document `<head>`. It is labelled `tp` on the two ledger
  entries with the same shape (a literal `<head><title>` in markup). But a browser's `document.title`
  reads the first `<title>` in the document, body included, so the tab shows the title; read that way
  the finding is `fp`, C3 fails and so does the result. The same route's `single-h1` is labelled `fp`
  because a script the page loads renders an `<h1>` in the browser, so the ledger counts client-side
  rendering for headings on a never-SSR route but not for this title.
- **cacack/my-family's `id-duplication` on `/branches/[id]` (C6).** The labeller marked it `fp`: the
  two copies of `#bulk-heading` sit in `{:else if mergeable}` (`status === 'active'`) and in a separate
  `{#if status === 'merged'}`, so they never render together. It is labelled `design` here, because
  the rule's docs name this shape (`{#if a}…{/if}{#if !a}…{/if}` "is counted as both rendering") and
  the ledger labels never-co-rendering ids in separate blocks `design` (133 entries; its 4 `fp` are
  copies in one `{#if}` chain). Under the labeller's `fp`, the earlier C7 definition would fail on
  `id-duplication` (66.7%, one app), and C6 would fail if this and Entropia-Nexus's heading below were
  grouped by the documented limit they share (separate blocks counted as rendering together), as
  holdouts 17 and 19 grouped classes; grouped by mechanism, it would not.
- **Entropia-Nexus's `maps` `heading-level-skip`.** Labelled `fp`: the `<h1>` it is paired with and the
  flagged `<h4>` sit in blocks that never render together. The rule's docs say separate blocks are
  treated as all rendering, so `design` is arguable; the labeller left the call to the maintainer. It
  is one app either way and does not change the result.

## Critical findings (C3)

18 critical findings: 17 `title-presence`, all tp (Entropia-Nexus 13, xinity-ai 2, motomate 2), and
one `handler-state-write`, glint's OG-image cache keyed by public slugs, the memoization shape the docs
describe, labelled `design`. Each title was decided on its route's full render chain, including the
npm components the chain renders.

## False-positive classes

| Class                                                                                                                                    | Findings | Apps | Rules              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------ |
| A component's own heading (`<svelte:element this={level === 2 ? 'h2' : 'h3'}>`, `level` defaulting to 2) not taken as the heading before | 2        | 1    | heading-level-skip |
| A heading paired with one in a block that never renders at the same time                                                                 | 1        | 1    | heading-level-skip |
| An `<h1>` in markdown a server load renders and the page outputs with `{@html}`                                                          | 1        | 1    | single-h1          |
| An `<h1>` a third-party script renders in the browser on an `ssr = false` route                                                          | 1        | 1    | single-h1          |
| An imported constant list its module aliases in a conditional (`cond ? LIST.slice(i) : LIST`) read as possibly written                   | 1        | 1    | each-key           |
| `$: data = data.sort(…)`, a legacy mutate-then-reassign in a reactive statement                                                          | 1        | 1    | prop-mutation      |
| A `kit.alias` `@/*` specifier read as a package, with a same-named import read as a whole use                                            | 1        | 1    | namespace-import   |

No class reaches two apps. The `{@html}` heading is the class holdouts 15–17 left open; it is one app
here. The netscope class contradicts the docs either way: the component's heading should precede the
flagged one, and a `<svelte:element>` whose level is undetermined should leave the next heading
unjudged.

## C2 in detail

GitHub Actions run 37118934885 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Ten builds completed: coms (420 prerendered routes analyzed),
vizchitra (263, one more skipped for `ssr = false`), quick-cards (10), parliament-watch (2), and
xinity-ai, my-family, Entropia-Nexus, Care-y, netscope and platform-dash with no prerendered page.
After the plugin ran, glint's build was stopped by the plugin's own gate on its critical finding, and
idah's on a generated module (`build/parser.js`) not built. Before the plugin ran, PardalisWebSite's
build stopped on `DATABASE_URL` not set and motomate's on a database directory missing at build time.

## Labelling notes

- The design share is concentrated in `description-presence` (273), `canonical-url` (235), `each-key`
  (203), `raw-html` (144) and `each-index-key` (106); Entropia-Nexus, vizchitra, xinity-ai and Care-y
  together have 629 of the 1,077.
- About 600 `each-key` verdicts were bucketed: every list source was listed by script with its
  declaration line and the design candidates read one by one; every other correctness finding was
  read individually.
- Conventions the labellers applied but questioned:
  - og/twitter and JSON-LD are never `design`, while canonical and description are `design` on
    routes that are not search targets (Care-y's robots-disallowed app, dev-only routes).
  - Copied-in shadcn-svelte primitives are `tp` for `prop-count` like the app's own components.
  - A load hop that only privileged users make (Entropia-Nexus's wiki editors, 21 keys) is `tp`.
  - Setup wizards are `tp` in one ledger entry and `design` in another; "redirects once configured"
    was the test applied.
  - Public login pages of self-hosted tools are `tp` unless noindex or robots-disallowed.
  - A `<main>` in a native modal dialog is `design`, where the ledger has both readings.
  - Test-only components are `tp`.
- Analyzer gaps that did not change a verdict: `duplicate-landmark` names whichever arm the fold
  picked as the location, not the arm the route renders (vizchitra).

## Next

Fix the classes above and add these 14 apps to the tuning corpus, as after every holdout. The release
decision is the owner's.
