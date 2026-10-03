# v1 holdout 19 — selection (2026-10-03)

The nineteenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–18 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only
rules whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result
also reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (12 queries) aimed at the shapes holdout 18's fixes touched or
left open, and at the checklist items earlier rounds left thin: `const base` next to `paths` in
`svelte.config.js`; `base: process.env` there; `Promise.all` with `.json()` in a module exporting
`load`; `page.data.` in an `{#if}` in route files; `@auth/sveltekit` in `package.json`;
`import.meta.glob` of `.md` in a module exporting `load`; `<MetaTags`; `hreflang` with `paraglide`;
`superValidate` in route modules; `export const ssr = false` in route modules; `sequence(` in
`hooks.server.ts`; and `svelte:head` with `{#each` in `src/lib`. As in holdouts 16–18, the pool is
this round's searches only.

6,966 repositories came back; 2,989 remained after dropping 173 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 3,804 with no push in six
months; 987 had at least 10 routes and a lockfile; 863 were on Svelte 5 and Kit 2; 780 remained after
dropping 22 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar,
and 61 copies or mirrors of an excluded app. 391 of the 780 had been read in an earlier round, as far
as the kept read list records (holdouts 9–18); none of those was read again or taken. Of the 389
others, 14 belong to owners of excluded apps and were dropped; 140 were taken round-robin across the
queries, highest-starred first, shallow-cloned and read. The 20 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 22 of the 140 were rejected because more of their components use
`export let` than runes. Four otherwise fitting candidates were dropped because their lockfile
disagrees with `package.json`, and one (sonaiso/sanadcom) because it is a copy of an excluded app
(intuitem/ciso-assistant-community). m4xx101/cryptex-oss was dropped after pinning: it is a toolkit for
red-teaming language models whose source carries a corpus of prompts addressed to them, which the
labelling would read; gtmun/couchmun, the first runner-up, took its place. Each pick's lockfile was
compared with its `package.json` on each declared range: all 14 agree. No pick has a `.gitmodules`
file, an `.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                         | Path                 | Checklist          | Prerenders | Builds | Why                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | -------------------- | ------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| [codicocodes/dotfyle](https://github.com/codicocodes/dotfyle/tree/fc2795aeb7c0)                             | `.`                  | 5, 8, 10           | no         | no     | Neovim plugin directory (21 routes) on adapter-node with hooks, form actions, markdown and Prisma.                        |
| [gtmun/couchmun](https://github.com/gtmun/couchmun/tree/ab12bd086c2b)                                       | `.`                  | 5, 6, 9, 10, 9b    | yes        | yes    | Model UN chairing tool (15 routes) on adapter-static under a `paths.base`, with markdown pages.                           |
| [Specy/genshin-music](https://github.com/Specy/genshin-music/tree/2cf86b5d6e3f)                             | `.`                  | 1, 5, 6, 10        | yes        | no     | Music composer for two games (27 routes) on adapter-static: JSON-LD, a computed base, prop-decided headings.              |
| [likeon/geometa](https://github.com/likeon/geometa/tree/1213e3e3c1b5)                                       | `apps/frontend`      | 3, 5, 8, 9, 10, 9b | yes        | yes    | Map-meta learning site (18 routes) on adapter-node: superforms, nine action files, `.svx` docs.                           |
| [comcent-io/comcent-ce](https://github.com/comcent-io/comcent-ce/tree/150c92f592f2)                         | `packages/web-app`   | 5, 7, 9, 10        | no         | yes    | Contact-center console (38 routes) on adapter-node with hooks and five `ssr = false` routes.                              |
| [vokartz/inkforum](https://github.com/vokartz/inkforum/tree/96a37c5651ce)                                   | `apps/web`           | 1, 9, 10, 11       | no         | yes    | Forum (118 routes) on adapter-node with workspace packages, JSON-LD and `Promise.all` body reads in loads.                |
| [palewire/fivethirtyeightindex.com](https://github.com/palewire/fivethirtyeightindex.com/tree/332aa03ccfb3) | `web`                | 6, 9, 10, 9b       | yes        | yes    | Index of a news site's pages (14 routes) on adapter-static, `paths: { base }` naming a `const`.                           |
| [Agma-Schwa/nguh.org](https://github.com/Agma-Schwa/nguh.org/tree/712661c10899)                             | `.`                  | 7, 8, 10           | yes        | no     | Community site (40 routes) on adapter-node with `@auth/sveltekit`, a `page.data` layout test, `ssr = false`.              |
| [zmiguel/d-scan.space](https://github.com/zmiguel/d-scan.space/tree/48f31818ac95)                           | `.`                  | 1, 8, 9, 10        | no         | yes    | Game scan tool (10 routes) on adapter-node with `@auth/sveltekit`, hooks, form actions and JSON-LD.                       |
| [mozilla/performance](https://github.com/mozilla/performance/tree/632ab202547b)                             | `.`                  | 6, 7, 9, 10, 9b    | yes        | yes    | Browser performance portal (11 routes) on adapter-static, `paths: { base }` naming a `const`, eight `ssr = false` routes. |
| [arnaudon/ScoreGuide](https://github.com/arnaudon/ScoreGuide/tree/4eaa868d55ef)                             | `frontend-svelte/ui` | 2, 8, 9, 10        | no         | yes    | Music-score reader (14 routes) on adapter-node: hreflang alternates, hooks, ten action files.                             |
| [dottmp/10xPrivacy](https://github.com/dottmp/10xPrivacy/tree/d128e56109d5)                                 | `.`                  | 5, 7, 9, 10        | no         | yes    | Privacy resource hub (12 routes) on Cloudflare: markdown, a `page.data` layout test, `<svelte:element>` headings.         |
| [avitus/mankunku](https://github.com/avitus/mankunku/tree/005da95c74e7)                                     | `.`                  | 1, 5, 8, 10        | no         | no     | Ear-training app (33 routes) on adapter-node: JSON-LD, markdown docs a load reads through `import.meta.glob`.             |
| [iamleson98/social-front](https://github.com/iamleson98/social-front/tree/c84c96c1e4c8)                     | `.`                  | 1, 7, 10           | yes        | no     | Shop front end (98 routes): JSON-LD, a `page.data` layout test, three `ssr = false` routes.                               |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 7    |
| 6   | `kit.paths.base`                            | 4    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 6    |
| 9   | likely builds without services              | 9    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Item 4 has no app: the `<MetaTags` search returned no unread application that passed the filters.
Item 12 has none either: the npm components found in the candidates' layouts were UI shells (an app
bar), not a page's head.

Shapes holdout 18's fixes touched or left open:

- **`paths: { base }` naming a `const`:** fivethirtyeightindex.com and mozilla/performance.
- **`Promise.all` over response-body reads in a load:** inkforum.
- **A layout `{#if}` on `page.data`:** nguh.org, 10xPrivacy and social-front.
- **`@auth/sveltekit`:** nguh.org and d-scan.space.
- **Markdown a load reads through `import.meta.glob`:** mankunku.

## How the first look runs

As in holdouts 5–18, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: genshin-music, geometa, comcent-ce and inkforum AGPL-3.0; couchmun and ScoreGuide GPL-3.0;
  dotfyle, fivethirtyeightindex.com, nguh.org and 10xPrivacy MIT; mozilla/performance MPL-2.0;
  social-front CC0-1.0; d-scan.space and mankunku have no license GitHub classifies. The measurement
  reads the source and redistributes nothing.
- Builds: `$env/static` imports stop dotfyle, genshin-music, nguh.org, mankunku and social-front
  without their env files; dotfyle also needs a generated Prisma client.
- Runners-up, read and not picked: Cuanto-bio/cuanto.bio, maigner/Energiegemeinschaft,
  fvrvz/authforest, Electron-Minecraft-Launcher/EML-AdminTool, hackclub/beest and
  thijs-hakkenberg/dyson.
