# v1 holdout 32 — result (2026-10-12)

Measured with `main` at 22d84fd2 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-12-v1-holdout-32-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-32-2026-10-12.json`;
verdicts: `scripts/corpus/holdout-32-2026-10-12-verdicts.json` (4,287 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4
at 99.7%, C5 at 99.9%, no false-positive class reaches two apps, the one rule C7 judges is at 92.7%, and
no key is `unclear`. Six keys are false positives in all, in five classes, each in one app. C8,
published without deciding the result, is 26.8%. The release decision stays with the owner, as the
criteria say. The result rests on one call set out first under "What the result rests on": taken the
other way, it fails C6.

| #   | Criterion                          | Threshold      | Measured                                                     | Result   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ------------------------------------------------------------ | -------- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                            | pass     | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 9 of which built               | pass     | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                                            | pass     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.7% (1,664 / 1,669)                                        | pass     | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (1,632 / 1,633)                                        | pass     | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                                         | pass     | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | `single-h1` at 92.7% (1 below 90% by the earlier definition) | pass     | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 26.8% (644 / 2,399)                                          | reported | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                        | pass     | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                                | pass     | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,382, fp 6, design 899, unclear 0.

C7 judges one rule. `single-h1` has false positives from three apps (dockhand, intl-explorer and sso)
and 46 findings, and is at 92.7% (38 / 41). By the earlier definition, one rule with ten or more
findings falls under 90%, from one app: `id-duplication` at 83.3% (10 / 12, empi).

## What the result rests on

- **sso's and dockhand's `single-h1` classes are kept apart.** Both are an `<h1>` the route renders
  that is not Svelte markup in its source, but they reach it differently. sso's `/docs/[slug]` renders
  `{@html data.html}`, which its `+page.server.ts` produces by parsing a committed markdown file that
  opens with `# `; holdouts 21 and 24 had the same shape. dockhand's `/api/docs/ui` loads a vendored
  browser bundle (`static/scalar/standalone.js`) in `onMount`, and the bundle draws the API title as
  an `<h1>` on a route that is never server-rendered. The rule docs name neither: they name a component
  that cannot be followed or is picked at runtime. One is HTML a server module builds from a file, the
  other a third-party script the app runs in the browser, which the ledger has kept apart as different
  limits (holdouts 26, 28, 29 and 31). Counted as one class, **C6 fails**.

## Critical findings (C3)

87 critical findings, all `title-presence`: 86 tp (resolute-society 54, SunReye 30, FabDoYouMeme 1,
splitclone 1) and 1 `design`, sso's `/oauth-test`, a developer test page nothing links to.

## False-positive classes

| Class                                                                                                                             | Findings | Apps | Rules          |
| --------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------- |
| `{#if FLAG && …}` with `FLAG` an imported binding the app exports as the literal `false`, left undecided                          | 2        | 1    | id-duplication |
| A prop holding an object of functions whose `add()` only sends a request, read as a mutation of the prop                          | 1        | 1    | prop-mutation  |
| `{@html}` of committed markdown that opens with `# `                                                                              | 1        | 1    | single-h1      |
| A vendored browser bundle that draws an `<h1>` on a route that is never server-rendered                                           | 1        | 1    | single-h1      |
| A layout `{#if}` on a `$derived` of `page.route.id?.replace("/", "")` against a literal, left undecided, counting a second `<h1>` | 1        | 1    | single-h1      |

The second and third classes have ledger precedents of the same shape (holdouts 30 and 31; 21 and 24).

## C2 in detail

GitHub Actions run 38185824295 (harness in `scripts/holdout-build/`). All 14 apps installed. The plugin
ran on 12 apps and crashed on none. Nine builds completed: hackathon (20 prerendered routes analyzed),
mesh-organiser (18 skipped as `ssr = false`), SunReye (1 skipped under the hash router), and sso,
FabDoYouMeme, splitclone, resolute-society, intl-explorer and thailand-dems with no prerendered page.
After the plugin ran, empi's build stopped on its environment schema (API endpoint variables not set),
capgo-update-lite's on a `$env/static` variable not set, and plavna's on a workspace subpath export it
could not resolve. Before the plugin ran, dockhand's and vcsi-website's builds aborted (exit 134) in the
native destructor of the apps' own `better-sqlite3` dependency during teardown.

## Labelling notes

- No route a route-level finding is on never renders. The layouts that redirect or fail do so on a
  condition (FabDoYouMeme's `(app)` layout without a user, its rooms layout on a failed fetch, empi's
  `+page.ts` files on a failed response), not on every path.
- hackathon commits its own `svelte-vitals.config.js`, which turns off every rule outside Correctness,
  Security and Accessibility. The measurement drops each app's config by design, so its 327 findings
  (299 SEO, 19 Performance, 9 Architecture) are the default run's and are labelled as such: the
  public pages `tp`, the voting area, its admin and the sign-in and token pages mostly `design`. Its CI
  (`ci/build.sh`) already runs svelte-vitals and fails a branch on a new finding in those three
  categories, measured against the merge base; the first look has none in them, and the source has no
  inline suppression.
- dockhand's `/api/docs/ui` and `/backups` exist only with a feature flag set (its hooks answer 404
  otherwise); they are labelled as the routes render with the flag on. Its `sequential-awaits` in the
  root `+layout.server.ts` is `design`: the first await decides whether sign-in is on, and a fresh install has it off.
- The design share is concentrated in `each-key` (300), `description-presence` (134) and
  `canonical-url` (87); dockhand, SunReye, sso and vcsi-website together have 387 of the 644.
- Keys labelled by their majority with some routes differing: empi's and thailand-dems'
  `duplicate-title` and `title-length` keys, and thailand-dems' `duplicate-description` key, are `tp`.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
