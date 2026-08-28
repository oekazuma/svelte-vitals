# kitchen-sink

A real SvelteKit app used four ways:

- Defect gallery — `/gallery/**` plants one (or a few) findings per rule, so every rule in
  `@svelte-vitals/core`'s `allRules` has a concrete, reviewable specimen instead of a synthetic
  fixture. `expected-findings.json` pins the exact finding count per rule; a meta-test enforces
  that every rule in `allRules` has an entry.
- False-positive canary — `/clean/**` and `src/lib/clean/**` are written to be finding-free.
  If a rule change makes them fail, that's a regression in the rule, not the example.
- Live-dashboard dogfood — `@svelte-vitals/vite`'s `svelteVitals()` plugin runs against this
  app's own `vite build`, exercising the same rendered-HTML analysis path and dashboard
  (`/__svelte-vitals/`) that real consumers use.
- Bench realism target — `pnpm bench --target examples/kitchen-sink` measures collection
  performance against a project with real route/component depth, not a minimal fixture.

## Running it

The example consumes `svelte-vitals`, `@svelte-vitals/core`, and `@svelte-vitals/vite` through
their built `dist` (workspace links), and the static e2e spawns `packages/cli/dist/bin.js` —
so build the workspace first on a fresh checkout (`pnpm build` at the repo root; root
`pnpm test` does this for you).

```sh
pnpm build                        # once, at the repo root
pnpm --filter kitchen-sink dev    # dashboard at /__svelte-vitals/
pnpm --filter kitchen-sink test   # static (CLI) + build (vite plugin) e2e
pnpm bench --target examples/kitchen-sink
```

`pnpm --filter kitchen-sink test` runs three suites:

- `test/e2e-static.test.ts` — runs the built CLI (`svelte-vitals`) against the source tree and
  checks the JSON report against `expected-findings.json`.
- `test/e2e-build.test.ts` — runs `vite build` and checks the plugin's rendered-HTML report
  against `expected-findings.rendered.json`. **This build is expected to fail**: the gallery
  contains a critical finding, and the plugin's `closeBundle` gate fails the build on critical
  findings by design. The test asserts on the failure and its stderr, not on a successful build.
- `test/e2e-suppression.test.ts` — exercises every disable/suppress surface (`--ignore`, `--rules`,
  `--category`, `--fail-on`/`--min-health`, config `rules: 'off'`, severity overrides, route
  `overrides`, the inline `svelte-vitals-disable-next-line` directive, and the suppressions file)
  against the gallery on scratch copies, so a surface that silently stops working fails here rather
  than in a user's CI. The gallery files themselves are never edited.

This package has no `build` script — nothing here should ever produce `examples/kitchen-sink/build/`
as a side effect of `pnpm -r build`. If it appears after a full build, that's a bug.

## Route → rule map

Findings are grouped by category under `/gallery/<category>`. Ids only — see
`expected-findings.json` for counts, and the rule's own doc under `docs/src/content/docs/rules/`
for what it checks.

