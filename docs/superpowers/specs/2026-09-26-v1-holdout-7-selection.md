# v1 holdout 7 — selection (2026-09-26)

The seventh holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–6 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: holdout 6's pool (holdout 3's repository search, holdout 4's and 5's code searches, holdout
5's discovery and holdout 6's code searches), plus two new rounds of code search. The first (19
queries) aimed at the shapes holdout 6's fixes touched and at head packages: `additionalMetaTags`,
workspace packages built with `svelte-package` into `dist/`, apps under `apps/` depending on
`workspace:*` packages, `import * as` next to `interface Props`, `<svelte:head>` with `hreflang`,
JSON-LD next to `$derived`, `ssr = false` layouts, and the npm head packages `sk-seo`, `svelte-head`,
`@opensky/seo`, `@svaio/meta`, `@opinly/sveltekit`, `@rgglez/svelte-seo`, `svelte-meta-tags-runes`,
`@shelchin/seo-sveltekit` and `@unhead/svelte` (names taken from the npm registry search). The second
(11 queries) searched for `Seo`, `SEO`, `Head`, `Meta`, `MetaTags`, `PageHead` and `SeoHead` imports
and read each hit's match fragment for the specifier it imports from.

8,891 repositories came back; 4,334 remained after dropping the 124 of the 138 excluded repositories
that appeared (the 98 corpus apps and every candidate and runner-up of earlier holdouts) and 4,433
with no push in six months; 1,566 had at least 10 routes and a lockfile; 1,422 were on Svelte 5 and
Kit 2; 1,327 remained after dropping 61 app directories named `docs`, `site`, `examples`, `templates`,
`tests`, `demo` or similar, and 34 copies or mirrors of an excluded app (found by package name or
description). 80 were read from a shallow clone. None of the 14 picks was read in an earlier round;
167 of the 1,327 had been, and none of those was taken. Push dates and fork/archived flags for
repositories already in holdout 6's pool came from that snapshot, taken the same day; the rest were
fetched fresh. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned
SHA equals the clone that was read. Nothing was installed, built or run; the head components of two
npm packages (`@beeblock/svelar`, `@immich/ui`) were read from their published files.

