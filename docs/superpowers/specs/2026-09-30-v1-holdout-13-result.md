# v1 holdout 13 — result (2026-09-30)

Measured with `main` at 7b5521bf on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-30-v1-holdout-13-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: 13 of 14 installed; tilloh.dev
declares a private submodule the runner could not fetch and was measured uninstalled. Raw first look:
`scripts/corpus/holdout-13-2026-09-30.json`; verdicts: `scripts/corpus/holdout-13-2026-09-30-verdicts.json`
(9,923 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of ten criteria fail: C7 and C8. C3 passes again with no false critical
finding (296 tp), C6 passes with no false-positive class shared by two apps, and C4 (99.2%) and C5
(99.9%) pass.

| #   | Criterion                          | Threshold      | Measured                                       | Result | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass   | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 10 apps, 8 of which built | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass   | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.2% (3,619 / 3,647)                          | pass   | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.9% (3,633 / 3,636)                          | pass   | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass   | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 1 rule below                                   | fail   | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 35.0% (2,120 / 6,063)                          | fail   | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass   | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 7,548, fp 31, design 2,344, unclear 0.

C7's rule: `a11y/id-duplication` 58.3% (7 / 12, 68 findings, 56 of them design).

## Critical findings (C3)

296 `title-presence`, the only critical findings, all tp: xavyo-web 240 (the whole app renders no
`<title>`; its only `<svelte:head>` holds a favicon), intuitive 30 (its `Meta` component is commented
out or skipped by `+page@` resets on these routes), wohnraum 24, marketing-offers-tool 1 and
cms.utcode.net 1. Every key was decided on its route's full render chain.

## False-positive classes

| Class                                                                                                                  | Findings | Apps | Rules                 |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | ---- | --------------------- |
| An imported `as const` list its module only passes to `z.enum(…)` loses its exemption (the docs require no write)      | 21       | 1    | each-key              |
| A layout rendering its children in two `{#if}` arms chosen by the URL: the page is not placed in the arm it renders in | 5        | 1    | **id-duplication**    |
| A parent's `use:dndzone` sets `role="listitem"` on its children                                                        | 2        | 1    | disallowed-aria-props |
| A `$state` passed to a call inside an expression (`JSON.stringify(x ?? {})`) not read as escaping                      | 1        | 1    | unmutated-state       |
| A prop-decided `{#if}` whose prop is passed as a local that is never reassigned                                        | 1        | 1    | single-h1             |
| An `{#each}` read as possibly empty though the flagged heading only renders once it has items                          | 1        | 1    | heading-level-skip    |

No class appears in two holdout apps. The two-arm children class recurs from the tuning corpus (epj),
and the `$state`-in-an-expression class from holdout 12 (obot).

## C2 in detail

GitHub Actions run 36699769265 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 10 apps and crashed on none. Eight builds completed; spelwijsheid prerenders 8 routes and
the plugin skipped its one `ssr = false` route. The others failed on their own: `$env/static`
variables not set (One-Learn-Platform, intuitive); and, before the plugin ran, a missing system font
(AlexBocken), an unset `DATABASE_URL` (wohnraum), prerendering against an unreachable CMS
(LausanneTourisme) and tilloh.dev's failed submodule fetch.

## Labelling notes

- The design share is concentrated in `canonical-url` (627), `description-presence` (582), `raw-html`
  (445: repository i18n messages and sanitized HTML) and `each-key` (197); xavyo-web,
  LausanneTourisme, medora and plexams.gui together have 1,345 of the 2,120.
- Conventions the labellers applied but questioned: og/twitter as `tp` on sign-in-only routes where
  `canonical-url` and `description-presence` are `design`; `json-ld` as `tp` on the same routes; a
  Tauri shell's canonical as `tp` where an Electron shell was `design`; where a login page stops being
  a search target (public SaaS vs internal tool); and the `sequential-awaits` split between a 404
  existence gate (`tp`) and an auth gate (`design`).
- Analyzer gaps that did not change a verdict: a `<meta name={expr}>` is read as a possible
  `twitter:card` (tilloh.dev passes on all 15 routes with none); an `app.html` `<title>` placed before
  `%sveltekit.head%` is not composed with the page's; `{@attach}` is not treated as unknowable the way
  `use:` is; and the `permitted-contents` message for a `<label>` inside a `<label>` names the wrong
  content model.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. C8 has failed in ten of thirteen
holdouts on findings reported as documented; claiming it needs a decision on those rules' scope, not
more false-positive fixes. Claiming the criteria needs a fourteenth holdout.
