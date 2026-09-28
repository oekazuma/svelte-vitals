# v1 holdout 9 — selection (2026-09-28)

The ninth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–8 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: holdout 8's pool (the repository and code searches of holdouts 3–8 and holdout 5's discovery),
plus two new rounds of code search. The first (16 queries) aimed at the shapes holdout 8's fixes
touched and at the classes it left open: JSON-LD emitted from an `{#each}` (`{#each` next to
`jsonLd`, `schemas` or `structuredData`); an `<h1>` next to `typeof title`, `title.length` or
`{#if typeof`; a store `.set` next to `!browser` or `browser &&` in a universal `+layout.ts` or
`+page.ts`; a relative `paths.base` (`base: './'`, `relative: true`); and `<h1>` next to `{@html`, in
a `{#snippet}`, from `<svelte:element this={`h${…}`}>` or as `role="heading"` with `aria-level`. The
second (7 queries) looked for users of meta-tag libraries (`svelte-meta-tags` `MetaTags` in layouts
and pages, its `JsonLd`, `MetaTagsProps` and `deepMerge`, `svelte-seo`'s `SvelteSeo`, `@svelte-put/metatags`),
since no candidate from the first round used one.

11,650 repositories came back; 5,765 remained after dropping the 171 of the 179 excluded repositories
that appeared (the 122 corpus repositories and every candidate and runner-up of earlier holdouts) and
5,714 with no push in six months; 1,917 had at least 10 routes and a lockfile; 1,732 were on Svelte 5
and Kit 2; 1,609 remained after dropping 63 app directories named `docs`, `site`, `examples`,
`templates`, `tests`, `demo` or similar, and 60 copies or mirrors of an excluded app (found by package
name or description). 336 of the 1,609 had been read in an earlier round; none of those was read again
or taken. Of the 1,273 others, 332 had a hit from the new searches. 140 of them were read from a
shallow clone, taken round-robin across the nine shapes of the first round, highest-starred first;
one more (rescued) came from the second round, the only unread app there that is not a component
gallery, icon set, template or starter. Push dates for the 10,047 repositories already in holdout 8's
pool came from that snapshot, taken the day before; the 1,603 new ones were fetched fresh. The 21
finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone
that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component gallery, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 12 of the 141 were rejected because more of their components
use `export let` than runes. Each pick's lockfile was compared with its `package.json` (every declared
range against the `packages[""]` entry of `package-lock.json`, the importer of `pnpm-lock.yaml`, the
workspace block of `bun.lock`): 12 agree, two do not (see Notes). No pick has a `.gitmodules` file or
an `.npmrc` registry, and no pick's own `package.json` has a `file:` or `link:` dependency except
wordplay's `shared-types`, which is in the checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                       | Path            | Checklist       | Prerenders | Builds | Why                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | --------------- | --------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [jdegreef/ochorus](https://github.com/jdegreef/ochorus/tree/74e6d282ac9a)                 | `frontend`      | 1, 2, 7, 10     | yes        | no     | JSON-LD from `{#each structuredData as ld}{@html ld}` in its `Seo` component, a list whose name says neither JSON-LD nor `ld+json`; hreflang alternates.        |
| [MTES-MCT/boris](https://github.com/MTES-MCT/boris/tree/2154af23b31a)                     | `apps/frontend` | 1, 7, 10        | yes        | no     | `{#each schemas as schema}{@html toJsonLdScriptTag(schema)}` in `<svelte:head>`; `FAQPage` and `BreadcrumbList`; adapter-node with hooks.                       |
| [SkepticMystic/rescued](https://github.com/SkepticMystic/rescued/tree/1fdb244ef947)       | `.`             | 4, 10           | no         | no     | Head from `svelte-meta-tags` `MetaTags` with `deepMerge` in a local `SEO` component; an animal-shelter app on better-auth and Drizzle.                          |
| [intent-hq/cloudlands-fe](https://github.com/intent-hq/cloudlands-fe/tree/c35dc2b442f5)   | `.`             | 7, 9, 10        | no         | yes    | 1,253 components, one of them 305 KB (`ChatPanel.svelte`); SPA (root `ssr = false`); paraglide.                                                                 |
| [aolose/emm](https://github.com/aolose/emm/tree/e12fc7b746a0)                             | `.`             | 1, 5, 9, 10     | no         | yes    | Markdown blog engine; its root `+layout.ts` writes stores inside `if (browser)` in `load` and outside it; JSON-LD built in a server load.                       |
| [wihlarkop/applykit](https://github.com/wihlarkop/applykit/tree/aaf526040e55)             | `frontend`      | 7, 9, 10        | no         | yes    | Root `+layout.ts` sets `ssr = false` and writes an imported store in its universal `load`; adapter-node.                                                        |
| [jesposito/Facet](https://github.com/jesposito/Facet/tree/3b5ff9911749)                   | `frontend`      | 1, 8, 9, 10     | no         | yes    | `ProfileHero` renders its `<h1>` inside `{#if layout === 'centered'}` and other arms; JSON-LD through `{@html}` on the home page; adapter-node, hooks, actions. |
| [communisaas/commons](https://github.com/communisaas/commons/tree/043226125ba9)           | `.`             | 10              | no         | no     | 77 routes, 24 action files on adapter-cloudflare; route `<h1>`s behind `{#if orgs.length > 0}` and step state.                                                  |
| [getgrav/grav-admin-next](https://github.com/getgrav/grav-admin-next/tree/9f7399f1c568)   | `.`             | 6, 7, 9, 10     | no         | yes    | SPA; `paths.base` is `'/__GRAV_ADMIN2_BASE__'` when `ADMIN2_PLUGIN_BUILD` is set and `''` otherwise, with `relative: true`; components from awaited `import()`. |
| [nrock34/rwm-front](https://github.com/nrock34/rwm-front/tree/5ea319d053f5)               | `.`             | 3, 10           | no         | no     | sveltekit-superforms with 5 action files on adapter-cloudflare; an `<h1>` behind `{#if results.length}`.                                                        |
| [keithk/atmoBB](https://github.com/keithk/atmoBB/tree/1cab4afaab4b)                       | `.`             | 1, 8, 9, 10     | no         | yes    | Bulletin board on atproto: JSON-LD `{@html}` in the root layout, 32 action files on adapter-node; a heading level from `<svelte:element>` in `RichText`.        |
| [wordplaydev/wordplay](https://github.com/wordplaydev/wordplay/tree/11e11599e577)         | `.`             | 10              | yes        | no     | 459 components, `[[locale]]` routes, 12 prerendered route files; a heading from `<svelte:element>` in `Subheader`.                                              |
| [gentleloop-labs/patterns](https://github.com/gentleloop-labs/patterns/tree/11fc0594dee2) | `website`       | 1, 5, 9, 9b, 10 | yes        | yes    | mdsvex blog; JSON-LD from `{#each jsonLd as block}`; `Faq` renders its `<h1>` inside `{#if variant === 'page'}`.                                                |
| [0x5916/OpenCW](https://github.com/0x5916/OpenCW/tree/4b7f7b517d9b)                       | `frontend`      | 1, 2, 10        | yes        | no     | Morse trainer and forum: hreflang alternates with `x-default` and JSON-LD from `{#each structuredDataScripts}` in the root layout; paraglide.                   |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 7    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 1    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 2    |
| 9   | likely builds without services              | 7    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 1    |

Items 11 and 12 have no app. No candidate imports Svelte components from a workspace package, and no
unread candidate renders its head from an npm package the analyzer has no adapter for. Item 4 has one:
the other unread users of a meta-tag library in the pool are the library authors' component galleries,
icon sets, templates and starters. Item 6 counts grav-admin-next, whose base is a literal only under
an environment variable that is unset on the runner, as holdout 8 counted MediaManager and convertigo.
Item 8 counts only adapter-node apps with both hooks and form actions; boris has hooks but no actions.

Shapes holdout 8's fixes touched:

- **JSON-LD from `{#each}`:** four picks emit JSON-LD one item per iteration in `<svelte:head>`. The
  list's name says JSON-LD only in patterns (`jsonLd`); in boris the `{@html}` expression does
  (`toJsonLdScriptTag`); in ochorus (`structuredData` / `{@html ld}`) and OpenCW
  (`structuredDataScripts` / `{@html scriptTag}`) neither does.
- **An `<h1>` behind a prop compared to a literal:** Facet's `ProfileHero` (`layout === 'centered'`) and
  patterns's `Faq` (`variant === 'page'`). commons and rwm-front gate route `<h1>`s on local state
  (`orgs.length > 0`, `results.length`), not a prop.
- **A store write the browser guard decides:** emm's root `+layout.ts` writes stores inside
  `if (browser)` in `load` and outside it; applykit's writes an imported store in a universal `load`
  under `ssr = false`.
- **A very large component:** cloudlands-fe's `ChatPanel.svelte` is 305 KB.

Other shapes: headings from `<svelte:element>` (atmoBB, wordplay, ochorus); a conditional base with
`relative: true` (grav-admin-next); paraglide without `ParaglideJS` (ochorus, OpenCW, cloudlands-fe).

## How the first look runs

As in holdouts 5–8, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets: each app is cloned at its pin, its git
submodules are fetched, and it is installed with the package manager of the nearest lockfile (pnpm,
bun, npm or yarn, in that order); then `scripts/corpus-measure.js run` measures that checkout with the
packed CLI, before the build rewrites anything. A frozen pnpm or bun install that rejects its lockfile
falls back to a non-frozen one. A pnpm install that fails only on unapproved build scripts
(`ERR_PNPM_IGNORED_BUILDS`) is retried with `--ignore-scripts`. An `npm ci` that rejects a lockfile out
of sync with `package.json` (`EUSAGE`) falls back to `npm install`, and one that fails on an install
script is retried with `--ignore-scripts`. Git LFS objects are not downloaded. The per-app results, in
`holdout.json` order, make up the first-look file. An app whose install fails is measured uninstalled,
and the result records which apps were. The criteria and their thresholds are unchanged.

## Rules without real-app evidence that these apps may exercise

77 of 105 rules have evidence in `scripts/corpus/measurement.json`. Nine of the other 28 do nothing
under the default config, so no first run can give them evidence: `a11y/disallowed-element`,
`a11y/required-element`, `a11y/unverified-id-ref` (off by default), and the six `architecture/`
convention rules (`directory-naming`, `doc-link-target`, `private-scope-import`,
`reserved-directory-names`, `reserved-name-placement`, `unit-entry-file`). Signals found by grepping
the source for the rest (a signal is not a finding):

- `seo/hreflang`: alternates per locale plus `x-default` from OpenCW's root layout and ochorus's `Seo`
- `seo/json-ld-deprecated-type`: `FAQPage` in ochorus, boris and patterns
- `seo/json-ld-required-props`: `BreadcrumbList` in ochorus and boris; `WebSite` in ochorus, Facet,
  atmoBB, patterns and OpenCW (the rule fires only when a required property is missing)
- `a11y/invalid-role`: `role="pinned-user-prompt-bubble"` in cloudlands-fe's `PinnedUserPrompt.svelte`
- `correctness/orphan-effect`: `$effect(` in `.svelte.ts` modules of ochorus and rescued; whether any
  is outside an effect root is for the first look

No pick uses `accesskey`, an unknown `aria-*` name, a duplicate `<dt>`, `bind:value` on a checkbox, a
lifecycle call at module scope, a preload without `as`, or `minify: false`; every `app.html` has a
doctype, a charset and a viewport, and every font preload has `crossorigin`. The JSON-LD dates come
from data, not literals.

## Notes

- License: boris, applykit, Facet, commons, atmoBB, patterns and OpenCW are MIT, cloudlands-fe
  Apache-2.0; rwm-front and wordplay carry a license GitHub does not classify; ochorus, rescued, emm and
  grav-admin-next have no license file. The measurement reads the source and redistributes nothing.
- Design share (C8): eight picks are mostly public sites (ochorus, boris, emm, Facet, atmoBB, wordplay,
  patterns, OpenCW). Six are mostly behind sign-in or local: cloudlands-fe (an Electron renderer),
  applykit (local-first), grav-admin-next (a CMS admin), rescued, commons and rwm-front outside their
  public pages.
- rescued's `package.json` still carries its template's name (`app-starter-template`); its routes are
  its own (shelters, animals, inquiries). cloudlands-fe's `messages/en.json` matched the grep for text
  addressed to AI agents only on the label "Cycle attention agents"; it is UI copy.
- Install risks: rescued's `pnpm-lock.yaml` records `vite`/`vitest` (aliases of
  `@voidzero-dev/vite-plus-*`) at `^0.1.12` where `package.json` asks `^0.1.23`, and emm's `bun.lock`
  records `typescript` `^6.0.3` and `mermaid` `^11.16.1` where `package.json` asks `^7.0.2` and
  `^12.0.0`; both fall back to a non-frozen install. Package-manager pins: rescued pnpm 11.5.0,
  cloudlands-fe pnpm 10.30.3, atmoBB bun 1.4.0. commons's `postinstall` runs `svelte-kit sync`; wordplay's
  runs `run-script-os`.
- Builds: `$env/static` imports stop ochorus, boris, rescued, commons, rwm-front, wordplay and OpenCW
  without their env files; rescued builds with `vp build`; cloudlands-fe's build chains generators and
  an Electron step; emm's runs a Bun script after `vite build`.
- Runners-up, read and not picked: ayamkv/sptfyin, vsc-eco/altera-app, clickswave/silocat,
  oguzhankir/fmtly, zateckar/innovation-portal, Whenplane/whenplane and adamshand/adam.nz. altera-app's
  `pnpm-lock.yaml` disagrees with `package.json` on three specifiers and it has two `file:`
  dependencies; applykit and emm already carry the guarded store write it would add.
