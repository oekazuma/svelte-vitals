# v1 holdout 8 — selection (2026-09-27)

The eighth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–7 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: holdout 7's pool (holdout 3's repository search, the code searches of holdouts 4–7 and
holdout 5's discovery), plus three new rounds of code search. The first (24 queries) aimed at the
shapes holdout 7's fixes touched and at head components: `<h1>` next to `{#if isHome}`,
`{#if title}`, `{#if variant ===`, `{#if heading}`, `{#if isHomepage}` and `{#if showTitle}`; JSON-LD
next to `{@html`, JSON-LD in a file without `<svelte:head>`, `{@html jsonLd` and `{@html schema`; and
imports of `Seo`, `SEO`, `Head`, `Meta`, `SiteMetadata`, `Metadata`, `PageMeta`, `OpenGraph`,
`SeoHead`, `MetaHead`, `HeadMeta` and `PageTitle`, reading each hit's match fragment for the specifier
it imports from. For item 12, the npm dependencies of every repository in the pool (5,845 packages, 31
of them SEO and CMS packages named by hand) were listed on jsDelivr, and each package's `.svelte` files
with a head-like name were read for `<svelte:head>`. That found head components in `@hyzer-labs/ui`,
`svelte-cloudinary` (`CldOgImage`), `@immich/ui`, `@svelteuidev/core`, `@thisux/sveltednd`,
`runes-meta-tags`, `@datocms/svelte`, `@sveltinio/seo`, `@misiki/kitcommerce-core`, `@foxui/core`,
`svelte-ux` (`AppBar`'s `<title>`), `sk-seo`, `@shelchin/seo-sveltekit` and `@beeblock/svelar`. The
second round (11 queries) and the third (3) searched for users of those packages.

10,047 repositories came back; 4,934 remained after dropping the 146 of the 158 excluded repositories
that appeared (the 112 corpus apps and every candidate and runner-up of earlier holdouts) and 4,967 with
no push in six months; 1,704 had at least 10 routes and a lockfile; 1,546 were on Svelte 5 and Kit 2;
1,446 remained after dropping 62 app directories named `docs`, `site`, `examples`, `templates`,
`tests`, `demo` or similar, and 38 copies or mirrors of an excluded app (found by package name or
description). 137 were read from a shallow clone. None of the 137 was read in an earlier round; 221 of
the 1,446 had been, and none of those was read again or taken. Push dates for the 8,891 repositories
already in holdout 7's pool came from that snapshot, taken earlier the same day; the 1,156 new ones
were fetched fresh. The 21 finalists (picks and runners-up) were re-fetched at pin time, and every
pinned SHA equals the clone that was read. Nothing was installed, built or run; the head components of
npm packages (`@hyzer-labs/ui`, `@inlang/paraglide-sveltekit`, `svead`) were read from their published
files at the versions the apps' lockfiles resolve.

The filters are unchanged: a real application (not a docs site, component gallery, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 21 of the 137 were rejected because more of their components
use `export let` than runes. Each pick's lockfile was compared with its `package.json` (every declared
range against the `packages[""]` entry of `package-lock.json`, the importer of `pnpm-lock.yaml`, the
workspace block of `bun.lock`): all 14 agree, with one wrinkle in aid-ly (see Notes). No pick has a
`.gitmodules` file, uses a private registry, or has a `file:` dependency; the one `link:` is
knowledgebasket.org's link to itself (see Notes); aqsha's three workspace
dependencies are all in the checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                             | Path                    | Checklist         | Prerenders | Builds | Why                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [tjheffner/heffdotdev](https://github.com/tjheffner/heffdotdev/tree/f75ac6912076)                               | `.`                     | 5, 9, 9b, 10, 12  | yes        | yes    | 14 of 16 pages take their head from `Metatags` in the npm package `@hyzer-labs/ui`, through a local wrapper; mdsvex posts.               |
| [AdiCahyaSaputra/forumgw-v2](https://github.com/AdiCahyaSaputra/forumgw-v2/tree/315850fcd02b)                   | `.`                     | 2, 3, 10          | no         | no     | hreflang alternates (`en`, `id`) rendered by `ParaglideJS` from the installed `@inlang/paraglide-sveltekit`; superforms.                 |
| [MilkWithKnives/FSM](https://github.com/MilkWithKnives/FSM/tree/328309b62ba3)                                   | `.`                     | 1, 8, 10          | no         | no     | `FAQPage` JSON-LD emitted with `{@html}` in the page body; `LocalBusiness`; adapter-node with hooks and actions.                         |
| [nino-chavez/nino-chavez-photography](https://github.com/nino-chavez/nino-chavez-photography/tree/6a26d22dfb6a) | `.`                     | 1, 6, 10          | no         | no     | Literal `paths.base: "/photography"` with `relative: false`; `FAQPage` JSON-LD; a component from an awaited `import()`.                  |
| [barbi1001/eco](https://github.com/barbi1001/eco/tree/4471e56d178e)                                             | `eco`                   | 1, 4, 9, 10       | no         | yes    | svead `<Head>` at 0.0.4, older than the API its adapter describes, with props it does not declare; `LocalBusiness` JSON-LD in app.html.  |
| [Joshjess/honeylink-website](https://github.com/Joshjess/honeylink-website/tree/0aba2a4986b9)                   | `.`                     | 1, 3, 4, 5, 8, 10 | yes        | no     | svelte-meta-tags `MetaTags` and `JsonLd`; mdsvex `.md` components rendered from load data as `<ContentComponent />`; superforms.         |
| [janvier-s/catechismecatholique](https://github.com/janvier-s/catechismecatholique/tree/57e9d0a5c637)           | `.`                     | 1, 9, 9b, 10      | yes        | yes    | 84-route reference site, 48 prerendered route files; head and JSON-LD from a local `MetaTags` component; `<abbr>` without a title.       |
| [haydenkoch/knowledgebasket.org](https://github.com/haydenkoch/knowledgebasket.org/tree/77162ec2c764)           | `.`                     | 1, 8, 9, 10       | no         | yes    | `KbHero` renders its `<h1>` inside `{#if title}` on five pages; 93 routes, 63 action files on adapter-node.                              |
| [rricajos/superyayas](https://github.com/rricajos/superyayas/tree/5b5386bbc02a)                                 | `.`                     | 1, 2, 3, 8, 10    | no         | no     | hreflang alternates with `x-default` from a layout component; superforms; 119 routes, 65 action files.                                   |
| [maxdorninger/MediaManager](https://github.com/maxdorninger/MediaManager/tree/98f253238c78)                     | `web`                   | 3, 6, 7, 10       | no         | no     | SPA (root `ssr = false`, adapter-static fallback); `paths.base` from `BASE_PATH`; superforms.                                            |
| [convertigo/convertigo](https://github.com/convertigo/convertigo/tree/0c32d1464cfb)                             | `convertigo-studio-web` | 6, 9, 9b, 10      | yes        | yes    | `Topbar` renders its `<h1>` only for `variant === 'studio'`, and the layout never passes `variant`; `paths.base` from an env expression. |
| [manikandareas/aqsha](https://github.com/manikandareas/aqsha/tree/ff9ed1fc76bd)                                 | `apps/web`              | 1, 9, 9b, 10, 11  | yes        | yes    | UI from the workspace package `@aqsha/ui-svelte` (source, wildcard `./components/*` exports); `<h1>` behind a `variant` prop.            |
| [hms-dbmi/PIC-SURE-Frontend](https://github.com/hms-dbmi/PIC-SURE-Frontend/tree/803fa3e9460a)                   | `.`                     | 7, 9, 10          | no         | yes    | 31-route data explorer with `ssr = false` on two pages; `Content` renders its `<h1>` inside `{#if title}`.                               |
| [aid-ly/aid-ly](https://github.com/aid-ly/aid-ly/tree/9d6eeec7b2a7)                                             | `.`                     | 1, 2, 8, 10       | no         | no     | Head component (JSON-LD via `{@html}`, alternates plus `x-default`) placed in `<svelte:head>` by each caller; `[lang=lang]` routes.      |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 9    |
| 2   | i18n + hreflang                             | 3    |
| 3   | superforms                                  | 4    |
| 4   | meta-tag library                            | 2    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 2    |
| 8   | adapter-node, hooks, form actions           | 5    |
| 9   | likely builds without services              | 7    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 1    |
| 9b  | prerenders pages and likely builds          | 4    |

Item 12 has one app again. 14 of heffdotdev's 16 pages render `src/lib/components/Metatags.svelte`
(`resume` has no head tags and `christmas` writes its own), which renders `Metatags` from `@hyzer-labs/ui` (0.8.0 in its `package-lock.json`). The package's `.` export
resolves under the `svelte` condition to `./dist/index.js`, which re-exports `./components/index.js` (line 54: `export { default as Metatags } from
'./Metatags.svelte'`);
`dist/components/Metatags.svelte` puts `<title>`, description, canonical, og:\* and twitter:\* inside
`<svelte:head>`, each behind `{#if}` on its prop. It was read from the package's published files, and
the lockfile agrees with `package.json`, so it is likely to install. No second app with an npm head
component passed the filters: the other packages' users in the pool use the package only for other
components (`svelte-cloudinary`, `@immich/ui`, `@thisux/sveltednd`, `svelte-ux`), have not pushed in
six months or have fewer than 10 routes (the `CldOgImage`, `@datocms/svelte` and `runes-meta-tags`
apps), are the package's own demo or icon sites (`runes-meta-tags`), are copies of an excluded app
(`@misiki/kitcommerce-core`), fail the runes filter (`@svelteuidev/core`), or are excluded or were read in earlier rounds
(`sk-seo`, `@foxui/core`, `@shelchin/seo-sveltekit`, `@beeblock/svelar`). One more app exercises the same installed-package path with head content: forumgw-v2's
hreflang alternates come from `ParaglideJS` in `@inlang/paraglide-sveltekit` (0.15.5 in its
`pnpm-lock.yaml`), whose `dist/runtime/ParaglideJS.svelte` renders `AlternateLinks.svelte` inside `<svelte:head>`, one
`<link rel="alternate">` per language tag. It counts for item 2, as `ParaglideJS` users did in holdouts 6 and 7.

Item 6 counts nino-chavez-photography (a literal base) and two apps whose base comes from an
environment variable that is unset on the runner (MediaManager `BASE_PATH`, convertigo
`C8O_STUDIO_BASE`), as holdout 7 counted hister. eco's base is `'./'` only when `TAURI_PLATFORM` is
set, so it is not counted. Item 7 counts PIC-SURE, a dashboard with `ssr = false` on two pages, beside
MediaManager's SPA. Item 8 counts only adapter-node apps with both hooks and form actions; aqsha and
PIC-SURE have hooks but no actions.

Shapes holdout 7's fixes touched:

- **An `<h1>` behind a prop:** convertigo's `Topbar` (`{#if variant === 'studio'}`, default `'app'`,
  rendered by `(app)/+layout.svelte` without `variant`) is the exact shape of the prop-gated `<h1>`
  class; knowledgebasket.org's `KbHero` and PIC-SURE's `Content` gate the `<h1>` on `{#if title}` with
  routes that pass a title; aqsha's `ArtifactDetailView` gates it on `variant === 'panel'`, which one
  caller passes and another does not. catechismecatholique (`{#if multiLabel}`) and superyayas
  (`{#if isFamilyView}`) gate a route-level `<h1>` on local state.
- **JSON-LD in `<body>`:** FSM's `(photo)/faq/+page.svelte` emits `FAQPage` JSON-LD with `{@html}`
  outside `<svelte:head>`. grantmakers-next, aid-ly and ControlForge's head components look body-placed
  in their own files, but every caller puts them inside `<svelte:head>`; aid-ly is picked with that
  shape (a `{@html}` JSON-LD component placed in the head by its callers). The app with the most
  body-placed JSON-LD (flow-arts-composer, 16 public pages) is a runner-up; see Notes.
- **Constant lists copied with a spread:** FSM copies an imported list
  (`[...allProperties.filter(...), ...]`) before `{#each}`, but its `{#each}` blocks are keyed; no pick
  iterates, without a key, an imported list that its module builds with `[...LIST, x]`. The shape was not
  found in a pick.
- **An mdsvex component a page renders:** honeylink-website passes each `.md` module through load data
  and renders it as `<ContentComponent />` (`const ContentComponent = $derived(data.content)`).

Other shapes: svead 0.0.4, whose `Head` takes `url`, `title`, `description` and `image` and renders
og:\* only with `image`, called with `canonical` and `openGraph` props it does not declare, while the
svead adapter describes the `seo_config` API of 0.0.10 and later (eco); `<title>`, canonical and og:\*
in `app.html` as well as from the page (eco); UI from a workspace package through wildcard subpath
`exports` (aqsha); a component from an awaited `import()` (nino-chavez-photography,
catechismecatholique); `app.html` placeholders filled by `transformPageChunk` (`%lang%` in aid-ly).

## How the first look runs

As in holdouts 5–7, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets: each app is cloned at its pin, its git
submodules are fetched, and it is installed with the package manager of the nearest lockfile (pnpm,
bun, npm or yarn, in that order); then `scripts/corpus-measure.js run` measures that checkout with the
packed CLI, before the build rewrites anything. A pnpm install that fails only on unapproved build
scripts (`ERR_PNPM_IGNORED_BUILDS`) is retried with `--ignore-scripts`. An `npm ci` that rejects a
lockfile out of sync with `package.json` (`EUSAGE`) falls back to `npm install`, and one that fails on
an install script is retried with `--ignore-scripts`; both are new since holdout 7's first look, as is
the submodule fetch. Git LFS objects are not downloaded (`GIT_LFS_SKIP_SMUDGE=1`): the analysis reads
no binary asset, and a missing object would otherwise fail the checkout (new for this holdout, for FSM). The per-app results, in `holdout.json` order, make up the first-look file. An app
whose install fails is measured uninstalled, and the result records which apps were. The criteria and
their thresholds are unchanged.

## Rules without real-app evidence that these apps may exercise

75 of 105 rules have evidence in `scripts/corpus/measurement.json`. Nine of the other 30 do nothing
under the default config, so no first run can give them evidence: `a11y/disallowed-element`,
`a11y/required-element`, `a11y/unverified-id-ref` (off by default), and the six `architecture/`
convention rules (`directory-naming`, `doc-link-target`, `private-scope-import`,
`reserved-directory-names`, `reserved-name-placement`, `unit-entry-file`). Signals found by grepping
the source for the rest (a signal is not a finding):

- `seo/hreflang`: alternates per locale plus `x-default` from superyayas's `HreflangTags` and aid-ly's
  `SEO`; `en` and `id` alternates without `x-default` from forumgw-v2's installed `ParaglideJS`
- `seo/json-ld-deprecated-type`: `FAQPage` in FSM, nino-chavez-photography, eco, catechismecatholique,
  superyayas and aqsha
- `seo/json-ld-required-props`: `LocalBusiness` in FSM and eco (eco's in `app.html`), `WebSite` in
  catechismecatholique, knowledgebasket.org and aqsha, `BreadcrumbList` in superyayas and
  honeylink-website (the rule fires only when a required property is missing)
- `seo/json-ld-date-format`: the literal `datePublished: '1992'` in catechismecatholique's
  `telecharger/+page.svelte`; the other dates come from data
- `a11y/abbr-title`: `<abbr>A.M.D.G.</abbr>` in catechismecatholique's `Footer.svelte`
- `performance/preconnect`: heffdotdev's `christmas` page loads a Google Fonts stylesheet with no
  preconnect
- `performance/font-preload-crossorigin`: honeylink-website, catechismecatholique and FSM preload
  fonts in `app.html`, all with `crossorigin`, so a finding there would be wrong

No pick uses `accesskey`, an unknown role or `aria-*` name, a duplicate `<dt>`, `bind:value` on a
checkbox, a lifecycle call or `$effect` at module scope, a preload without `as`, or `minify: false`;
every `app.html` has a doctype, a charset and a viewport.

## Notes

- License: MediaManager and convertigo are AGPL-3.0, superyayas GPL-3.0, PIC-SURE Apache-2.0,
  heffdotdev and forumgw-v2 MIT; the other eight have no license file. The measurement reads the source
  and redistributes nothing.
- Design share (C8): eight picks are public sites (heffdotdev, FSM, nino-chavez-photography, eco,
  honeylink-website, catechismecatholique, knowledgebasket.org, aid-ly). Six are mostly behind sign-in:
  MediaManager and convertigo entirely, superyayas and forumgw-v2 outside their public pages, aqsha's
  app side (its marketing pages are public), and PIC-SURE's authorized dataset and admin areas.
- eco's README is the create-svelte default; its routes, head and JSON-LD are a Hebrew jewellery
  studio's site with an order admin. heffdotdev still has 12 components on `export let` (23 on runes).
  forumgw-v2 keeps the sv template's `demo` routes. knowledgebasket.org lists sveltekit-superforms but
  no file imports it, so it is not counted for item 3.
- Install risks: FSM tracks its images and videos with Git LFS and its build script refuses LFS
  pointers; the harness checks it out without LFS objects, so the measurement reads the source and the
  build stops at that check. aid-ly declares `tailwindcss` and `@tailwindcss/vite` in both `dependencies` (`^4.1.11`, which
  the lock records) and `devDependencies` (`^4.0.0`); a frozen pnpm install that rejects it falls back
  to `--no-frozen-lockfile`. knowledgebasket.org lists itself as `"site": "link:"` and sets
  `onlyBuiltDependencies`. heffdotdev's `postinstall` runs `svelte-kit sync && wrangler types` (a
  failing install script is retried with `--ignore-scripts`). Package-manager pins: FSM pnpm 11.24.0
  and aid-ly pnpm 11.5.0 through `packageManager`; honeylink-website bun 1.3.14 and aqsha bun 1.3.10.
  honeylink-website, aqsha and forumgw-v2's `paraglide` output are generated or installed with bun or at
  build time; convertigo and MediaManager are subdirectories of large non-JS repositories.
- Builds: `$env/static` imports stop forumgw-v2, honeylink-website, superyayas and MediaManager without
  their env files; nino-chavez-photography's build script runs repository checks before `vite build`;
  aid-ly needs a generated Prisma client. convertigo's adapter-static writes outside the app directory.
- Runners-up, read and not picked: ShockIsTaken/Shuna, Jeffreyyvdb/MusicHoarder,
  onmagnoliasquare/website, telaaron/NurEine, Shiyinq/mypage48, anomaliaso/anomalia and
  austencloud/flow-arts-composer. flow-arts-composer has the richest body-placed JSON-LD but 263
  routes, seven `file:`/`link:` workspace dependencies and a `canvas` specifier that disagrees with its
  `pnpm-lock.yaml`; anomalia's 202 routes and 66 action files would dominate the finding count.