| Route                                                                           | Rule ids planted here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/gallery/a11y/aria`                                                            | `a11y/invalid-role`, `a11y/unknown-aria-attribute`, `a11y/required-aria-props`, `a11y/invalid-aria-value`, `a11y/interactive-nesting`, `a11y/aria-hidden-focus`, `a11y/accessible-name`, `a11y/label-has-control`, `a11y/use-list`, `a11y/placeholder-label-option`, `a11y/require-datetime`, `a11y/disallowed-aria-props`, `a11y/deprecated-aria`, `a11y/permitted-contents`, `a11y/positive-tabindex`, `a11y/no-accesskey`, `a11y/no-autofocus`, `a11y/no-duplicate-dt`, `a11y/abbr-title`, `a11y/pattern-title` |
| `/gallery/a11y/ids` (+ `src/lib/a11y/DupId.svelte`)                             | `a11y/id-duplication`, `a11y/no-missing-id-ref`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/gallery/a11y/landmarks`                                                       | `a11y/duplicate-landmark`, `a11y/top-level-landmark`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/gallery/a11y/legacy`                                                          | `a11y/deprecated-element`, `a11y/deprecated-attr`, `a11y/disallowed-element`, `a11y/required-element`, `performance/iframe-loading`, `a11y/accessible-name` (iframe arm)                                                                                                                                                                                                                                                                                                                                           |
| `/gallery/architecture` (+ `src/lib/architecture/**`)                           | `architecture/private-scope-import`, `architecture/route-component-import`, `architecture/doc-link-target`, `architecture/component-size`, `architecture/prop-count`, `architecture/directory-naming`, `architecture/reserved-directory-names`, `architecture/reserved-name-placement`, `architecture/unit-entry-file`                                                                                                                                                                                             |
| `/gallery/correctness`                                                          | `correctness/each-key`, `correctness/each-index-key`, `correctness/effect-as-derived`, `correctness/effect-as-onmount`, `correctness/unmutated-state`, `correctness/nonreactive-builtin-state`, `correctness/checkable-bind-value`, `correctness/autoplay-muted`, `correctness/prop-mutation`, `correctness/stale-prop-derivation`                                                                                                                                                                                 |
| `/gallery/perf`                                                                 | `performance/namespace-import`, `performance/state-raw`, `performance/render-blocking-script`, `performance/preload-missing-as`, `performance/preconnect`, `performance/lcp-image`, `performance/responsive-image`, `performance/image-dimensions`, `performance/image-loading-hint`                                                                                                                                                                                                                               |
| `/gallery/perf/loading`                                                         | `performance/load-waterfall`, `performance/sequential-awaits`, `performance/font-preload-crossorigin`                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/gallery/security`                                                             | `security/raw-html`, `security/javascript-url`, `security/server-module-state`, `security/handler-state-write`, `security/shared-state-import`                                                                                                                                                                                                                                                                                                                                                                     |
| `/gallery/seo`                                                                  | `seo/title-presence`, `seo/description-presence`, `seo/canonical-url`, `seo/og-title`, `seo/og-image`, `seo/og-url`, `seo/og-description`, `seo/twitter-card`, `seo/json-ld`, `seo/single-h1`, `seo/heading-level-skip`, `seo/image-alt`                                                                                                                                                                                                                                                                           |
| `/gallery/seo/duplicate-a`, `/gallery/seo/duplicate-b`                          | `seo/duplicate-title`, `seo/duplicate-description`                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/gallery/seo/hreflang`                                                         | `seo/hreflang`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `/gallery/seo/jsonld`                                                           | `seo/json-ld-validity`, `seo/json-ld-deprecated-type`, `seo/json-ld-relative-url`, `seo/json-ld-placeholder`, `seo/json-ld-date-format`, `seo/json-ld-required-props`                                                                                                                                                                                                                                                                                                                                              |
| `/gallery/seo/noindex`                                                          | `seo/indexability`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `/gallery/seo/ssr-off`                                                          | `seo/ssr-disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| several `/gallery/seo/*`, `/gallery/perf` (incidental, not one dedicated route) | `seo/title-length`, `seo/description-length` — titles/descriptions across the gallery happen to fall outside the length window; no single specimen owns these                                                                                                                                                                                                                                                                                                                                                      |
| `src/app.html` (project-scoped, not one route)                                  | `a11y/doctype`, `seo/html-lang` — plus `seo/charset` and `seo/viewport`, which app.html sets correctly (intentionally valid, exercised as passes by the rendered build e2e, not findings)                                                                                                                                                                                                                                                                                                                          |
| `src/lib/crash-samples/**` (never imported, see below)                          | `correctness/instance-browser-global`, `correctness/orphan-effect`, `correctness/orphan-lifecycle`, `correctness/server-browser-global`                                                                                                                                                                                                                                                                                                                                                                            |
| `vite.config.ts` (`minify: false`)                                              | `performance/minify-disabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `static/robots.txt` / `static/sitemap.xml`                                      | `seo/sitemap-in-robots`, `seo/robots-txt` (pass-only), `seo/sitemap-xml` (pass-only)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/routes/gallery/perf/_specimens.svelte`                                     | `performance/heavy-import` — no `+` prefix, so SvelteKit never bundles it; glob-collected by static analysis but never imported by any route (`lodash` isn't an installed dependency)                                                                                                                                                                                                                                                                                                                              |
| (no specimen — inert in this project)                                           | `correctness/base-path-navigation` only opens its gate when `kit.paths.base` is configured, which this example doesn't set; see the `inert` entry in `expected-findings.json`                                                                                                                                                                                                                                                                                                                                      |

## The crash-samples invariant

**Never import anything under `src/lib/crash-samples/` from a route, layout, or any component that
a route reaches.** Those files plant findings whose _rule_ requires code that would crash if it
ever actually ran — a browser global read at module scope during SSR, a lifecycle call outside
component init, an effect with no reactive dependency. The rules analyze them statically without
executing them; importing one for real would crash prerender (server) or blow up at runtime
(client). The CLI's static analysis reaches them by reading the files directly, not through an
import graph — that's what keeps them safe to plant.

## Updating `expected-findings.json` when you add a rule

1. Add a planted specimen for the new rule somewhere under `/gallery/<its-category>` (or
   `src/lib/crash-samples/` if triggering it for real would crash the app — see above).
2. Run the CLI against this app and read the finding count for the new rule id from the JSON
   report:
   ```sh
   pnpm build
   node packages/cli/dist/bin.js examples/kitchen-sink --reporter json
   ```
3. Transcribe that count into `expected-findings.json` as `{ "findings": <n> }`. The meta-test in
   `test/e2e-static.test.ts` fails the build if any rule in `allRules` is missing an entry, so this
   step isn't optional.
4. If the rule can't produce a real finding in static (CLI) mode — because it needs rendered HTML,
   or its gate never opens in this project's config — use one of the other three keys instead of
   `findings`, with the reason as its string value:
   - `"passOnly": "<reason>"` — the rule only ever emits a pass in this project (e.g.
     `seo/robots-txt`, `seo/sitemap-xml`: they pass whenever the file exists, and can't coexist
     with a failing `seo/sitemap-in-robots` on the same file).
   - `"renderedOnly": "<reason>"` — the rule only fires under rendered (vite plugin) analysis,
     never static (e.g. `seo/charset`, `seo/viewport`: both live in `src/app.html`, which static
     analysis never resolves).
   - `"inert": "<reason>"` — the rule's gate never opens in this project's configuration at all
     (e.g. `correctness/base-path-navigation`, which needs `kit.paths.base` set).

`expected-findings.rendered.json` is the parallel file for `test/e2e-build.test.ts` — the same
per-rule counts, but from the vite plugin's rendered-HTML pass instead of the CLI's static pass.
The two are **not** expected to match exactly: rendered analysis sees resolved, composed HTML
(catching things static per-file analysis can't, e.g. some `performance/image-*` and
`seo/heading-level-skip` counts are higher there). When you add a rule, add its count to both
files; the divergences are known and by design, not silent drift.

## Intentionally-defective surfaces — do not "fix" these

These are deliberate, not oversights. Do not clean them up:

- `src/app.html` has no `<!doctype html>` and no `lang` attribute — the specimens for
  `a11y/doctype` and `seo/html-lang`.
- `vite.config.ts` sets `build.minify: false` — the specimen for `performance/minify-disabled`.
- `static/robots.txt` allows everything but has no `Sitemap:` line — the specimen for
  `seo/sitemap-in-robots`.
- The `<iframe>` on `/gallery/a11y/legacy` is the **only** iframe in the app and carries four
  planted rules at once: `a11y/deprecated-attr` (`frameborder`), `a11y/disallowed-element` (the
  config declares `iframe`), `performance/iframe-loading` (no `loading` attribute), and
  `a11y/accessible-name` (no `title`/`aria-label`/`aria-labelledby`). The suppression e2e also
  rewrites this exact element by full-string match. Adding `loading="lazy"`, `title`,
  `frameborder` removal, or planting a second iframe anywhere breaks pinned counts in three test
  files at once.
- `svelte.config.js` tells the prerenderer to **ignore every 404** (`handleHttpError`) rather than
  allowlisting paths. Planted specimens reference `href`/`src` values that resolve nowhere, the
  crawler follows them, and an allowlist would need an entry per new specimen. The cost is that a
  genuinely broken internal link in the example would also be swallowed — acceptable here, where the
  static e2e's expectation files, not the prerender, are the correctness check; never copy this into
  a real app's config.
