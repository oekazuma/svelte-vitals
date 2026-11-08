# v1 holdout 49 — result (2026-11-08)

Measured with the holdout branch at f0a6baad (`main` at 41aa9623 plus the selection doc) on the 14 apps pinned in
`scripts/corpus/holdout.json` (chosen in `2026-11-08-v1-holdout-49-selection.md` before any run), and judged
against `2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 of the 14 installed. Raw first look: `scripts/corpus/holdout-49-2026-11-08.json`; verdicts:
`scripts/corpus/holdout-49-2026-11-08-verdicts.json` (2,483 distinct keys from 14 apps, every one labelled by
checks over the source at the pinned commit).

**Result: every deciding criterion passes.** One key in the holdout is a false positive: `seo/single-h1` on one
route of one app, which leaves the rule at 97.7% (43 / 44). There is no false critical finding, C4 is 99.90%, C5 is
100.0%, no fp class is shared by two apps, and no key is `unclear`. C8, published without deciding the result, is
29.2%. The release decision stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H48    | H47    | H46    | H45    | H44    | H43    | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass   | pass   | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 13 apps, 10 of which built | pass     | pass   | pass   | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0      | 0      | 0      | 0      | 0      | 0      | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.90% (952 / 953)                              | pass     | 99.60% | 99.55% | 99.38% | 99.85% | 99.09% | 99.69% | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 100.0% (1,040 / 1,040)                          | pass     | 99.87% | 99.87% | 99.73% | 99.78% | 99.73% | 99.4%  | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | 1      | none   | none   | none   | none   | none   | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below 90% (none by the earlier one)        | pass     | 1      | none   | 1      | none   | none   | none   | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 29.2% (394 / 1,351)                             | reported | 43.0%  | 32.6%  | 35.5%  | 36.5%  | 38.1%  | 35.0%  | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass   | pass   | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80     | 80     | 80     | 80     | 80     | 80     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one). The C4, C5 and C8 history columns group findings by the severity each finding was
reported with, not by the rule's default severity; this holdout's column uses the default severity.

Verdicts (distinct keys): tp 1,996, fp 1, design 486, unclear 0.

No rule has false positives from two or more apps, so C7 judges none. By the earlier definition no rule falls
under 90% either: `seo/single-h1`, the only rule with a false positive, is at 97.7%.

## What the result rests on

- **The one false positive.** ulysses' `/[page_id]` renders `<ContentComponent />`, a `$derived` lookup into an
  eager `import.meta.glob('/src/lib/content/**/*.md')` keyed by locale and `data.pageId`. Its `load` allows
  `offer`, `privacy` and `contacts`; the first two open with `# ` in both locales, `contacts` with `##`. The key is
  labelled by that majority. The glob lives in the page itself, not in its `load`, so the load-data skip does not
  reach it; it is the glob-picked markdown shape the ledger already labels `fp`, seen in one app.
- **Heading rules carry no other false positive.** `seo/single-h1` has 46 keys (43 `tp`, 2 `design`, 1 `fp`) and
  `seo/heading-level-skip` 19 (all `tp`).

## Critical findings (C3)

5 critical findings, all `title-presence`, none `fp`. ulysses' `/[page_id]`, `/account/[uuid]`, `/admin` and
`/pricing` are `tp`: no page, layout, mdsvex content or `app.html` renders a `<title>`, and nothing writes
`document.title`. cw-zro's `/` is `design`: the app is `ssr = false`, and `/` is a 2.5 s splash whose `onMount`
replaces it with `/scope-view`, which has its own `<title>` (the ledger's redirect-shim shape).

## False-positive classes

| Class                                                                                                          | Findings | Apps | Rules     |
| -------------------------------------------------------------------------------------------------------------- | -------- | ---- | --------- |
| An `<h1>` in a markdown module a page picks from its own `import.meta.glob` map and renders as `<Component />` | 1        | 1    | single-h1 |

## C2 in detail

GitHub Actions run 42470740679 (harness in `scripts/holdout-build/`; no stage ran into its limit). Seven jobs
first failed in `setup-bun`, on HTTP 504s from GitHub's release assets while it downloaded Bun, before any app
step ran; the failed jobs were rerun until the download succeeded, which took mathieujahnich's five attempts. 13
apps installed; cooking-app's install stopped on a native `canvas` build, so its first look ran uninstalled and
the plugin did not run. The plugin ran on the other 13 and crashed on none. Ten builds completed: better-music
(0 prerendered routes analyzed, 10 skipped with `ssr = false`), and yondrive, Mitteiru, quickmail2,
svelte_portfolio, SE-Quiz, bookkeeper, recipe-manager, cw-zro and ulysses with no prerendered page. Blooming's
and mathieujahnich's stopped after the plugin ran, on a `$env/static/public` variable the checkout does not
define (the selection doc expected both to fail on `$env/static` imports), and stellar-8004's on a workspace package, `@trionlabs/stellar8004`,
whose entry is not built before the app.

## Labelling notes

- Routes that never render: quickmail2's `/`, mathieujahnich's `/qui-sommes-nous` and SE-Quiz's
  `/[[lang=locale]]/host` always redirect. None carries a route-level finding.
- The design share is concentrated in `description-presence` (114), `canonical-url` (106), `each-key` (50) and
  `image-dimensions` (35); yondrive, quickmail2, Blooming and cw-zro together have 171 of the 394.
- Blooming is a Tauri app; its keys follow the ledger's Tauri apps (`canonical-url` and `og:*` `tp`,
  `description-presence`, `robots-txt` and `sitemap-xml` `design`).
- ulysses' `/junglebook` pages load their chapters through a lazy `import.meta.glob` inside `{#await}`, so the
  server HTML carries only the loading state; their headings are read as client-only, which is absent on a
  server-rendered route.
- Conventions the labellers applied but questioned:
  - `og:*` and `twitter:card` stay `tp` on signed-in, noindex and first-run routes, while `canonical-url` on the
    same route is `design`.
  - `instance-browser-global` reports `navigator`, which Node has had as a global since version 21. cooking-app's
    `$state(navigator.onLine)` on its server-rendered `/offline` is `tp`, as the ledger's one `navigator.userAgent`
    entry is, but on Node 21 or later it reads `undefined` rather than throwing.
  - `route-component-import` says the imported route component renders without its data, which is false for
    SE-Quiz's `/login`: it re-exports the imported route's `load` and `actions`. The key is `design`, as the
    ledger has such wrappers.
  - ulysses' `/admin/api/system` POST stores the request body in a module `let` that only a log reads; it is
    `design` for `server-module-state`, where the ledger's `tp` entries all serve that state to other requests.
  - `json-ld` is `tp` on signed-in and desktop-only routes, which decides 212 keys.
  - `each-key` and `each-index-key` over a user-filtered constant list (toggled columns, a searched catalog) are
    `design`, though rows enter and leave mid-list.
  - `image-loading-hint` on `data:` and `blob:` URLs is `design`, which the rule's docs do not name.

## Next

Add these 14 apps to the tuning corpus. The glob-picked markdown `<Component />` is a single-app class. The
`navigator` entry of `instance-browser-global` is a question for the rule rather than for this holdout: whether a
name Node defines since version 21 belongs in a list the design scoped to names Node lacks.
