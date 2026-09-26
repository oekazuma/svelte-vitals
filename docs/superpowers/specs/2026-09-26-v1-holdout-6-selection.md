# v1 holdout 6 — selection (2026-09-26)

The sixth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–5 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: holdout 5's discovery (head-like components imported from bare specifiers, head packages,
superforms, mdsvex, paraglide, `paths.base`, JSON-LD next to `$props()`), holdout 4's code-search pool
and holdout 3's repository-search pool, plus new code searches aimed at the shapes holdout 5's fixes
touched: `transformPageChunk` with `replace` in `hooks.server.{ts,js}`, JSON-LD, preconnect and
`%lang%` in `app.html`, `<svelte:head>` next to a `<Seo>`, `<SEO>`, `<MetaTag>`, `<Meta>`, `<Head>`
or `<PageMeta>` component, and the head packages again (`runes-meta-tags`, `@unhead/svelte`,
svelte-ux's `AppBar`, `@foxui/core`, `sk-seo`, `@sveltinio/seo`, `ParaglideJS`). 7,876 repositories
came back; 3,877 remained after dropping the 103 of the 118 excluded repositories that appeared (the
84 corpus apps and every candidate and runner-up of earlier holdouts) and 3,896 with no push in six
months; 1,483 had at least 10 routes and a lockfile; 1,353 were on Svelte 5 and Kit 2; 1,266 remained
after dropping 57 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 30 copies or mirrors of an excluded app (found by package name or description). 87 were
read from a shallow clone. The pool's push dates and fork/archived flags came from the previous
day's snapshot; the 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned
SHA equals the clone that was read. Nothing was installed, built or run; the head components of two npm
packages were read from their published files, and one committed tarball's file list and
`package.json` were read.

The filters are unchanged: a real application (not a docs site, component gallery, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 6 of the 87 were rejected because more of their components use
`export let` than runes. Each pick's lockfile was also compared with its `package.json` (the
`packages[""]` entry of `package-lock.json`, the importer of `pnpm-lock.yaml`, the workspace block of
`bun.lock`): all 14 agree, and none uses a private registry.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                             | Path                | Checklist          | Prerenders | Builds | Why                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| [execut4ble/vilnius-hardcore](https://github.com/execut4ble/vilnius-hardcore/tree/a58dddd1d1f0)                                 | `.`                 | 5, 8, 10           | no         | no     | A local `MetaTags` component with `<title>` at its top level, placed inside `<svelte:head>` by 13 pages.                   |
| [cmintey/wishlist](https://github.com/cmintey/wishlist/tree/a5150c73620a)                                                       | `.`                 | 8                  | no         | no     | adapter-node with hooks and 14 action files; `%lang%`/`%dir%` in `app.html` filled by hooks.                               |
| [DeutscheModelUnitedNations/munify-delegator](https://github.com/DeutscheModelUnitedNations/munify-delegator/tree/50ef3d8c2b9b) | `.`                 | 3, 7, 8, 10        | no         | no     | 71-route adapter-node app with superforms, an `ssr = false` page and `{#await import()}` components.                       |
| [imjlk/645-live](https://github.com/imjlk/645-live/tree/05077a949e8b)                                                           | `pages/www`         | 1, 2, 4, 5, 10     | yes        | no     | svelte-meta-tags through a local wrapper; `FAQPage`/`HowTo` JSON-LD; literal `hreflang`; mdsvex.                           |
| [brandonwie/brandonwie.dev](https://github.com/brandonwie/brandonwie.dev/tree/877b40e9b633)                                     | `.`                 | 1, 2, 5            | yes        | no     | Prerendered en/ko mdsvex blog (334 posts) with JSON-LD, literal `hreflang` and preconnect in `app.html`.                   |
| [nidhinmahesh/htmltopdf.pro](https://github.com/nidhinmahesh/htmltopdf.pro/tree/6942a55bcfbf)                                   | `.`                 | 1, 9, 9b           | yes        | yes    | JSON-LD and preconnect written literally in `app.html`; root `ssr = false` with `prerender = true`.                        |
| [flo-bit/atmo-social](https://github.com/flo-bit/atmo-social/tree/47692bc0e1c7)                                                 | `.`                 | 9, 10, 12          | no         | yes    | Bluesky client whose layout head is `@foxui/core`'s `Head`; remote functions.                                              |
| [carlelieser/yuki](https://github.com/carlelieser/yuki/tree/2c856baef923)                                                       | `apps/web`          | 1, 3, 8, 9, 10, 11 | no         | yes    | UI from `@yuki/ui` (120 `.svelte` files, source) in 33 files; superforms, actions, JSON-LD.                                |
| [sebadob/rauthy](https://github.com/sebadob/rauthy/tree/523b6c6889fb)                                                           | `frontend`          | 6, 9, 9b           | yes        | yes    | Prerendered static UI under a literal `kit.paths.base` (`/auth/v1`); `%lang%` filled by hooks.                             |
| [atshelchin/biubiu-monorepo](https://github.com/atshelchin/biubiu-monorepo/tree/0bb03976ee0d)                                   | `apps/biubiu.tools` | 1, 2, 5, 10, 11    | no         | no     | Head (title, hreflang, JSON-LD) from a workspace package whose export points at an unbuilt `dist/`.                        |
| [NikolasP98/minion_hub](https://github.com/NikolasP98/minion_hub/tree/6716b2767aea)                                             | `.`                 | 2, 7, 10           | no         | no     | 150-route dashboard, root `ssr = false`; hreflang from `ParaglideJS`; UI from a committed tarball.                         |
| [huggingface/Mongoku](https://github.com/huggingface/Mongoku/tree/985dddea9752)                                                 | `.`                 | 6, 8, 9            | no         | yes    | adapter-node with hooks and remote functions under `paths.base` from `BASE_PATH`.                                          |
| [rhpo/lms](https://github.com/rhpo/lms/tree/662f0f4a80ab)                                                                       | `.`                 | 4, 7, 10           | no         | no     | 59-route dashboard, `ssr = false` layouts; svelte-meta-tags through a wrapper that takes children.                         |
| [sona-fast/sona](https://github.com/sona-fast/sona/tree/4f84dac8b1e3)                                                           | `.`                 | 9, 10              | no         | yes    | `%preload%` in `app.html` filled with a font preload tag by `transformPageChunk`; hooks and 23 action files on Cloudflare. |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 4    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 2    |
| 5   | markdown/mdsvex                             | 4    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 5    |
| 9   | likely builds without services              | 6    |
| 10  | component-resolution shapes                 | 9    |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 1    |
| 9b  | prerenders pages and likely builds          | 2    |

Item 12 has one app this round. atmo-social's layout renders `@foxui/core`'s `Head` (0.8.2 in its
lock), which puts `<title>`, description, og:\* and twitter:\* inside `<svelte:head>`; the component
was read from the package's published files. Every other `sk-seo`, svelte-ux `AppBar`,
`runes-meta-tags` or `@foxui/core` user left in the pool was read in an earlier round, excluded, a
component or icon gallery, or used the package for something else. sugenstone/koop-yonetim has a
`runes-meta-tags` wrapper, but it is left over from the admin template the app started from and no
page renders it.

minion_hub counts for item 2, not 12: `@inlang/paraglide-sveltekit`'s `ParaglideJS` (0.16.1) renders
only alternates. Its `<svelte:head>` holds a child component, `AlternateLinks`, whose
`<link rel="alternate">` tags sit at that child's top level — the shape of holdout 5's title class,
with a different tag. vilnius-hardcore is that shape with `<title>`: its `MetaTags` component has
`<title>` and 14 `<meta>` tags at its top level and 13 pages place it inside `<svelte:head>`.

Other shapes that holdout 5's fixes touched: JSON-LD and preconnect written literally in `app.html`
(htmltopdf.pro; preconnect also in brandonwie.dev); `app.html` placeholders filled by
`transformPageChunk` (`%preload%`, `%theme%`, `%mode%`, `%dir%` and `%lang%` in sona; `%lang%`/`%dir%`
in wishlist; `%paraglide.lang%` in vilnius-hardcore; `%lang%` in rauthy, brandonwie.dev and
munify-delegator, `{{theme_ts}}` in rauthy); and loads that throw on every path. Those found end in
`error()` or `redirect()` on every path, not in `error()` alone as in holdout 5
(wishlist `wishlists/me/+page.server.ts`, munify-delegator `management/[conferenceId]/+page.ts`).

## How the first look runs

As in holdout 5, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets: each app is cloned at its pin and
installed with its own package manager, then `scripts/corpus-measure.js run` measures that checkout
with the packed CLI, before the build rewrites anything. The per-app results, in `holdout.json`
order, make up the first-look file. An app whose install fails is measured uninstalled, and the
result records which apps were. The criteria and their thresholds are unchanged.

## Rules without real-app evidence that these apps may exercise

74 of 105 rules have evidence. Holdout 5's result counted 75 with `performance/preconnect`; its 16
findings there were all `fp`, and the fix that followed stopped them, so the rule is back to none.
Nine of the other 31 do nothing under the default config, so no first run can give them evidence:
`a11y/disallowed-element`, `a11y/required-element`, `a11y/unverified-id-ref` (off by default), and
the six `architecture/` convention rules (`directory-naming`, `doc-link-target`,
`private-scope-import`, `reserved-directory-names`, `reserved-name-placement`, `unit-entry-file`).
Signals found by grepping the source for the rest (a signal is not a finding):

- `seo/hreflang`: literal alternates in 645-live (`ko-KR` and `x-default`, both to the same URL) and
  brandonwie.dev (`en`/`ko`/`x-default`); alternates from a package component in biubiu (workspace,
  unbuilt `dist/`) and minion_hub (`ParaglideJS`)
- `seo/json-ld-deprecated-type`: `FAQPage` in htmltopdf.pro and 645-live, `HowTo` in 645-live
- `seo/json-ld-required-props`: `WebSite` in 645-live and brandonwie.dev, `BreadcrumbList` in
  htmltopdf.pro and 645-live (the rule fires only when a required property is missing)
- `performance/preconnect`: Google Fonts with a preconnect in `app.html` (htmltopdf.pro,
  brandonwie.dev), the case the holdout 5 fix now reads
- `performance/font-preload-crossorigin`: font preloads with `crossorigin` in wishlist's `app.html`
  and in the tag sona's hooks write into `%preload%`
- `seo/json-ld-date-format`: one literal date (`2024-01-01T00:00:00.000Z` in 645-live's guide page);
  the others come from post data or `toISOString()`
- `correctness/orphan-effect`: `$effect` inside functions in `.svelte.ts` modules (wishlist,
  munify-delegator, 645-live); none at module scope

No pick uses `accesskey`, an untitled `<abbr>`, duplicate `<dt>`, an unknown role or `aria-*` name,
`bind:value` on a checkbox, a lifecycle call or browser global at module scope, a preload without
`as`, or `minify: false`, and every `app.html` has a doctype, charset and viewport.

## Notes

- vilnius-hardcore, 645-live, brandonwie.dev, atmo-social, minion_hub and rhpo/lms have no license
  file. The measurement reads the source and redistributes nothing.
- atmo-social is by the author of holdout 5's atmo-events; its README calls it work in progress.
- biubiu's `@shelchin/seo-sveltekit` exports `./SEO.svelte` as `./dist/components/SEO.svelte`, and
  `dist/` is gitignored and produced only by that package's own build, so after an install the head
  component of 25 pages resolves to a file that does not exist. Its adapter is another workspace
  package resolving to `dist/`, and its build first compiles Rust to WASM.
- minion_hub's four `file:` dependencies are tarballs committed under `deps/`, so the install stays
  inside the repository; `@minion-stack/ui` ships 13 `.svelte` files in its `dist/`. `svelte.config.js`
  picks its adapter with a top-level `await import()` on `DESKTOP`.
- Mongoku and atmo-social enable `experimental.remoteFunctions` and have `*.remote.ts` modules.
  Mongoku's `paths.base` is `process.env.BASE_PATH || ""`, an expression; rauthy's is a literal.
- brandonwie.dev is mid-migration to Next.js: a `next/` workspace sits beside the SvelteKit root, the
  root install installs it, and `build` runs pagefind and the Next build after `vite build`. The
  plugin's report is written in the vite step, but the harness judges the whole script, so it is not
  counted as likely to build.
- Install risks: wishlist's `packageManager` (and `engines.pnpm`) pins pnpm 11.27.1 while its lock
  records pnpm 12.4.2; munify-delegator commits `bun.lock` and `package-lock.json` (the harness takes
  `bun.lock`); yuki's root requires bun 1.4 or later; 645-live, yuki, biubiu, minion_hub and
  munify-delegator install with bun.
- Runners-up, read and not picked: Blastose/ranobedb, deploys-app/console, OWASP/cornucopia,
  getmochify/mochify-frontend, apache/iggy and jamestagal/webkit.
