# v1 holdout 2 — result (2026-09-24)

Measured with `main` at 5414a0d8 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-09-24-v1-holdout-2-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Raw first look: `scripts/corpus/holdout-2-2026-09-24.json`;
verdicts: `scripts/corpus/holdout-2-2026-09-24-verdicts.json` (6,203 findings, every one labelled by
checks over the source at the pinned commit).

**Result: not ready.** Five of ten criteria fail. Two that failed on holdout 1 now pass: no false
criticals (C3) and info precision (C5). C8 passed on holdout 1 and fails here.

| #   | Criterion                          | Threshold      | Measured                                       | Result | Holdout 1 |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | --------- |
| C1  | CLI crashes                        | 0              | 0 of 14 apps                                   | pass   | pass      |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 9 of which built | pass   | pass      |
| C3  | `fp` from critical rules           | 0              | 0 (21 critical findings: 18 tp, 3 design)      | pass   | fail (95) |
| C4  | Warning precision                  | ≥ 98%          | 92.1% (2,063 / 2,240)                          | fail   | 71.3%     |
| C5  | Info precision                     | ≥ 95%          | 96.2% (2,614 / 2,716)                          | pass   | 90.2%     |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class, 4 apps (below)                        | fail   | 5 classes |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 9 rules below; 2 all-`design` rules skipped    | fail   | 12 rules  |
| C8  | Design share of critical + warning | ≤ 30%          | 33.0% (1,113 / 3,375)                          | fail   | 25.3%     |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0.08% (5)                                  | pass   | pass      |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 67 (5 new: see below)                          | fail   | 63        |

Verdicts: tp 4,695, fp 279, design 1,224, unclear 5.

## False-positive classes

| Class                                                                                                              | Findings | Apps | Rules                                                    |
| ------------------------------------------------------------------------------------------------------------------ | -------- | ---- | -------------------------------------------------------- |
| A head component outside `<svelte:head>` emits `<meta {name}>` / `<meta {property}>` from props                    | 124      | 1    | og-title, og-description, og-image, description-presence |
| Head tags from an npm component reached through a local wrapper and an `export * from '<package>'` barrel          | 98       | 1    | og-\*, twitter-card, canonical-url, description-presence |
| `<h1>` in the root `<svelte:boundary>` `failed` snippet counted as rendering with every page                       | 30       | 1    | single-h1, heading-level-skip                            |
| **A component placed in one arm of an `{#if}`/`{:else}` counted as rendering unconditionally**                     | 5        | 4    | single-h1                                                |
| `each-key`: a constant list's name also used as another object's property or a type parameter                      | 5        | 1    | each-key                                                 |
| A conditional modal `<title>` credited to the group layouts                                                        | 4        | 1    | title-length, duplicate-title                            |
| A heading rendered by a child component before the flagged one not seen                                            | 3        | 1    | heading-level-skip                                       |
| An id in the layout's `{:else if}` arm and in the page rendered by its `{:else}` arm counted as rendering together | 3        | 1    | id-duplication                                           |
| JSON-LD emitted through `{@html fn()}` whose source text does not name JSON-LD                                     | 2        | 1    | json-ld                                                  |
| `load-waterfall`: `await` on a promise an earlier load already started counted as a network hop                    | 2        | 1    | load-waterfall                                           |
| `<h1>` from a component the analyzer cannot follow (mdsvex module from load data; a theme lookup table)            | 2        | 2    | single-h1                                                |
| `unmutated-state`: `$state.raw` declared inside a factory function and reassigned by its method                    | 1        | 1    | unmutated-state                                          |

The C6 class is the documented one: "a component placed in one arm counts as if it rendered
unconditionally" (the `single-h1` page). It is written down as an over-count, but the claim it
produces is false, and it reaches four of 14 apps. The last row is two shapes with one effect; they
are distinct root causes (one app each), so it does not count toward C6.

Two classes are documented limits rather than analyzer bugs: npm meta components (declared through
`metaComponents`) and JSON-LD through `{@html}`. They are labelled `fp` because the protocol labels
the claim, not the cause.

## C2 in detail

Run on GitHub-hosted runners with no token scopes (Actions run 35974926651, from the throwaway `holdout-build/h2` branch): each app installed with its own package manager,
its `vite.config` wrapped to add the packed plugin, and its own `build` script run. The plugin ran
and wrote its report on 11 apps and crashed on none. Nine builds completed. Two (WelcometoMyGarden,
freehire) failed after the plugin reported, on missing env variables and a workspace dependency the
harness did not install. Three did not reach the plugin (two installs failed, one prerender 404).
Only utsuwa prerenders pages (25 routes analysed); Anki-xiehanzi's 31 are `ssr = false` shells and
the rest prerender nothing, so this holdout exercises the source scan in build mode far more than
the rendered-HTML path.

## C8

The design share rose from 25.3% to 33.0%. Most of it is `seo/canonical-url` and
`seo/description-presence` on routes that are not search targets (auth-gated or `noindex`: 232 and
261), `security/raw-html` on sanitized or operator-authored HTML (267), and `each-key` on static
lists (177). These are reported as documented, but a warning that is mostly not a defect is the
noise C8 exists to catch.

## C10

New evidence: `a11y/deprecated-element`, `a11y/invalid-aria-value`,
`correctness/nonreactive-builtin-state`, `performance/render-blocking-script`,
`security/shared-state-import`. 67 of 105; eight can never get evidence under the default config.

## Labelling notes

- Two freehire `single-h1` findings are `unclear`: whether `@scalar/api-reference`'s server output
  contains an `<h1>` needs that package's source.
- The npm package behind svelte-commerce's meta tags was read from its published source (the clone
  has no `node_modules`).
- Conventions the labellers applied but questioned, for a later pass over both ledgers: `og-*` is
  `tp` on `noindex` routes while `canonical-url` is `design`; `ssr-disabled` is split between `tp`
  and `design` for the same shape across apps; `robots-txt` on GitHub Pages project sites;
  `component-size` counts `<style>` lines; `raw-html` on operator-authored HTML.

## Next

Fix the classes above, add these 14 apps to the tuning corpus, and decide C8's remaining `design`
volume (whether rules that mostly report non-defects on non-search routes should say less). A new
holdout is needed to claim the criteria again.
