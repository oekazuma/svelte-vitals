# v1 holdout 37 — result (2026-10-17)

Measured with `main` at 3f7634a7 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-17-v1-holdout-37-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-37-2026-10-17.json`;
verdicts: `scripts/corpus/holdout-37-2026-10-17-verdicts.json` (3,834 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes, on all 14 apps and on the 12 that are not copies of corpus
apps.** Two picks turned out to be copies of apps already in the tuning corpus (see "Two picks are corpus
copies"), so they are not held out; the result is reported both ways, and both ways pass. No crash in
either mode, no false critical finding, C4 at 99.6% (99.4% on 12 apps), C5 at 99.6% (99.5%), no
false-positive class reaches two apps, no rule is judged under C7, and no key is `unclear`. C8, published
without deciding the result, is 33.5%. The release decision stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured (14 apps)                              | 12 apps               | Result   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | --------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | 0                     | pass     | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 14 apps, 10 of which built | 0; ran on 12, 8 built | pass     | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | 0                     | pass     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.6% (1,341 / 1,347)                           | 99.4% (1,005 / 1,011) | pass     | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.6% (1,608 / 1,614)                           | 99.5% (1,210 / 1,216) | pass     | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | none                  | pass     | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (none below 90% by the earlier one) | none judged           | pass     | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 33.5% (683 / 2,039)                             | 33.6% (515 / 1,535)   | reported | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | 0 / 0                 | pass     | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | 80                    | pass     | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 2,958, fp 12, design 864, unclear 0. On the 12 apps: tp 2,224, fp 12, design 614.

C7 judges no rule: every false positive comes from one app. By the earlier definition, no rule with ten
or more findings falls under 90%; `heading-level-skip` is at 88.9% on 9 findings.

## Two picks are corpus copies

athuridha/eraport is the same codebase as sira313/rapkumer, and averagechris/hister is a fork of
asciimoo/hister; both originals are in the tuning corpus. Neither is a GitHub fork, and neither shares a
package name or description with its original, which is all the selection's copy check compared. Their
`src` trees show it: 402 of eraport's 508 Svelte, TypeScript and JavaScript files are byte-identical to
rapkumer's, and 27 of hister's 28 sit at the same paths as asciimoo/hister's (7 identical). The labellers
found it while carrying the originals' ledger verdicts over and checked each carried shape at the new
commit. Neither app has a false positive, so leaving them out moves only the precision denominators, as
the table shows. The next selection compares each candidate's source files with the corpus clones as
well.

## Critical findings (C3)

11 critical findings: 10 `title-presence`, 9 tp (nautilus-website's 8 routes outside its `(home)` group
and feeds' `/users`) and 1 `design` (slide-maker's `/debug/streams`, a client-side redirect shim); and 1
`server-browser-global`, `design` (a module-scope `localStorage` read in Kennisbank, an app that sets
`ssr = false` at its root).

## False-positive classes

| Class                                                                                                                                                    | Findings | Apps | Rules                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------------------------------ |
| A page whose `load` returns only `if (building)` and redirects on every request, on a route that is not prerendered, read as rendering                   | 10       | 1    | canonical-url, description-presence, json-ld, og-\*, single-h1, title-length, twitter-card |
| A heading a bits-ui `Dialog.Title` renders as `<div>` with `role="heading"` and `aria-level` from a spread, not seen, so the next `<h3>` reads as a skip | 1        | 1    | heading-level-skip                                                                         |
| An await reached only after an `if (…) { …; return }` on an earlier await's result, read as independent of it                                            | 1        | 1    | sequential-awaits                                                                          |

The first class is tomimi-dev's `/` (`src/routes/+page.server.ts`): `building` is false on every request,
and `/` has no `prerender` export and is not in `kit.prerender.entries`, so the route never renders; the
build-mode report's 1,344 prerendered routes do not include it.
The heading class has a ledger precedent (shadcn's `CardTitle`), and so does the guarded-await class.

## C2 in detail

GitHub Actions run 38983866121 (harness in `scripts/holdout-build/`). The first run, 38980860221,
completed 13 apps; eraport's job hit the 30-minute job limit with no output, ending with a `pnpm`
process still running, because the harness gave the install no deadline of its own. The rerun gave the
install and its retries one 15-minute deadline (an app over it is measured uninstalled) and the job 45
minutes; all 14 apps were rerun together, and every one installed. The clone, submodule and
linked-package steps have since gained limits of their own and the job 90 minutes, so a run always
records a result; that version has not run yet. The plugin ran on all
14 and crashed on none. Ten builds completed: tomimi-dev (1,344 prerendered routes analyzed), pantheon
(11 analyzed), and Advanced-Digital-Marketing-LTDA, slide-maker, runaround, eraport, hister, netdisk,
mwmbl and skylark with no prerendered page. nautilus-website (72 analyzed) and Kennisbank were stopped by
the plugin's own gate on their critical findings, as the plugin documents. After the plugin ran, feeds'
build stopped on a workspace package that is not built before the app, and weaver's on `$env/static`
variables not set.

## Labelling notes

- The only route a route-level finding is on that never renders is tomimi-dev's `/`. The other routes
  that always redirect (eraport's `/rapor/[...rest]`) carry none; every other redirect and error in the
  hooks and loads depends on the session, the data or the request.
- The design share is concentrated in `each-key` (268), `description-presence` (156) and `canonical-url`
  (135); tomimi-dev, eraport, netdisk and Kennisbank together have 488 of the 683.
- nautilus-website's `/` writes its canonical as `<link rel="“canonical”">` with typographic quotes, so
  `canonical-url` is right that it has none; its imported empty `description` constant produces an empty
  `og:description` the analyzer does not report (a missed finding, not a label).
- Conventions the labellers applied but questioned:
  - `og:*`, `twitter:*` and `json-ld` presence stay `tp` on routes behind a sign-in, where `canonical-url`
    and `description-presence` are `design`.
  - `<label aria-label>` is `design` for `disallowed-aria-props`, though the rule's docs prohibit a name on
    `<label>` only where it is exposed as generic.
  - A `let` holding an array literal that is never reassigned is `design` for `each-key`, not exempt like a
    `const`; 69 keys rest on it.
  - A store's `.set()` called on a prop is `design` for `prop-mutation`.
  - Client redirect stubs are `tp` for `single-h1` in most ledger entries and `design` in others.
  - eraport's toast `{@html}` is `tp` here (callers pass other users' text into it) where rapkumer's is
    `design`; hister's preview `{@html}` is `tp` here because the fork's server no longer escapes it.

## Next

Fix the classes above where they are fixable, add the 12 apps that are not copies to the tuning corpus,
and compare candidates' source files with the corpus in the next selection.
