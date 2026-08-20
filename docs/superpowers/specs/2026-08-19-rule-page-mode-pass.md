# Every rule page states its mode behaviour (Phase D-13)

Depends on the dev live layer being restricted to single-route rules
(`2026-08-19-dev-live-layer-rule-set.md`); the dashboard statements below assume it.

## The two inputs

A rule's result comes from one of two inputs, and every run surface is one of them or both:

| Input                                                  | Surfaces                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source** — `.svelte`/`.ts` files, composed per route | the CLI (and the GitHub Action), the live dashboard's static baseline, the Vite plugin's build-time source scan                              |
| **Rendered** — the HTML a route ships                  | the Vite plugin's build pass (prerendered routes), the live dashboard's layer for a route you visit (hook options only, not the config file) |

The dashboard's live layer is not a third mode: it runs the route-scope rules that judge a route
on its own against rendered HTML and replaces the static result per rule id; its mechanics — route
scope only, per-rule-id replacement, hook options rather than the config file — live in the
dev-dashboard guide. A rule page mentions the dashboard only where this rule's behaviour there
differs from the plain rendered story: the uniqueness pair (left to static), `a11y/doctype` and
`a11y/required-element` (static result stands; the live layer does not evaluate them).

Vocabulary on every page: **Source analysis** (the CLI, the dashboard's static baseline) and
**Rendered analysis** (the Vite plugin's build pass, a route you visit in the dashboard). The seven
pages that already label their bullets `Static (CLI)` / `Rendered (vite)` switch to these labels —
the old ones hide the dashboard baseline under "CLI".

## Truth table — what each family reads, per input

Derived from `packages/core/src/rules/*` (`ctx.*` reads and helpers) and the providers
(`packages/cli/src/providers/source/{routes,resolve,parse,project}.ts`, `collect-all.ts`,
`packages/vite/src/providers/rendered/*`, `packages/vite/src/hooks/handle.ts`). 94 rules: 49
component-scope, 39 route-scope (27 head, 5 image, 2 heading, 5 a11y), 6 project-scope.

| Family (rules)                                                                                                                                                                                                                                                                      | Source                                                                                                                                                                                                                                                                                                                                                                                                 | Rendered                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Component / source** (49): every `componentRule`, `kitModuleRule`, and `sourceFiles`/`components` rule — Correctness, Security, Architecture, the component-scoped Performance and Accessibility rules, `seo/ssr-disabled`                                                        | the same files on every surface; `--route` skips them (no route to attribute to)                                                                                                                                                                                                                                                                                                                       | never re-evaluated — the rendered pass has no source                                                                                                                                                                                  |
| **Head presence** (11, `headTagRule` + `title-presence`): `title-presence`, `description-presence`, `canonical-url`, `og-image`, `og-title`, `og-description`, `og-url`, `twitter-card`, `json-ld`, `charset`, `viewport`                                                           | each route's `<head>` composed from `<svelte:head>` in the page and its layout chain, followed into repo-local components (depth-limited), the known meta components (`svelte-meta-tags`, `svelte-seo`) and any you declare in `metaComponents`; a value that is not literal (`{data.title}`) is `dynamic`, judged by `treatDynamicAs`; `app.html` is not read, so `charset`/`viewport` report nothing | the shipped `<head>`; every value literal, `treatDynamicAs` moot; the build pass covers prerendered routes only; `charset`/`viewport` run here only                                                                                   |
| **Head content** (16): the five `json-ld-*`, `json-ld-validity`, `indexability`, `hreflang`, `title-length`, `description-length`, `duplicate-title`, `duplicate-description`, `performance/preload-missing-as`, `font-preload-crossorigin`, `render-blocking-script`, `preconnect` | the same composition, but only a **literal** value is judged — a dynamic JSON-LD body, `content`, `href`, or text is not examined, not `dynamic`; `--route` narrows the uniqueness pair's comparison set to the matched routes                                                                                                                                                                         | the shipped `<head>`, everything literal; the uniqueness pair compares the prerendered routes, and the dashboard live layer leaves it to static                                                                                       |
| **Image** (5): `image-dimensions`, `image-loading-hint`, `lcp-image`, `responsive-image`, `seo/image-alt`                                                                                                                                                                           | `<img>` in the page and its layout chain only — not in child components; attribute presence counts and a spread counts as present; `lazy` needs a literal `loading="lazy"`                                                                                                                                                                                                                             | every `<img>` in the shipped body; findings anchor to the HTML file (build) or the route (dashboard) with no source line, so an inline directive reaches only the source-mode finding                                                 |
| **Heading** (2): `single-h1`, `heading-level-skip`                                                                                                                                                                                                                                  | documented on the pages (relabel only)                                                                                                                                                                                                                                                                                                                                                                 | documented                                                                                                                                                                                                                            |
| **a11y route** (5): `required-element`, `duplicate-landmark`, `top-level-landmark`, `id-duplication`, `no-missing-id-ref`                                                                                                                                                           | documented (relabel only)                                                                                                                                                                                                                                                                                                                                                                              | documented; `required-element` adds: the dashboard live layer does not evaluate it, the static result stands                                                                                                                          |
| **Project** (6): `robots-txt`, `sitemap-xml`, `sitemap-in-robots`, `html-lang`, `performance/minify-disabled`, `a11y/doctype`                                                                                                                                                       | robots/sitemap: file or endpoint in the repo, same on every surface (also under `--route`); `html-lang`: `src/app.html`; `minify-disabled`: literal `vite.config.*` (documented); `doctype`: `src/app.html`                                                                                                                                                                                            | robots/sitemap: same check; `html-lang`: the shipped `<html lang>`; `minify-disabled`: the resolved Vite config (documented); `doctype`: nothing — the build pass never reads `app.html`. The dashboard live layer runs none of these |

## What changes

1. Every rule page (en + ja) carries a `## Mode differences` / `## モードによる違い` section.
   New sections go before `## Disabling`; the seven existing ones stay where they are and are
   relabelled; `a11y/required-element` promotes `### Mode differences` / `### モードの違い` to the
   `##` headings. Family boilerplate is one fixed paragraph per family in each language, so the
   bulk diff is mechanically checkable; the tailored pages are `charset`, `viewport`, the
   uniqueness pair, the length pair, `html-lang`, `doctype`, `minify-disabled`,
   `required-element`.
2. Inline mode claims move into the section so each is said once, and wrong ones are corrected:
   the 15 "by both the CLI and the Vite plugin … `--route` skips it" pages;
   `performance/heavy-import` and `namespace-import` ("Static (CLI) analysis" — the plugin build
   runs them too); `correctness/prop-mutation`, `seo/json-ld-validity`,
   `architecture/doc-link-target`, `reserved-name-placement`; `seo/charset`, `viewport`;
   `performance/minify-disabled`'s CLI-vs-plugin paragraphs (kept, under the new heading).
3. `a11y/doctype`'s "CLI only" becomes source-analysis wording naming the surfaces — the
   dashboard's static baseline reports it today.
4. Stale source comments: `RuleContext.components` ("static/CLI mode only") in
   `packages/core/src/rule.ts`, and `ResolvedHead.file` ("static mode only") in
   `packages/core/src/head.ts` — the build pass's source collector fills the first, the rendered collector the second.
5. `--route` is a lever whose effect on rule families is stated on 49 pages but not at the lever:
   `guides/(setup)/cli.md` (en + ja) `### --route` says component-scoped rules are skipped, the
   uniqueness pair compares only the matched routes, and project rules still run.
6. Guard: `packages/cli/test/docs-links.test.ts` gains "every rule page has a Mode differences
   section (en + ja)", anchored as a `##` heading line (`/^## Mode differences$/m`,
   `/^## モードによる違い$/m`) so a `###` does not satisfy it.
7. Guides carry no rule counts (grepped: none); embedded CLI docs make no mode claims (grepped:
   none) — nothing to change there.

## Not changed

- No third "dashboard" column on rule pages (above).
- `## Limitations` sections: the known-limitation half of D-13 was discharged by the D-12 sweep
  (`2026-08-19-known-limitation-sweep.md`); no empty "none" sections are added. Mode-specific
  limitations (line 0 in rendered, `--route` skipping component rules) live in the new section.
- `single-h1.ts`'s "static mode only" comment is correct (component headings are source-only) and
  stays.
