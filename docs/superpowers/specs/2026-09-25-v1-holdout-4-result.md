# v1 holdout 4 — result (2026-09-25)

Measured with `main` at ca2884ba on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-25-v1-holdout-4-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Raw first look: `scripts/corpus/holdout-4-2026-09-25.json`;
verdicts: `scripts/corpus/holdout-4-2026-09-25-verdicts.json` (9,131 findings, 9,124 distinct keys,
every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Six of ten criteria fail. One app decides most of it: unicove renders its
whole head through `<Head>` from the npm package `svead`, which the analyzer does not follow, so 119
routes × 8 head rules — 952 of the 1,065 false positives — report tags that are there. Without that
class the precision criteria would read very differently, but a first run on that app is exactly
what a new user of `svead` would see.

| #   | Criterion                          | Threshold      | Measured                                             | Result | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------------- | ------ | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0 of 14 apps                                         | pass   | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 8 apps, 3 of which built        | pass   | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 147 (`title-presence` 121, `handler-state-write` 26) | fail   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 82.9% (3,128 / 3,774)                                | fail   | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 92.8% (3,521 / 3,793)                                | fail   | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                                    | fail   | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 11 rules below; 1 all-`design` rule skipped          | fail   | 2     | 9     | 12    |
| C8  | Design share of critical + warning | ≤ 30%          | 23.3% (1,204 / 5,163)                                | pass   | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                                | pass   | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 73 (no new rule)                                     | pass   | 73    | 67    | 63    |

Verdicts (distinct keys): tp 6,687, fp 1,065, design 1,372, unclear 0.

## False-positive classes

| Class                                                                                                                                                                                                                                                        | Findings | Apps | Rules                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ------------------------------------------------------------------------ |
| **A head component from an npm package (`svead`'s `<Head>`) is not followed** (documented limit)                                                                                                                                                             | 952      | 1    | **title-presence**, description-presence, canonical, og-\*, twitter-card |
| `base-path-navigation`: a computed base whose every branch is `''`                                                                                                                                                                                           | 29       | 1    | base-path-navigation                                                     |
| **`handler-state-write`: an exported `{ ...prismaDelegates, ...handlers }` facade treated as a store**                                                                                                                                                       | 26       | 1    | **handler-state-write**                                                  |
| A load that redirects on every path through `try`/`catch` + rethrow, not recognised as never rendering                                                                                                                                                       | 18       | 1    | **title-presence**, head rules                                           |
| An `<h1>` in `<svelte:boundary>`'s `failed` snippet, placed in a wrapper component                                                                                                                                                                           | 16       | 1    | single-h1                                                                |
| `effect-as-onmount`: `$state` read through a local alias of an imported instance                                                                                                                                                                             | 4        | 1    | effect-as-onmount                                                        |
| JSON-LD through `{@html VAR}` (documented limit), and JSON-LD placed in the page body                                                                                                                                                                        | 4        | 2    | json-ld                                                                  |
| **Headings rendered by a child component not seen by `heading-level-skip`** (documented limit)                                                                                                                                                               | 3        | 2    | heading-level-skip                                                       |
| each-key: `Array.from(new Array(n))` / `Array.from(Array(n).keys())` not read as length-only                                                                                                                                                                 | 3        | 1    | each-key                                                                 |
| **An `<h1>` behind a prop the page never passes** (documented limit)                                                                                                                                                                                         | 2        | 2    | single-h1                                                                |
| `disallowed-aria-props`: a role an action (`use:dragHandle`) sets at runtime                                                                                                                                                                                 | 2        | 1    | disallowed-aria-props                                                    |
| Single findings: a snippet heading counted where defined; an arm the data never takes; a workspace subpath export not matched; a route `hooks.server.ts` intercepts; `typeof x === 'function'` as a browser guard; an await dependent through a closure read | 6        | 4    | various                                                                  |

The JSON-LD row is two shapes with two causes (one app each), so it is not counted for C6. C6's two
classes are the documented `heading-level-skip` and prop-gated `<h1>` limits.

C3's 147: `svead` on 119 routes, the always-redirecting OAuth callbacks on 2 (logdash), and all 26
`handler-state-write` findings on appbuilder-portal.

## C2 in detail

GitHub Actions run 36124075049 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 8 apps and crashed on none. Three builds completed (logdash, Prismedia, temporal); logdash
prerenders 4 routes, the only rendered-HTML analysis this time. Appbuilder-portal failed only at the
plugin's own gate. The others failed on their own: missing `DATABASE_URL` (civitai, acepe), a
workspace package entry Vite cannot resolve without a package build (openquok, aphex), missing
env variables or a generated file (MercuryCore, unicove), a frozen-lockfile mismatch (hoard,
torrust), and gopherstack's `svelte-check` pre-build step running out of heap.

## Labelling notes

- The consistency rules from holdout 3 (client-only tags absent on server-rendered routes; workspace
  packages followed; per-key majority over routes) were applied from the start.
- `svead`'s conditional `og:image` on 117 routes is labelled `fp`, like the ledger's other
  data-conditional tags; reading the committed empty `.env` literally would make those `tp`.
- Conventions the labellers applied but questioned: `design` only for `canonical-url` on
  non-search routes (never for og-\* or twitter-card), prop-gated `<h1>` as `fp` against the
  `single-h1` docs' wording, `Object.freeze([...])` lists still reported by each-key, and admin-written
  HTML split between `tp` and `design` across apps.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. The class that decides this holdout
— head components from npm packages — has been treated as a documented limit (`metaComponents`); two
holdouts in four have now had an app whose entire head comes from one, so it needs a product
decision before the next holdout.
