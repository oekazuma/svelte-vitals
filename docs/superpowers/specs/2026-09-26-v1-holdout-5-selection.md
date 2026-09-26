# v1 holdout 5 — selection (2026-09-26)

The fifth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–4 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: code search for `.svelte` files importing a head-like component (`Seo`, `SEO`, `Head`, `Meta`,
`MetaTag`, `MetaTags`, `JsonLd`, `PageHead`, `SeoHead`) from a bare package specifier, for head
packages (`runes-meta-tags`, `sk-seo`, `@foxui/core`, `@fuxui/base`, svelte-ux's `AppBar`,
`@inlang/paraglide-sveltekit`'s `ParaglideJS`, flowbite-svelte's `MetaTag`, `@datocms/svelte`,
`@svelteuidev/core`, `@unhead/svelte`), for superforms, mdsvex and paraglide next to Svelte 5, for
`paths.base` read from `BASE_PATH`, and for JSON-LD next to `$props()`, plus holdout 4's code-search
pool and holdout 3's repository-search pool. 5,932 repositories came back; 2,975 remained after
dropping the 72 of the 95 excluded repositories that appeared (the 70 corpus apps and the other
candidates of earlier holdouts) and 2,885 with no push in six months; 1,211 had at least 10 routes and
a lockfile; 1,109 were on Svelte 5 and Kit 2; 1,023 remained after dropping 51 app directories named
`docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and 35 copies or mirrors of
another app (most of them copies of corpus apps such as immich, cobalt and windmill, found by package
name or description). 93 were read from a shallow clone. Nothing was installed, built or run; the head
components of four npm packages were read from their published files.

The filters are unchanged: a real application (not a docs site, component gallery, template or
demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 15 of the 93 were rejected because more of their components
use `export let` than runes.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                             | Path                     | Checklist          | Prerenders | Builds | Why                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------------- |
| [flo-bit/atmo-events](https://github.com/flo-bit/atmo-events/tree/ed2fb4279a6d)                                                 | `apps/web`               | 10, 12             | no         | no     | Events app whose layout head is `@foxui/core`'s `Head` (title, description, og, twitter).                 |
| [bocchio-web-lab/bocchio.dev](https://github.com/bocchio-web-lab/bocchio.dev/tree/8eb3691ecc74)                                 | `.`                      | 5, 10, 12          | yes        | no     | Head from `sk-seo` (a legacy-syntax package component); runtime mdsvex; `tabindex="1"` on the login form. |
| [PIWEEK/easyfest](https://github.com/PIWEEK/easyfest/tree/2bc2404d37a4)                                                         | `frontend`               | 2, 3, 8, 9         | no         | yes    | adapter-node with hooks, actions and superforms; hreflang alternates from `ParaglideJS`.                  |
| [Gamermaker-dev/Bria-nutrition](https://github.com/Gamermaker-dev/Bria-nutrition/tree/eef7e111fe13)                             | `.`                      | 3, 8, 9, 12        | no         | yes    | adapter-node with superforms; the `<title>` comes from svelte-ux's `AppBar`.                              |
| [Avi-ADAM/1.0](https://github.com/Avi-ADAM/1.0/tree/879dd9045600)                                                               | `.`                      | 1, 2, 4, 5, 10     | no         | no     | Large JavaScript app (130 routes) with svead, JSON-LD in `app.html` and hreflang stamped by hooks.        |
| [openbancor/catalogmx](https://github.com/openbancor/catalogmx/tree/d122ac955a0b)                                               | `packages/webapp-svelte` | 1, 6, 7, 9, 9b, 10 | yes        | yes    | Prerendered 94-route app under a conditional `paths.base`, `ssr = false` pages, JSON-LD (FAQPage).        |
| [istota-project/istota](https://github.com/istota-project/istota/tree/1bf5214ae948)                                             | `web`                    | 6, 7, 9, 9b, 10    | yes        | yes    | 52-route SPA (`ssr = false`) under a literal `kit.paths.base` (`/istota`).                                |
| [mazipan/baca-quran.id](https://github.com/mazipan/baca-quran.id/tree/18b375671673)                                             | `.`                      | 1, 9, 9b, 10       | yes        | yes    | Prerendered static app with schema-dts JSON-LD.                                                           |
| [open-reception/appointment-booking-software](https://github.com/open-reception/appointment-booking-software/tree/a9ef3f54772f) | `.`                      | 3, 8, 9, 10        | no         | yes    | adapter-node with hooks, 15 action files and superforms through shadcn form components.                   |
| [Trifall/cosmic](https://github.com/Trifall/cosmic/tree/a75412c81126)                                                           | `.`                      | 4, 8, 9, 10        | no         | yes    | adapter-node with hooks and actions; svelte-meta-tags from the root layout.                               |
| [langx/website](https://github.com/langx/website/tree/d89b572e3ec0)                                                             | `.`                      | 1, 5, 9, 9b, 10    | yes        | yes    | Prerendered mdsvex site (103 `+page.md` routes) with JSON-LD (BreadcrumbList, FAQPage).                   |
| [muni-town/roomy](https://github.com/muni-town/roomy/tree/1365910bbfbd)                                                         | `packages/app-lite`      | 7, 10, 11          | no         | no     | Chat SPA with UI from `@roomy/design` (151 `.svelte` files, source).                                      |
| [penxle/typie](https://github.com/penxle/typie/tree/5138e1e85b1d)                                                               | `apps/website`           | 7, 8, 10, 11       | no         | no     | UI from `@typie/ui` (source) in 338 files; a node adapter from the workspace; `ssr = false` dashboard.    |
| [aidotse/behovskartan](https://github.com/aidotse/behovskartan/tree/49fed0d2e5f3)                                               | `explorer`               | 2, 5               | yes        | no     | Prerendered static app with `ParaglideJS` alternates and mdsvex content.                                  |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 3    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 2    |
| 5   | markdown/mdsvex                             | 4    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 5    |
| 9   | likely builds without services              | 8    |
| 10  | component-resolution shapes                 | 11   |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 3    |
| 9b  | prerenders pages and likely builds          | 4    |

Item 12 is new. Following components from installed npm packages was added after holdout 4, so this
holdout includes three apps whose `<title>` and meta tags come from a package that has no adapter:
`@foxui/core`'s `Head` (atmo-events), `sk-seo` (bocchio.dev) and `svelte-ux`'s `AppBar`, whose `head`
prop defaults to true (Bria-nutrition). Each component was read from the package's published files.
The follow works only in an installed checkout, so this holdout's first look is measured installed
(see "How the first look runs").

Two of the item 2 apps, easyfest and behovskartan, get their alternate links from
`@inlang/paraglide-sveltekit`'s `ParaglideJS`, which renders only `<link rel="alternate">` tags. Those
alternates are visible only when the package is followed.

## How the first look runs

Holdouts 1–4 were measured on bare clones. A user runs the CLI in an installed project, and following
npm-package components needs one, so this first look is measured installed. The C2 harness in
`scripts/holdout-build/` now does both on GitHub-hosted runners with no token scopes and no secrets:
each app is cloned at its pin and installed with its own package manager, then
`scripts/corpus-measure.js run` measures that checkout with the packed CLI, before the build rewrites
anything. The per-app results, in `holdout.json` order, make up the first-look file. An app whose
install fails is measured uninstalled, and the result records which apps were. The criteria and
their thresholds are unchanged.

## Rules without real-app evidence that these apps may exercise

73 of 105 rules have evidence. Nine of the other 32 do nothing under the default config, so no
first run can give them evidence: `a11y/disallowed-element`, `a11y/required-element`,
`a11y/unverified-id-ref` (off by default), and the six `architecture/` convention rules
(`directory-naming`, `doc-link-target`, `private-scope-import`, `reserved-directory-names`,
`reserved-name-placement`, `unit-entry-file`). Signals found by grepping the source for the rest (a
signal is not a finding):

- `a11y/positive-tabindex`: bocchio.dev (`(identity)/auth/login/+page.svelte:105`, `tabindex="1"`)
- `seo/json-ld-deprecated-type`: `FAQPage` in catalogmx, langx and Avi-ADAM
- `seo/json-ld-required-props`: `WebSite` blocks in catalogmx and baca-quran, `BreadcrumbList` in langx
  and Avi-ADAM (the rule fires only when a required property is missing)
- `correctness/orphan-effect`: `$effect` inside functions in `.svelte.ts` modules (catalogmx, cosmic,
  istota, typie); none at module scope
- `seo/hreflang`: alternates in easyfest and behovskartan come from `ParaglideJS`, and in Avi-ADAM from
  `%hreflang%` in `app.html`, filled by `hooks.server.js`; none is a literal in the app's own source

JSON-LD dates in these apps are computed with `toISOString()`. No candidate uses `accesskey`, an
untitled `<abbr>`, duplicate `<dt>`, an unknown role or `aria-*` name, `bind:value` on a checkbox,
a lifecycle call at module scope, a font preload without `crossorigin`, a preload without
`as`, Google Fonts without a preconnect, or `minify: false`, and every `app.html` has a doctype,
charset and viewport. typie reads `navigator` at module scope, but in a plain `.ts` module
(`lib/editor-ffi/constants.ts:9`), which `correctness/server-browser-global` does not cover.

## Notes

- Bria-nutrition, Avi-ADAM/1.0 and Trifall/cosmic have no license file. The measurement reads the
  source and redistributes nothing.
- Avi-ADAM/1.0 commits both `package-lock.json` and `yarn.lock`; langx commits `package-lock.json` and
  `pnpm-lock.yaml`; cosmic's lockfile is `bun.lock`.
- roomy and typie were read, not run, during holdout 4's selection and were not picked. They are not
  in the exclusion list.
- atmo-events and roomy resolve a workspace package to `./dist`, so their builds need that package
  built first. typie's workspace packages include a Rust/WASM editor.
- catalogmx sets `paths.base` from `DEPLOY_TARGET`; istota's base is a literal.
- sk-seo's component is written in legacy syntax (`$:`, `$page`) inside a runes app.
