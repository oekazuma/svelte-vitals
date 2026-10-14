# v1 holdout 34 — result (2026-10-14)

Measured with `main` at 3aaf385d on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-14-v1-holdout-34-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-34-2026-10-14.json`;
verdicts: `scripts/corpus/holdout-34-2026-10-14-verdicts.json` (5,232 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 and
C5 at 99.9%, no false-positive class reaches two apps, no rule is judged under C7, and no key is
`unclear`. Four keys are false positives in all, in three classes, each in one app. C8, published
without deciding the result, is 30.4%. The release decision stays with the owner, as the criteria say.
No call the result rests on would fail a criterion taken the other way: every critical finding is `tp`,
and no false-positive class could join another app's.

| #   | Criterion                          | Threshold      | Measured                                               | Result   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ------------------------------------------------------ | -------- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                      | pass     | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 13 apps, 8 of which built         | pass     | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                                      | pass     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.9% (1,910 / 1,912)                                  | pass     | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (2,071 / 2,073)                                  | pass     | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                                   | pass     | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (none below 90% by the earlier definition) | pass     | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 30.4% (901 / 2,964)                                    | reported | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                  | pass     | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                          | pass     | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 4,132, fp 4, design 1,096, unclear 0.

C7 judges no rule: no rule has false positives from two apps. By the earlier definition, no rule with ten
or more findings falls under 90%; `id-duplication` is at 66.7% (2 / 3) over nine findings and
`preconnect` at 0% over two.

## Critical findings (C3)

151 critical findings, all `title-presence` and all `tp`: awsim 61, CSTGRP_ERP 61, lab-wizard 16, soc-dev
12 and iris-web-utmn 1. lab-wizard runs in a desktop webview; the ledger labels a desktop app's main
routes `tp` where sibling routes set a title, as here (`/live`), and a host-titled secondary window
`design`. Under `design` its 16 keys would leave C3 at 0 all the same.

## False-positive classes

| Class                                                                                                                            | Findings | Apps | Rules          |
| -------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------- |
| `<link rel="dns-prefetch preconnect">`, a valid preconnect, not read as one because `rel` is compared whole, not as a token list | 2        | 1    | preconnect     |
| An `{#if prop.length > 0}` on a prop that defaults to `[]`, counted on uses that omit it                                         | 1        | 1    | id-duplication |
| An `<h1>` in a component a page picks from a list (`<item.component>`), not followed                                             | 1        | 1    | single-h1      |

The first contradicts HTML, where `rel` is a set of space-separated tokens; `canonical-url`, `preload`
and the other rules that read `rel` compare it the same way. The second is a gap in the documented
prop-decided reading, which takes a use that omits a prop at its default but leaves `.length` of an array
default undecided. The third is a limit the `single-h1` docs name ("a component picked from data or a
lookup table at runtime"). They reach different mechanisms in different apps.

## C2 in detail

GitHub Actions run 38516882077 (harness in `scripts/holdout-build/`). All 14 apps installed. The plugin
ran on 13 apps and crashed on none. Eight builds completed: harpa-crista-online (1,459 prerendered
routes analyzed), gjms-frontend (407 analyzed), CSTGRP_ERP (61 skipped as `ssr = false`), and kipuspay,
awsim, sackli, schwingen and iris-web-utmn with no prerendered page. After the plugin ran, lab-wizard's
build stopped on the plugin's own gate (its default `failOn` met a critical `title-presence` on the
prerendered `/servers/hardware`), and soc-dev's, clanqr's, openplays' and flashsoft-sk's on
`$env/static` variables not set. Before the plugin ran, receiverproxy's build script runs `svelte-check`
first, which rejects the harness's wrapper `vite.config.ts` (an implicit `any` and a call on `never`).

## Labelling notes

- No route a route-level finding is on never renders. receiverproxy's `/gallery` and `/gallery/[name]`
  always redirect and carry no route-level finding; the other hooks and loads redirect or fail on a
  condition (a session, a host, a path prefix, a failed request).
- The design share is concentrated in `description-presence` (376), `canonical-url` (242) and
  `title-length` (138); iris-web-utmn, soc-dev, CSTGRP_ERP and awsim together have 645 of the 901.
- Calls the labellers made and flagged:
  - awsim's and lab-wizard's canonical keys are `tp`, as the ledger labels a local emulator's console
    (gopherstack); kipuspay's POS routes are `tp`, with no server or layout gate in the source.
  - openplays' layout-wide `<title>OpenPlays</title>` is `tp` for `title-length` and `duplicate-title`
    although most of its 19 routes are behind a sign-in, as the ledger labels a layout title shared with
    public pages.
  - harpa-crista-online's `/admin/curadoria` landmarks are `design` by the dev-only convention, applied to
    a template gate on `import.meta.env.DEV`.
- Conventions the labellers applied but questioned:
  - `og:*` and `twitter:*` presence stay `tp` on routes behind a sign-in, where `canonical-url` and
    `description-presence` are `design`; `json-ld` stays `tp` on local tools.
  - Read-only sub-lists of one record (`each-key`) are `design` here; the ledger is split on that shape.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