The filters are unchanged: a real application (not a docs site, component gallery, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 5 of the 80 were rejected because more of their components use
`export let` than runes. Each pick's lockfile was also compared with its `package.json` (the
`packages[""]` entry of `package-lock.json`, the importer of `pnpm-lock.yaml`, the workspace block of
`bun.lock`): 13 of 14 agree; Verdagraph's does not (see Notes). None uses a private registry or a
`link:`/`file:` dependency.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                             | Path           | Checklist       | Prerenders | Builds | Why                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | -------------- | --------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [beeblock/orkestrai](https://github.com/beeblock/orkestrai/tree/9798ade4e1aa)                   | `.`            | 3, 8, 10, 12    | no         | no     | The site-wide head is `Seo` from the npm package `@beeblock/svelar`, reached through a `.ts` barrel; superforms, 9 actions.  |
| [Verdagraph/Webapp](https://github.com/Verdagraph/Webapp/tree/d4fe44c73d26)                     | `apps/web`     | 7, 10, 11       | no         | no     | All UI from a workspace package whose `exports` point only into a gitignored `dist/` built from `src/` (192 `.svelte`).      |
| [shuffle-project/blinddate](https://github.com/shuffle-project/blinddate/tree/04534b16c79c)     | `.`            | 4, 9, 9b, 10    | yes        | yes    | svelte-meta-tags with `additionalMetaTags` in three places; the whole site prerenders to static files.                       |
| [mony-dropout/lifeatuni](https://github.com/mony-dropout/lifeatuni/tree/15c2f649c9e3)           | `apps/app`     | 1, 9, 10, 11    | no         | yes    | Head (title, og:\*, JSON-LD) from a workspace package's `Seo`, exported as source; 30 action files on Cloudflare.            |
| [SiMiTaKu/imrg-platform](https://github.com/SiMiTaKu/imrg-platform/tree/5b396c9d70a2)           | `web`          | 1, 2, 9, 9b, 10 | yes        | yes    | Feature-Sliced layout: head from `@widgets/layout` via `kit.alias`, hooks moved by `kit.files.hooks`, viewport in layout.    |
| [megany128/sklonuj](https://github.com/megany128/sklonuj/tree/5a987078ee3c)                     | `.`            | 1               | no         | no     | `FAQPage` and `WebSite` JSON-LD with literal dates; literal `hreflang` plus `x-default` on an English-only site.             |
| [twangodev/uwcourses](https://github.com/twangodev/uwcourses/tree/0797c6e67d37)                 | `.`            | 1, 5, 9, 9b, 10 | yes        | yes    | Prerendered mdsvex blog (`.svx`) with `BreadcrumbList` JSON-LD from the layout; components from awaited dynamic imports.     |
| [AlchemillaHQ/Sylve](https://github.com/AlchemillaHQ/Sylve/tree/0245cabf18f1)                   | `web`          | 7, 9, 10        | no         | yes    | 75-route FreeBSD management SPA, root `ssr = false`, adapter-static.                                                         |
| [simonhackler/digitable](https://github.com/simonhackler/digitable/tree/fe97d9f329a1)           | `packages/app` | 3, 6, 8, 10, 11 | no         | no     | Literal `paths.base: '/app'`; adapter-node with hooks, actions and superforms; editor from a workspace package (source).     |
| [jjh4450/KAIROS-Landing-Page](https://github.com/jjh4450/KAIROS-Landing-Page/tree/86555087f713) | `web`          | 4, 10           | no         | no     | svelte-meta-tags through a local wrapper with `additionalMetaTags`, used by 8 pages; `%paraglide.lang%` from hooks.          |
| [weelone/echobell.one](https://github.com/weelone/echobell.one/tree/254fce050150)               | `.`            | 1, 2, 9, 9b     | yes        | yes    | Localized, prerendered site: `hreflang` alternates from a `Meta` component, `FAQPage` JSON-LD, `%echobell.lang%` from hooks. |
| [MoldyTaint/Cinephage](https://github.com/MoldyTaint/Cinephage/tree/5f1279a6a1f6)               | `.`            | 8, 9, 10        | no         | yes    | 54-route self-hosted media manager on adapter-node with hooks and actions, no `$env/static` imports.                         |
| [Alia5/steaminputdb.com](https://github.com/Alia5/steaminputdb.com/tree/b5f29b8b5cdd)           | `frontend`     | 1, 5, 10        | no         | no     | `.svx` files imported as components; JSON-LD; a `(buddy-app)` group with `ssr = false`.                                      |
| [asciimoo/hister](https://github.com/asciimoo/hister/tree/25dccadb8667)                         | `webui/app`    | 6, 9, 10, 11    | no         | yes    | `paths.base` from an expression; UI from an npm workspace package through wildcard subpath `exports` (`./ui/*`).             |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 6    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 2    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 2    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 8    |
| 10  | component-resolution shapes                 | 12   |
| 11  | UI from a workspace package                 | 4    |
| 12  | head from an npm package without an adapter | 1    |
| 9b  | prerenders pages and likely builds          | 4    |

Item 12 has one app again. orkestrai's root layout renders `Seo` from `@beeblock/svelar/ui` (0.7.9 in
its lock); the package's `./ui` export resolves under the `svelte` condition to `./src/ui/index.ts`,
which re-exports `src/ui/Seo.svelte`. That component puts `<title>`, description, canonical, robots,
og:\*, twitter:\* and JSON-LD inside `<svelte:head>` behind `{#if}` on each prop; it was read from the
package's published files. No other npm head component turned up in a candidate that passes the
filters. `@immich/ui`'s `SiteMetadata` renders a full head, but its users outside the excluded Immich
app are docs sites, a five-route landing page, or small apps in the Immich organisation. svelte-ux
`AppBar`, `@foxui/core` `Head`, `sk-seo` and `runes-meta-tags` users in the pool were read in earlier
rounds, fail the runes filter (velocity.report: 1 of 24 components on runes, 10 on `export let`), or
use the package only for other components. `ParaglideJS` users count for item 2, as in holdout 6.

Item 7 counts Verdagraph as well as Sylve because its root layout sets `ssr = false`; it was taken for
the workspace-`dist/` shape, not as a dashboard. sklonuj and lifeatuni have hooks and form actions
but run on Cloudflare, so they are not counted for item 8.

Shapes holdout 6's fixes touched:

- **A workspace package whose `exports` name only an unbuilt `dist/`:** Verdagraph's `@vdg-webapp/ui`
  (`exports["."]` = `{types: ./dist/index.d.ts, svelte: ./dist/index.js}`, `dist/` gitignored, built
  by `svelte-package --input=src`, so the source sits under `src/`, not `src/lib/`) supplies every UI
  component of 47 files. The head does not come from it; headings, images and a11y facts do.
- **svelte-meta-tags `additionalMetaTags`:** blinddate (a wrapper plus two direct uses; key
  `keywords` passed as `property`) and KAIROS (a wrapper; `theme-color`, `application-name`). Neither
  passes og:image through it.
- **Namespace imports next to TypeScript interfaces:** no pick has a `.svelte` file where a
  namespace import's name is also an interface or type-literal key. shadcn-style `import * as` is
  common (orkestrai, Sylve, hister, imrg-platform), so the rule itself is exercised.

Other shapes: heads from a workspace package exported as source (lifeatuni) and from a `kit.alias`
barrel (imrg-platform); `kit.files.hooks` moved to `src/app/hooks/` (imrg-platform); wildcard subpath
`exports` (hister); a component rendered from an awaited `import()` (uwcourses); `.svx` imported as
a component (steaminputdb.com); `app.html` placeholders filled by `transformPageChunk` (`%lang%` in
lifeatuni and imrg-platform, `%paraglide.lang%`/`%paraglide.dir%` in KAIROS, `%echobell.lang%` in
echobell.one); loads that end in `redirect()` or `error()` on every path (lifeatuni
`routes/+page.server.ts`, `auth/magic/consume/[token]`, `auth/verify/[token]`).

## How the first look runs

As in holdouts 5 and 6, the first look is measured installed, with the harness in
`scripts/holdout-build/` on GitHub-hosted runners with no token scopes and no secrets: each app is
cloned at its pin and installed with the package manager of the nearest lockfile (pnpm, bun, npm or
yarn, in that order), then `scripts/corpus-measure.js run` measures that checkout with the packed CLI,
before the build rewrites anything. A pnpm install that fails only on unapproved build scripts
(`ERR_PNPM_IGNORED_BUILDS`) is retried with `--ignore-scripts` after its `node_modules` are cleared. An
`npm ci` that fails on an install script (npm's "command failed", such as a root `postinstall`) is
retried the same way; this is new for this holdout, for orkestrai's `postinstall`.
The per-app results, in `holdout.json` order, make up the first-look file. An app whose install fails
is measured uninstalled, and the result records which apps were. The criteria and their thresholds
are unchanged.

## Rules without real-app evidence that these apps may exercise

74 of 105 rules have evidence in `scripts/corpus/measurement.json`. Nine of the other 31 do nothing
under the default config, so no first run can give them evidence: `a11y/disallowed-element`,
`a11y/required-element`, `a11y/unverified-id-ref` (off by default), and the six `architecture/`
convention rules (`directory-naming`, `doc-link-target`, `private-scope-import`,
`reserved-directory-names`, `reserved-name-placement`, `unit-entry-file`). Signals found by grepping
the source for the rest (a signal is not a finding):

- `seo/hreflang`: alternates for every locale from imrg-platform's `PageHead` (via `kit.alias`) and
  echobell.one's `Meta`; literal `en` plus `x-default` on each page of sklonuj
- `seo/json-ld-deprecated-type`: `FAQPage` in sklonuj (`resources/tips`) and echobell.one
  (`lib/jsonld.ts`)
- `seo/json-ld-required-props`: `WebSite` in lifeatuni, imrg-platform, sklonuj, echobell.one and
  steaminputdb.com; `BreadcrumbList` in uwcourses (the rule fires only when a required property is
  missing)
- `seo/json-ld-date-format`: literal dates in sklonuj (`datePublished` "2025-01-15" and others) and
  echobell.one (`dateModified` "2025-03-25"); the others come from data
- `seo/viewport`: imrg-platform's `app.html` has no viewport meta; its root layout's `<svelte:head>`
  has one, so a finding there would be wrong
- `performance/preconnect`: digitable loads a Google Fonts stylesheet in `app.html` with no preconnect
- `performance/font-preload-crossorigin`: uwcourses preloads a font in `app.html`, with `crossorigin`
- `correctness/server-browser-global`: Sylve reads `navigator` at module scope in
  `lib/hooks/is-mac.svelte.ts`, in an app whose root layout sets `ssr = false`
- `a11y/no-duplicate-dt`: steaminputdb.com repeats `Playtime` and `Sessions` terms inside one
  `config/[fileid]/sectionInfo.svelte` (possibly in nested lists)

No pick uses `accesskey`, an untitled `<abbr>`, an unknown role or `aria-*` name, `bind:value` on a
checkbox, a lifecycle call at module scope, a preload without `as`, or `minify: false`; every
`app.html` has a doctype and charset.

## Notes

- imrg-platform, digitable and echobell.one have no license file; blinddate's is CC BY-ND 4.0 and
  sklonuj's is not an SPDX match (both NOASSERTION). The measurement reads the source and
  redistributes nothing.
- digitable's home page is still the SvelteKit placeholder; its games, decks and playtest rooms sit
  behind sign-in. blinddate's `svelte.config.js` passes svelte-preprocess a legacy `css.write` option,
  and its `paths.base` is the literal `''` (the conditional base is commented out), so it does not
  count for item 6.
- orkestrai's build raises the heap to 12 GB, and Cinephage's to 8 GB; neither needs a service to
  build, but orkestrai is not counted as likely to build.
- Install risks: Verdagraph's lock records the specifier `svelte: 5.34.0` while `apps/web` asks for
  `^5.22.6`, so `pnpm install --frozen-lockfile` fails and the harness falls back to
  `--no-frozen-lockfile`; orkestrai's root `postinstall` runs patch-package (4 patches) and a node-pty
  helper, and electron and node-pty have install scripts (npm has no retry); imrg-platform pins
  pnpm 12.4.2 and echobell.one pnpm 11.13.0 through `packageManager`, and imrg-platform's `prepare`
  runs husky; uwcourses pins bun 1.4.0; uwcourses, digitable install with bun.
- Runners-up, read and not picked: texpile/texpile, EasyMetaAu/helm-api, HerrMuellerluedenscheid/hoister,
  ApeDevil/v10r, konoe-akitoshi/shumoku and crownshy/civic_os.
