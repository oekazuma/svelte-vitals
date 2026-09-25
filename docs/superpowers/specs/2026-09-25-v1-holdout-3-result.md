# v1 holdout 3 — result (2026-09-25)

Measured with `main` at b8d05b81 on the 14 apps then pinned in `scripts/corpus/holdout.json`, now in `targets.json` (chosen in
`2026-09-25-v1-holdout-3-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Raw first look: `scripts/corpus/holdout-3-2026-09-25.json`;
verdicts: `scripts/corpus/holdout-3-2026-09-25-verdicts.json` (9,639 findings, 9,632 distinct keys,
every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Four of ten criteria fail, down from six on holdout 1 and five on holdout 2.
C8 and C10 pass for the first time. C3 fails again, on two resolution gaps in two apps.

| #   | Criterion                          | Threshold      | Measured                                       | Result | Holdout 2 | Holdout 1 |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | ------ | --------- | --------- |
| C1  | CLI crashes                        | 0              | 0 of 14 apps                                   | pass   | pass      | pass      |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 7 of which built | pass   | pass      | pass      |
| C3  | `fp` from critical rules           | 0              | 19 (`seo/title-presence`, 2 apps)              | fail   | pass (0)  | fail (95) |
| C4  | Warning precision                  | ≥ 98%          | 97.5% (3,954 / 4,055)                          | fail   | 92.1%     | 71.3%     |
| C5  | Info precision                     | ≥ 95%          | 97.8% (4,038 / 4,130)                          | pass   | 96.2%     | 90.2%     |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                              | fail   | 1         | 5         |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 2 rules below                                  | fail   | 9         | 12        |
| C8  | Design share of critical + warning | ≤ 30%          | 22.7% (1,212 / 5,330)                          | pass   | 33.0%     | 25.3%     |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0.02% (2)                                  | pass   | pass      | pass      |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 73 (6 new, below)                              | pass   | 67        | 63        |

Verdicts (distinct keys): tp 8,034, fp 212, design 1,384, unclear 2.

## False-positive classes

| Class                                                                                                       | Findings | Apps | Rules                                      |
| ----------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------------ |
| Meta tags written inside `{#each}` as `<meta {property} {content}>`, so no literal tag name                 | 76       | 1    | og-\*, twitter-card                        |
| **A head component mounted with `import()` in `onMount` and rendered from state** (on `ssr = false` routes) | 57       | 1    | **title-presence**, json-ld, canonical-url |
| `base-path-navigation`: a literal that already starts with `kit.paths.base`                                 | 21       | 1    | base-path-navigation                       |
| JSON-LD emitted through `{@html VAR}` whose name does not say JSON-LD (documented limit)                    | 12       | 1    | json-ld                                    |
| **each-key: a list imported through a `./x.svelte` specifier that resolves to `x.svelte.ts`**               | 8        | 3    | each-key                                   |
| `<h1>` from an npm package component or its markdown content (documented limit)                             | 6        | 1    | single-h1                                  |
| **A `kit.alias` that points outside the app directory is not followed**                                     | 6        | 1    | **title-presence**, single-h1              |
| A route whose load always redirects through app logic the analyzer cannot evaluate                          | 6        | 1    | og-\*, twitter-card, canonical-url         |
| A layout chosen at runtime from a theme lookup                                                              | 5        | 1    | single-h1                                  |
| **An `<h1>` behind a condition that is false on that route** (documented limit)                             | 4        | 2    | single-h1                                  |
| `<h1>` from a workspace package component                                                                   | 2        | 1    | single-h1                                  |
| A heading rendered by a package component (bits-ui `Dialog.Title`) not seen before the flagged one          | 2        | 1    | heading-level-skip                         |
| `top-level-landmark`: a `<header>` inside `<section>` treated as a banner                                   | 2        | 1    | top-level-landmark                         |
| Headings in two dialogs that are never open together compared                                               | 1        | 1    | heading-level-skip                         |
| each-key: the exporting module reads the list with `for … of`                                               | 1        | 1    | each-key                                   |
| `load-waterfall`: a body-read helper (`safeJson(res)`) counted as a hop                                     | 1        | 1    | load-waterfall                             |
| `namespace-import`: a loop variable with the namespace's name counted as a use                              | 1        | 1    | namespace-import                           |
| `responsive-image`: an `<img>` inside `<picture>` whose `<source>` carries `srcset`                         | 1        | 1    | responsive-image                           |

C3's 19: the OpenMates `import()` class on its 16 `ssr = false` routes, and the angple `$plugins`
alias (`../../plugins`) on 3 routes. On the 7 SSR routes where the same component supplies the
title only after hydration, the server-rendered HTML has no `<title>`, so those are labelled `tp`.

C6's two classes: the `.svelte` → `.svelte.ts` specifier gap in the imported-constant exemption and conditional `<h1>`s, a limitation the `single-h1` docs record.

## C2 in detail

Run on GitHub-hosted runners with no token scopes (Actions run 36069496970; harness in
`scripts/holdout-build/`, now also installing linked packages). The plugin ran and wrote its report on
11 apps and crashed on none. It analysed prerendered HTML on four (orrery 4,309 routes, ow-mods 898,
hyvor/blogs 122, joco 96); the rest prerender nothing or only `ssr = false` shells. Seven builds
completed; three more failed only at the plugin's own gate (critical findings, the intended
behaviour). Four did not complete for reasons outside the plugin: OpenMates ran out of heap while
compiling, QAStudio's Prisma config needs `DATABASE_URL`, tokimeki's build fails on its own imports
after the plugin reported, and primo has no `vite.config` to wrap.

## C10

New evidence: `a11y/no-missing-id-ref`, `a11y/use-list`, `performance/heavy-import`,
`security/handler-state-write`, `security/javascript-url`, `seo/json-ld-relative-url`. 73 of 105;
eight can never get evidence under the default config.

## Labelling notes

- One key covers every route a component-anchored finding appears on; mixed keys were labelled by
  their representative routes and say so in the basis.
- New tie-breaker for config-dependent layouts (angple themes, wikijump's Wikidot header): judge by
  the default configuration in the repo.
- Conventions the labellers applied but questioned, for a later pass over the ledger:
  `route-component-import` on SvelteKit's shallow-routing pattern (arguably `fp`), `og-*` `tp` on
  noindex routes while `canonical-url` is `design`, hidden file inputs as `tp` for
  `interactive-nesting`, `store.set()` flagged by `prop-mutation`, and "prop never given → `fp`"
  against the `single-h1` docs' own wording.
- Real security issues surfaced while labelling `security/raw-html` (a stored XSS through a wiki page
  API, unsanitized markdown of LLM output) are the apps' own, not reported upstream by this work.

## Next

Fix the classes above, add these 14 apps to the tuning corpus, and measure a fourth holdout. The two
C3 classes are resolution gaps (a dynamic `import()` of a head component; a `kit.alias` outside the
app directory) and the C7 rules are `base-path-navigation` (the base-prefixed literal) and
`title-presence` (the same two gaps).
