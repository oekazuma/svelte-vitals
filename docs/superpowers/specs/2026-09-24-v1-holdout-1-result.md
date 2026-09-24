# v1 holdout 1 — result (2026-09-24)

Measured with `main` at c820cf7a on the 12 apps pinned in `scripts/corpus/holdout.json`, before any
fix, and judged against `2026-09-24-v1-release-criteria.md`. Raw first look:
`scripts/corpus/holdout-2026-09-24.json`; verdicts: `scripts/corpus/holdout-2026-09-24-verdicts.json`
(4,763 findings, every one labelled by independent checks over the source).

**Result: not ready.** Six of ten criteria fail.

| #   | Criterion                          | Threshold      | Measured                                  | Result |
| --- | ---------------------------------- | -------------- | ----------------------------------------- | ------ |
| C1  | CLI crashes                        | 0              | 0 of 12 apps                              | pass   |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; analysis ran on 4 of 9 apps that build | pass   |
| C3  | `fp` from critical rules           | 0              | 95 (`seo/title-presence`, 2 apps)         | fail   |
| C4  | Warning precision                  | ≥ 98%          | 71.3% (1,160 / 1,628)                     | fail   |
| C5  | Info precision                     | ≥ 95%          | 90.2% (2,126 / 2,358)                     | fail   |
| C6  | fp class shared by ≥ 2 apps        | none           | 5 classes (below)                         | fail   |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 12 rules below                            | fail   |
| C8  | Design share of critical + warning | ≤ 30%          | 25.3% (586 / 2,317)                       | pass   |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                     | pass   |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 63                                        | fail   |

The stricter reading is used for one judgement call: `<meta property="twitter:card">` (27 findings,
2 apps) is counted as `fp`, because X's parser reads `property=` and the card does render.

## False-positive classes

| Class                                                                                     | Findings | Apps | Rules                                                                 |
| ----------------------------------------------------------------------------------------- | -------- | ---- | --------------------------------------------------------------------- |
| Component imported through a barrel `index.ts` re-export or `import * as` is not followed | ~700     | 4    | title/description/canonical/og/twitter/json-ld/single-h1/title-length |
| Alias written as `path.resolve(...)` in `svelte.config.js` is opaque                      | 2+       | 2    | single-h1 (and underneath several barrel findings)                    |
| Headings in exclusive `{#if}`/`{:else}` branches are counted together                     | 8        | 5    | single-h1, heading-level-skip                                         |
| An await guarded by an earlier await's result (`x ?? await f()`) counted as independent   | 2        | 2    | sequential-awaits                                                     |
| `twitter:card` written with `property=` reported as missing                               | 27       | 2    | twitter-card                                                          |
| `ssr = false` in a non-root layout is not honoured                                        | 17       | 1    | shared-state-import, server-module-state, instance-browser-global     |
| Named import of a `+layout.svelte` module export treated as rendering the route           | 21       | 1    | route-component-import                                                |
| Dynamically chosen component (`const C = $derived(X); <C />`) not followed                | 6        | 1    | single-h1                                                             |
| `<svelte:element this="script" type="application/ld+json">` in head ignored               | 5        | 1    | json-ld                                                               |
| `Array(n).fill(x)` placeholder list not treated as length-only                            | 5        | 1    | each-key                                                              |
| Page that always redirects through `if`/`try` not recognised                              | 3        | 1    | title/description/canonical                                           |
| Snippet definition order taken as render order                                            | 1        | 1    | lcp-image                                                             |
| heading-level-skip does not see child-component headings (documented limitation)          | 1        | 1    | heading-level-skip                                                    |

Most of the damage is one gap: resolving which component a route renders. Barrels, namespace
imports, `path.resolve` aliases and dynamic components all end in the same "unresolved component
contributes nothing" branch, which head-tag and heading rules then read as "missing".

## Not in the criteria, found on the way

- Build mode does nothing, and says nothing, on an app with no prerendered output (5 of 9 apps that
  build); the README says the source scan runs project-wide.
- `@svelte-vitals/vite` declares `vite ^8.3.0` as a peer, which refuses apps on vite 8.1.

## Next

Fix the classes above, add these 12 apps to the tuning corpus, and measure a new holdout of apps that
nobody has tuned on. This holdout cannot be re-run to a pass.
