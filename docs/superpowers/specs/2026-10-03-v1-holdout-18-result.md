# v1 holdout 18 — result (2026-10-03)

Measured with `main` at a39406c5 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-03-v1-holdout-18-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-18-2026-10-03.json`;
verdicts: `scripts/corpus/holdout-18-2026-10-03-verdicts.json` (5,872 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** One of the nine deciding criteria fails: C7, on `seo/single-h1`, whose 6 false
positives come from three apps. C3 passes with no false critical finding, C4 (98.4%) and C5 (99.8%)
pass, C6 finds no class shared by two apps, and no key is `unclear`. C8, published without deciding
the result, is 36.3%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 13 apps, 8 of which built | pass     | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 98.4% (1,823 / 1,852)                          | pass     | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.8% (2,752 / 2,758)                          | pass     | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 1 rule below (3 by the earlier definition)     | fail     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 36.3% (1,083 / 2,984)                          | reported | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns are the earlier definition, as published; the same holdouts under the current
one are in `2026-10-03-c7-multi-app.md`.

Verdicts (distinct keys): tp 4,624, fp 35, design 1,213, unclear 0.

C7's rule: `seo/single-h1` 88.9% (48 / 54, 67 findings, 13 of them design). Its 6 false positives come
from gustav (4), dgst (1) and dxlbnl (1), through three different classes below; one fewer would have
put it at 90.6%. By the earlier definition two more rules fail, each from one app:
`correctness/base-path-navigation` 0% (0 / 22, statox) and `a11y/id-duplication` 57.1% (4 / 7, 21
findings, 14 of them design; gustav).

## Critical findings (C3)

52 critical findings, all `title-presence`: 49 tp (opsml 40, dxlbnl 5, statox 4) and 3 design. The
design ones are dxlbnl's two `/invoices` routes, whose loads throw `error(404)` unless `dev` (see the
labelling notes), and statox's `/noso`, a placeholder test page linked from nowhere. Each was decided on
its route's full render chain, including the npm components the chain renders.

## False-positive classes

| Class                                                                                                                            | Findings | Apps | Rules                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | --------------------------------------------------------------------- |
| `paths: { base }` shorthand naming a module `const base = ''`, read as a computed base                                           | 22       | 1    | base-path-navigation                                                  |
| **A layout `<h1>` behind `{#if !page.data.hidePageHeading}`**, a flag the route's load returns as `true`                         | 4        | 1    | **single-h1**                                                         |
| **A route a library handle in `hooks.server` answers itself** (`@auth/sveltekit` redirecting `/auth/signin` to its sign-in page) | 4        | 1    | **single-h1**, image-dimensions, image-loading-hint, responsive-image |
| A component's `{#if}` on a `$derived` lookup over a prop the first of two instances leaves unset                                 | 3        | 1    | id-duplication                                                        |
| **An `<h1>` in mdsvex markdown a load imports** and the page renders as a component                                              | 1        | 1    | **single-h1**                                                         |
| `await Promise.all([a.json(), b.json()])`, body reads of earlier responses, counted as a hop                                     | 1        | 1    | load-waterfall                                                        |

No class reaches two apps, so C6 passes. The three `single-h1` classes are unrelated mechanisms: data a
load returns deciding a layout arm, a route shadowed by a library's request handling, and markdown
content reached through load data. The mdsvex class is the `.svx` heading holdout 17 left open, here
reached through a `.md` file a load imports rather than a route file.

## C2 in detail

GitHub Actions run 37045077916 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 13 apps and crashed on none. Eight builds completed: seminary-sidekick (324 prerendered
routes analyzed), enlist (32), MiBeeSteward (its 22 prerendered routes are `ssr = false` and were
skipped), and opsml, kepce, gustav, anotame and cawco with no prerendered page. After the plugin ran,
statox's build was stopped by the plugin's own gate on its critical findings (27 prerendered routes
analyzed, 7 skipped), dxlbnl's, kpos's and Busser's failed on `$env/static/private` variables not set,
and canari's on unbuilt generated protobuf/WASM modules. dgst's build stopped before the plugin ran, on a
Prisma client not generated.

## Labelling notes

- The design share is concentrated in `raw-html` (261, about 190 of them kepce's `icon()` returning a
  repo SVG from a constant map), `canonical-url` (237), `each-key` (177) and `description-presence`
  (166); kepce, kpos, opsml and gustav together have 652 of the 1,083.
- **Dev-only routes, questioned by two labellers.** dxlbnl's `/invoices` loads throw `error(404)`
  unless `dev`, and dgst's `/__smoke` routes unless `PLAYWRIGHT_SMOKE=1`. Following the ledger's
  earlier dev-only routes, description and title presence there are `design` and JSON-LD and
  indexability `tp`. In production these routes never render, which is the shape of the literal-`false`
  flag class labelled fp. Labelled fp instead, the two dxlbnl `/invoices` `title-presence` keys would
  fail C3, and the 11 warning keys on those routes would put C4 at 97.8% (1,817 / 1,857).
- Mixed keys were labelled by majority: gustav's `AuthFrame` `<h1>` (fp on 4 of 6 routes), kpos's
  `(app)` layout "Missing `<h1>`" (a stub on `/customers`, a real page on `/pos`, tp) and canari's
  `PinModal` `<h1>` (design, though 4 admin routes do render two).
- Conventions the labellers applied but questioned: `load-waterfall` on a parent that reruns only when
  the card params change is `design`; site-owner frontmatter in unescaped JSON-LD is `tp`; a layout
  `<table>`'s presentational attributes in an e-mail template are `design` (a new precedent); a
  generation of recovery codes shown once is `design` for `each-key`, against a ledger that is mostly
  `tp` for code lists; dev mock components with no importer are `tp` on their shape; a page whose
  `app.html` has an in-range `<title>` before the page's short one is `tp` for `title-length`; a
  GitHub Pages project path that cannot serve a root `robots.txt` is `tp`; per-element findings on a
  never-rendering route are fp while those in a never-rendering arm are `design`.
- Analyzer gaps that did not change a verdict: the `each-key` static-list exemption takes only `const`,
  so a never-reassigned `let` list is reported (kpos, `design`); `aria-hidden-focus` says "is still
  keyboard-focusable" of an empty `role="gridcell"` with no tabindex, because the docs count a literal
  interactive role as focusable (canari, `design`); `load-waterfall` again follows a dependent await
  inside an `if` branch although its docs say the scan does not enter one (opsml, real chains, `tp`).

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
nineteenth holdout.
