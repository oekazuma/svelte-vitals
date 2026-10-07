# v1 holdout 26 — result (2026-10-07)

Measured with `main` at 809549e8 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-07-v1-holdout-26-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-26-2026-10-07.json`;
verdicts: `scripts/corpus/holdout-26-2026-10-07-verdicts.json` (4,117 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** Two of the nine deciding criteria fail. C2 fails on one plugin crash: duders-zone's
build completed, but the plugin's analysis stopped on "Maximum call stack size exceeded" and wrote no
report. C3 fails on one false critical finding in ami, whose `svelte.config.js` sets
`kit.router.type: 'hash'`, which turns server rendering off for the whole app; the analyzer reads only `ssr`
exports, so a `load` reading `window` is reported as running during SSR. C4 (99.2%) and C5 (99.6%) pass,
no false-positive class spans two apps, C7 judges no rule, and no key is `unclear`. C8,
published without deciding the result, is 26.7%.

| #   | Criterion                          | Threshold      | Measured                                                      | Result   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ------------------------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                                             | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 1 (duders-zone); the plugin ran on 14 apps, 13 of which built | fail     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 1 (`correctness/server-browser-global`, 1 app)                | fail     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.2% (1,645 / 1,658)                                         | pass     | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.6% (1,554 / 1,560)                                         | pass     | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                                          | pass     | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (1 by the earlier definition)                      | pass     | 2     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 26.7% (619 / 2,320)                                           | reported | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                         | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                                 | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 3,241, fp 20, design 856, unclear 0.

No rule's false positives come from two apps, so C7 judges none. The earlier definition fails
`seo/description-presence` at 75.0% (3 / 4; 190 of its 194 findings are `design`, and the false one is
lemke-bank's `/wallet`). `seo/single-h1` (93.6%, lemke-bank) and `correctness/unmutated-state` (92.3%,
hoshi) are above the threshold.

## Critical findings (C3)

47 critical findings: 46 `title-presence` and 1 `server-browser-global`. Of the `title-presence`
findings, 42 are tp (eDNA-SampleTown 41, kitchenbrain's `/login`) and 4 are `design`: tarkana's three
`/demo` routes (the unlinked `sv create` scaffold, and a page that throws 404 outside `dev`) and hoshi's
`/ide`, a window of a Tauri desktop app.

The false one is ami's `src/routes/+page.ts:12`, a `load` that reads `window?.location`. ami is a
mobile app's web view built with adapter-static and `router: { type: 'hash' }`; with the hash router,
SvelteKit disables server rendering and prerendering for the whole app (its `KitConfig` docs say so for
the pinned 2.70.2). The analyzer decides that a route never renders on the server only from `ssr`
exports. It was ami's only critical finding, and the plugin's own gate stopped its build on it.

## False-positive classes

| Class                                                                                                                                                      | Findings | Apps | Rules                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ----------------------------------------------------------------------------- |
| An app with `kit.router.type: 'hash'`, not read as rendering only in the browser                                                                           | 6        | 1    | **server-browser-global**, instance-browser-global, shared-state-import       |
| Step snippets passed as an array prop of which a component renders one at a time (`steps={[a, b]}`, `{@render steps[currentStep]()}`), each with an `<h1>` | 2        | 1    | single-h1                                                                     |
| A layout `<main>` behind `{#if data.user}`, false on `/login` because the login page's `load` redirects any signed-in user                                 | 2        | 1    | duplicate-landmark, top-level-landmark                                        |
| A page whose component script throws `redirect()` unconditionally, not read as never rendering                                                             | 9        | 1    | single-h1, description-presence, canonical-url, json-ld, og and twitter rules |
| A `$state` object passed to a function as a value of an object-literal argument (`update({ …, extensions: extConfig })`)                                   | 1        | 1    | unmutated-state                                                               |

Each class is in one app, so C6 passes. Two reach a limit an earlier holdout also reached, in a different
app: kitchenbrain's `<main>` is decided by a field of the root layout's `load` data, as holdout 25's
cashflow `<h1>` was, and hoshi's `$state` is the object-literal argument the ledger already records.
The two new limits are different ones. lemke-bank's `/wallet` never renders: its component script throws
`redirect()` before any markup, a mechanism the docs' list of never-rendering routes (a `load`, a hook, a
factory) does not include, so every route-level claim on it is false. ami's routes do render, in the
browser; what the analyzer misses is that server rendering is off, which it reads only from `ssr`
exports. Its route-level SEO claims hold, and only the claims that code runs during SSR are false.

