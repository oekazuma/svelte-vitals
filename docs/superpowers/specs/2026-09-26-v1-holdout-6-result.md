# v1 holdout 6 — result (2026-09-26)

Measured with `main` at 3ae5bd5e on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-26-v1-holdout-6-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: 11 apps installed; atmo-social,
645-live and lms failed to install and were measured uninstalled. Raw first look:
`scripts/corpus/holdout-6-2026-09-26.json`; verdicts: `scripts/corpus/holdout-6-2026-09-26-verdicts.json`
(6,057 distinct keys, every one labelled by checks over the source at the pinned commit, with npm
package components read from their published files).

**Result: not ready.** Five of ten criteria fail. C3 fails on one class in one app: biubiu renders its
head through `<SEO>` from a workspace package whose `exports` point only into a `dist/` directory that
a build creates and the checkout does not contain, so 29 routes report a missing title they ship. The
same class makes 238 of the 294 false positives.

| #   | Criterion                          | Threshold      | Measured                                        | Result | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | ------ | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0 of 14 apps                                    | pass   | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 9 apps, 5 of which built   | pass   | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 29 (`title-presence`, one app)                  | fail   | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 90.7% (1,892 / 2,085)                           | fail   | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 97.3% (2,557 / 2,629)                           | pass   | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes, both documented limits (below)       | fail   | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 5 rules below                                   | fail   | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 33.4% (1,101 / 3,296)                           | fail   | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass   | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 75 (`performance/preconnect` regained, as `fp`) | pass   | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 4,530, fp 294, design 1,233, unclear 0.

C7's five rules: `seo/description-presence` 46.3% (25 / 54), `seo/canonical-url` 67.8% (61 / 90),
`seo/title-presence` 73.6% (81 / 110), `seo/og-image` 82.6% (355 / 430), `correctness/prop-mutation`
88.9% (8 / 9). The first four are driven by the biubiu class, and `og-image` also by lms.

## False-positive classes

| Class                                                                                                                                                | Findings | Apps | Rules                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------- |
| **A workspace package whose `exports`/`svelte` field point only into an unbuilt `dist/`** is not followed, although its `src/` holds the component   | 238      | 1    | **title-presence**, description, canonical, og-\*, twitter, json-ld |
| `og:image` passed through svelte-meta-tags' `additionalMetaTags` is not read                                                                         | 46       | 1    | og-image                                                            |
| `preconnect`: a font link inside a prop-gated `{#if}` of an npm component counted as loaded                                                          | 3        | 1    | preconnect                                                          |
| **An `<h1>` in an arm a prop never selects** (documented limit)                                                                                      | 2        | 2    | single-h1                                                           |
| **Headings rendered by a child component not seen by `heading-level-skip`** (documented limit)                                                       | 2        | 2    | heading-level-skip                                                  |
| Single findings: a component chosen from a data array; `.add()` on a formatter read as a mutation; an interface property key read as a namespace use | 3        | 2    | single-h1, prop-mutation, namespace-import                          |

C6's two classes are the documented prop-gated `<h1>` and child-component `heading-level-skip` limits,
the same two that failed C6 in holdout 4.

The biubiu class: `@shelchin/seo-sveltekit` is `workspace:*`; its `svelte` field and `exports`
(`./SEO.svelte` → `./dist/components/SEO.svelte`) name files its own `build.ts` copies from `src/`,
and `dist/` is gitignored. An installed but unbuilt checkout, which is what a first run sees, has
nothing there to follow.

## Installed measurement

Three apps failed to install, two of them (atmo-social, lms) because pnpm 11+ fails an install whose
dependencies have build scripts nobody approved (`ERR_PNPM_IGNORED_BUILDS`). atmo-social is the one app
whose head comes from an npm package without an adapter, so following installed packages was not
exercised this round. The harness now retries such an install with `--ignore-scripts`, which installs
the same packages without failing.

## C2 in detail

GitHub Actions run 36238976937 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 9 apps and crashed on none. Five builds completed (brandonwie.dev, yuki, Mongoku,
htmltopdf.pro, sona); brandonwie.dev prerenders 367 pages, and htmltopdf.pro's 19 are `ssr = false`
and skipped. The others failed on their own: a Prisma client not generated or a database not reachable
(munify-delegator, wishlist), missing env variables (vilnius-hardcore, minion_hub), a web-worker
import Vite rejects (rauthy), a Rust/WASM toolchain check the build runs first (biubiu), and failed installs (atmo-social,
645-live, lms).

## Labelling notes

- The design share is concentrated in `canonical-url` (340) and `description-presence` (307) on
  auth-gated and noindex routes, and `raw-html` (129) on repo-authored or sanitized HTML; minion_hub
  alone has 342 of the 1,101.
- Conventions the labellers applied but questioned: `design` for canonical but `tp` for og-\*,
  twitter-card and JSON-LD on the same gated or noindex routes; length rules as `tp` on noindex pages;
  a sitemap a postbuild step writes as `design`; svelte-i18n's `getFormatter` as a real preceding
  await; page-load autofocus on a search or login page as `tp`; a helper-wrapped `typeof window` guard
  as `design`.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
seventh holdout.
