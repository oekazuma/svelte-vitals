# v1 holdout 46 — result (2026-11-04)

Measured with `main` at c78d4c98 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-11-04-v1-holdout-46-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-46-2026-11-04.json`;
verdicts: `scripts/corpus/holdout-46-2026-11-04-verdicts.json` (3,406 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: C7 fails.** `seo/heading-level-skip` is at 76.5% (13 / 17), under its 90%, with false positives from
two apps: PokeFluxDash's `Panel` renders its `<h2>` in `{#if title}` on a title passed as an expression, which
the outline does not count (3), and kalypzo-atrium's `<h3>` follows a bits-ui `Dialog.Title`, which renders a
level-2 ARIA heading the analyzer cannot see (1). The two are separate classes, so C6 passes. Every other
deciding criterion passes: no crash in either mode, no false critical finding, C4 at 99.38%, C5 at 99.73%, and
no key is `unclear`. C8, published without deciding the result, is 35.5%. The release decision stays with the
owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H45    | H44    | H43    | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ------ | ------ | ------ | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 10 of which built | pass     | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0      | 0      | 0      | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.38% (1,118 / 1,125)                          | pass     | 99.85% | 99.09% | 99.69% | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.73% (1,470 / 1,474)                          | pass     | 99.78% | 99.73% | 99.4%  | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | none   | none   | none   | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 1 below 90% (2 by the earlier one)              | fail     | none   | none   | none   | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 35.5% (637 / 1,794)                             | reported | 36.5%  | 38.1%  | 35.0%  | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80     | 80     | 80     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 2,620, fp 11, design 775, unclear 0.

C7 judges one rule, `seo/heading-level-skip`, the only rule with false positives from two apps. By the earlier
definition `correctness/prop-mutation` also falls under 90%: its 33 findings are 3 `tp`, 27 `design` and 3 `fp`
(infosections), 50.0%.

## What the result rests on

- **kalypzo-atrium's one key makes it two apps.** `(internal)/admin/users/+page.svelte:339` is an `<h3>` in a
  snippet rendered only at lines 427 and 590, inside `Dialog.Content` and after a `Dialog.Title`. That title
  wraps bits-ui 2.19.5's, which spreads `role: "heading"` and `aria-level` (2 by default) from its state class
  onto a `<div>`, so the outline there is level 2 then `<h3>`, with no skip. The ledger labels this class `fp`.
  Without this key the rule would have false positives from one app, C7 would judge no rule, and every deciding
  criterion would pass.
- **PokeFluxDash's three are `fp`.** `dashboard/inventory`, `party` and `shop` flag an `<h3>` inside
  `<Panel title={m…()}>`. `Panel.svelte` renders `<h2>` through a snippet under `{#if title}`, and each use passes
  a non-empty message, so the outline is `<h1>`, `<h2>`, `<h3>`. A scratch fixture reproduces it: the same
  component with the `{#if title}` removed reports no skip.

## Critical findings (C3)

33 critical findings. 32 are `title-presence`, all `tp` (Quantify 28 and Jieli 4). The other is
`handler-state-write` on Jieli's `[[lang=lang]]/+layout.ts:24`, `design`: `locale.set(lang)` writes a module store
as the rule says, but that layout group exports `prerender = true` on adapter-static, so the write runs only at
build time, with a language taken from the URL.

## False-positive classes

| Class                                                                                                | Findings | Apps | Rules                   |
| ---------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------- |
| A component's `<h2>` under `{#if title}` on a title passed as an expression, left out of the outline | 3        | 1    | heading-level-skip      |
| A method called on a prop typed with a qualified name (`day: Temporal.ZonedDateTime`)                | 3        | 1    | prop-mutation           |
| An ARIA heading rendered by bits-ui's `Dialog.Title` before an `<h3>`                                | 1        | 1    | heading-level-skip      |
| `<motion.h1>` from a motion library not read as an `<h1>`                                            | 1        | 1    | single-h1               |
| A top-level `{#snippet history()}` read as `window.history`                                          | 1        | 1    | instance-browser-global |
| `autofocus` in content a component renders into a `<dialog>`                                         | 1        | 1    | no-autofocus            |
| A lazy image reported as the route's first when a child component renders an eager image before it   | 1        | 1    | lcp-image               |

The second is infosections' three calendar-day components, where `day.add(…)` returns a new immutable value. The
fourth is the same app's `/`, whose `Hero` renders `<motion.h1>` from `@humanspeak/svelte-motion`, so "no `<h1>`"
is false. The fifth is calenha's `words/[slug]`, whose `body: history` passes the page's own snippet. The sixth is
posserver's `store/menu`, a limitation the rule's docs name. The seventh is Portfolio's `/collection`, where
`<Slab>` renders the eager image; the rule's docs say source analysis leaves out images rendered by a child
component, so this `fp` follows the ledger's child-component entries, and read by the docs alone it would be
`design`.

Two misreadings hide in keys not labelled `fp`, both on the side of silence: ace-blocker-site renders its JSON-LD
in `{#if isIndexablePage(…)}` and Portfolio in `{#if introducesPerson}`, and `json-ld` counts it as present on the
routes where that arm does not render.

## C2 in detail

GitHub Actions run 41795403726 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14 apps
installed. The plugin ran on 12 and crashed on none. Ten builds completed: impasto-viewer (42 prerendered routes
analyzed) and Portfolio (11), and Decaynet, kalypzo-atrium, Quantify, PokeFluxDash, posserver, infosections,
olhar-ai and veer with no prerendered page. Jieli's build stopped on the plugin's critical gate: the
`handler-state-write` finding above, which is `design`, after 8 prerendered routes were analyzed.
ace-blocker-site's stopped after the plugin ran, on a `$env/static/public` variable with no env file. nordicnews's
stopped before the plugin reported, when Kit's analysis imported a Supabase client with no URL, and calenha's on a
`uv` command the runner does not have.

## Labelling notes

- Routes that never render: Decaynet's `/logout`, kalypzo-atrium's `/` and `/admin/settings`, Portfolio's `/meet`,
  `/resume`, `/resume/docx` and `/pic`, and olhar-ai's `/faces` always redirect. None carries a finding.
- The design share is concentrated in `canonical-url` (176), `description-presence` (159) and `each-index-key`
  (124); veer, olhar-ai, kalypzo-atrium and PokeFluxDash together have 327 of the 637.
- kalypzo-atrium's `/p`, `/embed` and `/modules` load a module from `modules/`, which holds only a README in the
  checkout, so they throw 404 there. Deployments install modules through the panel, and the page body comes from
  code outside the checkout, so their `single-h1`, `description-presence` and `og:*`/`twitter:card` keys are
  `design` under the holdout 31 call on content outside the checkout, stretched from content known to exist to
  content that only might. `seo/json-ld` on the same routes stayed `tp`.
- Conventions the labellers applied but questioned:
  - `og:*` and `twitter:card` stay `tp` on signed-in and dev-only routes, while `canonical-url` on the same route is
    `design`.
  - Client redirect stubs on `single-h1` and `title-presence` are mostly `tp`, with some `design` in the ledger;
    this round followed the majority.
  - The line between `sequential-awaits` on a short-TTL cache (`tp`) and a warm one (`design`) turns on whether a
    cold request really occurs, not on the TTL; two kalypzo-atrium keys went `design` once the hook that fills the
    cache was traced.
  - Blob and data-URL previews on `image-dimensions` are mixed in the ledger; here they are `design` where the image
    appears after the user's own action.
  - `seo/ssr-disabled` says "whole app" on Jieli, whose marketing and legal pages set `ssr = true`; it stays `design`
    under its precedents, though the wording is false there.
  - PokeFluxDash's `<button tabindex=-1>` in a `role="button"` in an `aria-hidden`, `inert` chat mock is `design` for
    `interactive-nesting`, with no direct precedent.

## Next

Add these 14 apps to the tuning corpus. Measure the two `heading-level-skip` classes behind the C7 result: a reading of `{#if title}`
on a prop passed as an expression, and bits-ui's `Dialog.Title` as a level-2 ARIA heading, which the corpus
already labels `fp` in 7 other apps. The qualified type name and the top-level snippet are also
candidates, as misreadings the rules' docs already rule out. `handler-state-write` on a chain that exports
`prerender = true` is worth measuring too: it is `design`, but it stopped a build at the gate.
