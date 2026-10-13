# v1 holdout 33 — result (2026-10-13)

Measured with `main` at 6fe1b266 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-13-v1-holdout-33-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-33-2026-10-13.json`;
verdicts: `scripts/corpus/holdout-33-2026-10-13-verdicts.json` (3,393 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: C3 fails.** One critical finding is false: `seo/title-presence` on wildlife-permit-system's
`/`, a route its `hooks.server.ts` answers with a redirect before `resolve()` on every request, so the
page never renders. Every other deciding criterion passes: no crash in either mode, C4 at 99.5%, C5 at
99.7%, no false-positive class reaches two apps, the one rule C7 judges is at 95.2%, and no key is
`unclear`. Twelve keys are false positives in all, in three classes, each in one app. C8, published
without deciding the result, is 27.3%. The release decision stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                                        | Result   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | --------------------------------------------------------------- | -------- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                               | pass     | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 7 of which built                  | pass     | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 1 (wildlife-permit-system `/`, `title-presence`)                | fail     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.5% (1,296 / 1,303)                                           | pass     | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.7% (1,312 / 1,316)                                           | pass     | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                                            | pass     | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | `single-h1` at 95.2% (none below 90% by the earlier definition) | pass     | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 27.3% (515 / 1,884)                                             | reported | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                           | pass     | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                                   | pass     | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 2,673, fp 12, design 708, unclear 0.

C7 judges one rule. `single-h1` has false positives from three apps (wildlife-permit-system, sideout and
pikslots) and 66 findings, and is at 95.2% (59 / 62). By the earlier definition, no rule with ten or more
findings falls under 90%; the lowest is `description-presence` at 93.8% (15 / 16; 200 of its 216
findings are `design`).

## The false critical finding (C3)

wildlife-permit-system's `hooks.server.ts:24-30` returns a 302 for every request to `/`: to `/login`
without a session, to `/dashboard` with one. `resolve()` is never reached for that path, so
`src/routes/+page.svelte` (which only calls `goto('/dashboard')` in `onMount`) is never served, and the
`title-presence` claim on it is false. The same route carries nine other route-level keys, all `fp` for
the same reason. The analyzer does not read a `handle`'s early return for a path as a route that never
renders. The `title-presence` docs do not name that as a limit; the `canonical-url` and
`description-presence` docs say only that a sign-in gate in `hooks.server.ts` is not read for their
severity. The ledger has the same mechanism in holdout 21 (hundavaent's `/translations/*`) and holdout 27
(jump's `/parent` routes, through an imported guard); this is its first false critical finding (the
ledger's 407 earlier `title-presence` false positives include none from a hook). No call decides it: the
ledger labels every claim on a route a hook answers before `resolve()` as `fp`, as settled after holdout 21.

## Critical findings (C3)

67 critical findings, all `title-presence`: 65 tp (pikslots 41, vulnledger 23, wildlife-permit-system
`/logout`), 1 `design` (civora's `/composants`, which answers 404 outside `dev`) and 1 `fp` (above).

## False-positive classes

| Class                                                                                                                                                                       | Findings | Apps | Rules                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------------------------------------ |
| A route `hooks.server.ts` answers with a redirect before `resolve()` on every request, read as rendering                                                                    | 10       | 1    | **title-presence**, description-presence, canonical-url, json-ld, og-\*, twitter-card, single-h1 |
| An `<h1>` in committed HTML a page fetches and renders with `{@html}`, on a route that is never server-rendered                                                             | 1        | 1    | single-h1                                                                                        |
| Sibling `{#if}` blocks whose tests contradict (`{#if linkExpired}` against `{#if !linkExpired && step === 1}`, `step === 1` against `step === 'success'`), counted together | 1        | 1    | single-h1                                                                                        |

The first class has ledger precedents in holdouts 21 and 27, and the second in holdouts 21, 24 and 32
(markdown there, HTML here). The third contradicts the `single-h1` docs, which read sibling blocks whose
conditions contradict on one value, also as one condition of an `&&`, as arms of one block; a reduced
copy of pikslots' `user-invite.svelte` run through the CLI at 6fe1b266 reports the same "Multiple `<h1>`
(3)". The three classes reach different mechanisms, and none is in two apps, so C6 passes however they are
grouped.

## C2 in detail

GitHub Actions run 38336865099 (harness in `scripts/holdout-build/`). All 14 apps installed. The plugin
ran on 11 apps and crashed on none. Seven builds completed: kalharam (15 prerendered routes analyzed),
and vulnledger, apidown, cairnops, War-Brokers, sideout and gardensuite-marketing with no prerendered
page. After the plugin ran, opensax's build could not resolve the entry of its workspace package
`@lernsax/core`, pikslots' could not resolve the workspace import `@pikslots/shared`, and ironkit's and
soju-platform's stopped on `$env/static/public` variables not set. Before the plugin ran,
BibleTogether's `vite-plugin-pwa` could not read the service worker it expects, wildlife-permit-system's
build stopped on `DATABASE_URL` not set, and civora's Vercel adapter refuses Node 24.

## Labelling notes

- Routes that never render: only wildlife-permit-system's `/` carries route-level findings. The routes
  that always redirect in their own module (sideout's `/`, kalharam's `[...catchall]`, soju-platform's
  `/education/flashcards` and `/education/verbs`) carry none; the other hooks and layout loads redirect
  or fail on a condition (a session, a host, a permission).
- The design share is concentrated in `description-presence` (200), `canonical-url` (194) and `each-key`
  (93); pikslots, opensax, civora and vulnledger together have 281 of the 515.
- ironkit's 23 `prop-mutation` keys are `design`: `prop.$jazz.set(…)` and `prop.x.$jazz.push(…)` on Jazz
  CoValue props are that library's own reactive API, one member below the typed prop that the holdout-32
  exemption reads.
- Conventions the labellers applied but questioned:
  - `og:*` and `twitter:*` presence stay `tp` on routes behind a sign-in, where `canonical-url` and
    `description-presence` are `design`.
  - The leftover `/demo/playwright` page of the `sv create` starter is `tp` in most ledger entries and
    `design` in two; pikslots' is labelled by the majority.
  - Read-only sub-lists of a runtime record (`each-key`) are `tp` in most ledger entries and `design` in
    about 130.
  - A `security/raw-html` site that renders only the signed-in user's own text is `design`; ironkit is the
    first synced web app labelled so.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
