# v1 holdout 7 — result (2026-09-27)

Measured with `main` at 667cd93f on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-26-v1-holdout-7-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: 12 apps installed; orkestrai
(its `package-lock.json` is out of sync with `package.json`) and digitable (its vendored workspaces
are git submodules the checkout did not fetch) failed to install and were measured uninstalled. Raw
first look: `scripts/corpus/holdout-7-2026-09-27.json`; verdicts:
`scripts/corpus/holdout-7-2026-09-27-verdicts.json` (4,262 distinct keys, every one labelled by checks
over the source at the pinned commit, with npm package components read from their published files).

**Result: not ready.** Four of ten criteria fail, and for the first time C3 passes: none of the 28
critical findings is false (26 `tp`, 2 `design`). C4 fails on one app measured uninstalled: 34 of the
39 false warnings are orkestrai's head, which comes from an npm package the analyzer can only follow
when installed.

| #   | Criterion                          | Threshold      | Measured                                       | Result | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0 of 14 apps                                   | pass   | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 6 of which built | pass   | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0 (26 `tp`, 2 `design`)                        | pass   | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 97.0% (1,249 / 1,288)                          | fail   | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 97.1% (2,036 / 2,096)                          | pass   | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class, a documented limit (below)            | fail   | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 2 rules below                                  | fail   | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 34.4% (689 / 2,003)                            | fail   | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass   | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 75 (new: `correctness/server-browser-global`)  | pass   | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 3,311, fp 99, design 852, unclear 0.

C7's two rules: `seo/description-presence` 43.3% (13 / 30; all 17 false ones are orkestrai's) and
`seo/single-h1` 85.7% (36 / 42).

## False-positive classes

| Class                                                                                                                 | Findings | Apps | Rules                                                   |
| --------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------- |
| A head component from an npm package (`@beeblock/svelar`'s `Seo`) not followed because the app could not be installed | 68       | 1    | description-presence, og-title, og-description, twitter |
| JSON-LD emitted with `{@html}` into the page body, outside `<head>`                                                   | 23       | 1    | json-ld                                                 |
| **An `<h1>` behind a prop the route never passes** (documented limit)                                                 | 3        | 2    | single-h1                                               |
| An mdsvex `.svx` component a page renders (`<Content />`) is not followed                                             | 3        | 1    | single-h1                                               |
| `each-key`: an imported constant list the exporting module spreads into a new array is treated as written             | 2        | 1    | each-key                                                |

C6's one class is the documented prop-gated `<h1>` limit (sklonuj, digitable), which also failed C6 in
holdouts 4 and 6.

The critical findings: all 26 `title-presence` findings are routes that really render no title. The
one `security/handler-state-write` writes a single-user desktop app's global settings, the shape the
rule's docs call shared by design; the one `correctness/server-browser-global` reads `navigator` at a
runes module's top level in an app whose every route has `ssr = false`, which the rule still checks by
its docs. Both are `design`.

## Installed measurement

Two apps failed to install, and the harness now handles both shapes for the next holdout: an
`npm ci` that fails on a lockfile out of sync with `package.json` falls back to `npm install` (as pnpm
already fell back to `--no-frozen-lockfile`), and git submodules are fetched after the checkout (a checkout whose submodules fail to fetch is measured uninstalled). Other `npm ci` failures, such as an integrity mismatch, still fail the install. Both
were checked locally: an out-of-sync lockfile, a failing `postinstall`, and both together install; and
digitable's two vendored workspaces are present after the submodule fetch. orkestrai is the one app
whose head comes from an npm package without an adapter, so following installed packages was not
exercised this round either.

## C2 in detail

GitHub Actions run 36251877444 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Six builds completed (Cinephage, imrg-platform, hister, sklonuj,
lifeatuni, echobell.one); imrg-platform prerenders 2,632 pages and echobell.one 511. Sylve and blinddate
stopped at the plugin's own critical gate, on the same critical findings the first look reported
(`server-browser-global` and three `title-presence`). The others failed on their own: a workspace
package entry Vite cannot resolve before the package is built (Verdagraph), a generated data file the
build expects (uwcourses), and public env variables not set (steaminputdb, KAIROS).

## Labelling notes

- New convention: `performance/sequential-awaits` is `design` when the flagged await, or every
  independent await before it, is a synchronous better-sqlite3 / `node:sqlite` query, which
  `Promise.all` cannot overlap (66 findings, Cinephage and orkestrai). The rule is info, so this moves no
  criterion.
- The design share is concentrated in `description-presence` (200) and `canonical-url` (154) on
  login-gated consoles; Sylve and Cinephage alone have 313 of the 689.
- Conventions the labellers applied but questioned: prop-gated `<h1>` as `fp` although the `single-h1`
  docs describe the over-count; `design` for canonical but `tp` for og-\* and JSON-LD on the same gated
  routes; separate `{#if}` blocks that never co-render counted as `design`; body-placed JSON-LD as `fp`
  (both analysis modes read only `<head>`).

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs an
eighth holdout.