## C2 in detail

GitHub Actions run 37594713023 (harness in `scripts/holdout-build/`). The plugin ran on all 14 apps
and wrote its report on 13. On duders-zone it caught "Maximum call stack size exceeded" from its own
analysis, logged "svelte-vitals: skipped — analysis failed", and let the build finish without a report.
The run keeps no stack, and third-party apps are not built locally, so the page that triggered it is not
identified. The plugin's HTML parsing throws the same error on a synthetic page nested a few thousand
elements deep, in the recursive element queries of `node-html-parser`; whether duders-zone hit that path
is not confirmed. Thirteen builds completed:
brdsa (41 prerendered routes analyzed), caelyreth/site (10), duders-zone (the crash), and tarkana,
eDNA-SampleTown, decent-cloud, kitchenbrain, funmary, reg_allgemein, hoshi, trailer, lemke-bank and
greenmods with no prerendered page. After the plugin ran, ami's build (1 prerendered route analyzed) was
stopped by the plugin's own gate on its critical finding, the false one above.

## Labelling notes

- The design share is concentrated in `canonical-url` (232), `description-presence` (190) and
  `each-key` (126); eDNA-SampleTown, ami, lemke-bank and hoshi together have 367 of the 619.
- Judgement calls the labellers flagged:
  - lemke-bank's `/account/login` and `/account/signup` are `design` for `title-length` (a classroom
    banking app whose content is all gated), against the ledger's lean toward `tp` for login pages.
  - decent-cloud's dashboard layout shows a sign-in banner instead of redirecting, so its layout-anchored
    keys are `tp`; its `/offline` page is `design`, the service worker's offline fallback.
  - reg_allgemein's `hooks.server.ts` answers some routes with 404 or a redirect depending on its
    `PORTAL_MODE` setting; every route renders in one of the two modes, so none is read as never
    rendering.
  - ami's `/procedure-17cyber` is `tp` for `single-h1`: the page is an empty container an external
    script fills, read as an embedded document.
  - eDNA-SampleTown's option lists over lab-editable picklists stored in the database are `tp` for
    `each-key`, as runtime lists; its fields of one record are `design`.
- greenmods' `scripts/postbuild-seo.mjs` runs after `vite build`: it writes `sitemap.xml` and injects the
  home page's JSON-LD into the fallback `index.html` every unprerendered route is served from. Its 19
  `json-ld` keys and its `sitemap-xml` key are `design`, by the ledger's convention for a sitemap or
  `robots.txt` a build script writes (eight `design`, one `fp`); the labeller chose `fp`, and with it
  C7 would judge `seo/json-ld` (false positives from greenmods and lemke-bank) at 94.4%, above the
  threshold, and the earlier definition would also fail `seo/sitemap-xml` at 80.0%.
- Conventions the labellers extended:
  - `image-loading-hint` is `design` for imported SVGs under Vite's default 4 KB inline limit (brdsa,
    lemke-bank) and for a Tauri bundle asset (hoshi); the ledger's precedent covered only `data:` URIs.
  - An image in a fixed overlay is `design` for `image-dimensions`, and an extra `<h1>` in an overlay
    closed by default is `design` for `single-h1`.
  - `prop-mutation` on a class instance with `$state` fields is `design` under the docs' class-instance
    limit, although hoshi's writes are reactive.
- Seen while labelling, not false positives: the analyzer already left out the routes whose `load` always
  redirects in decent-cloud, lemke-bank, eDNA-SampleTown and duders-zone.

## Next

Fix the plugin crash and the classes above, and add these 14 apps to the tuning corpus. Claiming the
criteria again needs a twenty-seventh holdout.
