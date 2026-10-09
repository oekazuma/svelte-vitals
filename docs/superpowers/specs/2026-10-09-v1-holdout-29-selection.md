# v1 holdout 29 — selection (2026-10-09)

The twenty-ninth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–28 have each been judged
and their apps joined the tuning corpus; holdouts 20 and 28 passed every deciding criterion and the
others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 26–28:
`socket.io-client`, `@threlte/core`, `typesafe-i18n`, `leaflet`, `chart.js`, `dexie` and `@xyflow/svelte`
with `@sveltejs/kit` in `package.json`; `export const reroute` and `handleValidationError` in TypeScript;
`resolve(` with `$app/paths` in route files; `page.error` with `$app/state`, `{@attach`, `$state.snapshot`
in `src/lib` and `$effect.pre` in components. One page of the `page.error` query failed on the network,
so that query contributed its first 400 results. As in holdouts 16–28, the pool is this round's searches
only.

8,450 repositories came back; 4,133 remained after dropping 236 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts), 2 archived ones and 4,079 with no
push in six months; 1,116 had at least 10 routes and a lockfile; 1,021 were on Svelte 5 and Kit 2; 875
remained after dropping 22 app directories named `docs`, `site`, `examples`, `templates`, `tests`,
`demo` or similar, and 124 copies or mirrors of an excluded app. 593 of the 875 had been read in an
earlier round, as far as the kept read list records (holdouts 9–28); none of those was read again or
taken. Of the 282 others, 21 belong to owners of excluded apps and were dropped; 140 were taken
round-robin across the queries, highest-starred first, shallow-cloned and read. The 21 finalists (picks
and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read.
Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 21 of the 140 were rejected because more of their components use
`export let` than runes. Three otherwise fitting candidates were dropped because their lockfile
disagrees with `package.json`, and one because it commits a submodule. Each pick's lockfile was compared
with its `package.json` on each declared range: all 14 agree. No pick has a `.gitmodules` file, a
committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                   | Path                | Checklist       | Prerenders | Builds | Why                                                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------- | --------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| [spiculedata/saiku](https://github.com/spiculedata/saiku/tree/1aec85a7dc47)                           | `saiku-ui`          | 5, 6, 7, 9, 9b  | yes        | yes    | Semantic-layer console (15 routes) on adapter-static under a `paths.base`, `ssr = false`, with markdown.    |
| [komiljonmaksudov/taijobi](https://github.com/komiljonmaksudov/taijobi/tree/3b77f817eaa3)             | `taijobi-web`       | 1, 7, 9, 9b     | yes        | yes    | Language-learning app (14 routes) on Cloudflare with prerendered public pages and JSON-LD.                  |
| [rodrigohgpontes/buscabase](https://github.com/rodrigohgpontes/buscabase/tree/a547fb5c890b)           | `apps/web`          | 1, 9, 9b, 10    | yes        | yes    | Curriculum search site (15 routes) on adapter-node, 11 routes prerendered, with JSON-LD.                    |
| [saffronjam/saffron-hive](https://github.com/saffronjam/saffron-hive/tree/1dc89389b839)               | `web`               | 2, 5, 7, 9, 10  | no         | yes    | Self-hosted home-automation UI (29 routes) on adapter-static, `ssr = false`, with alternate-language links. |
| [nadun96/quizare](https://github.com/nadun96/quizare/tree/13d294633fff)                               | `frontend`          | 5, 7, 9         | no         | yes    | Quiz platform (30 routes) on adapter-static with 21 markdown files.                                         |
| [volturine/data-forge](https://github.com/volturine/data-forge/tree/ee9ed6119dbd)                     | `packages/frontend` | 6, 9, 9b        | yes        | yes    | Data-analysis app (18 routes) on adapter-static under a `paths.base`, with prerendered pages.               |
| [JaggerITA/relicblade-companion](https://github.com/JaggerITA/relicblade-companion/tree/f9f590c45564) | `.`                 | 6, 7, 9, 9b     | yes        | yes    | List builder for a tabletop game (20 routes) on adapter-static under a `paths.base`.                        |
| [Vortextbloons/Hoop-Rush](https://github.com/Vortextbloons/Hoop-Rush/tree/9f55ad154efb)               | `apps/web`          | 6, 7, 9, 9b, 10 | yes        | yes    | Basketball card game (35 routes) on adapter-static under a `paths.base`, in a workspace.                    |
| [PaulDepping/ranking-forge](https://github.com/PaulDepping/ranking-forge/tree/9836c2447592)           | `web`               | 8, 9            | no         | yes    | Player-ranking tool (19 routes) on adapter-node with hooks and 11 action files.                             |
| [fr0gtech/spoty-stalk](https://github.com/fr0gtech/spoty-stalk/tree/cb10d97ffd68)                     | `apps/web`          | 8, 9            | no         | yes    | Music player (21 routes) on adapter-node with hooks and 7 action files, in a workspace.                     |
| [Kevin2Holt/program](https://github.com/Kevin2Holt/program/tree/3afa74b25200)                         | `.`                 | 8, 9, 10        | no         | yes    | Event programs and sign-up calendars (18 routes) on adapter-node with hooks and prop-decided headings.      |
| [MantisWare/BizForge](https://github.com/MantisWare/BizForge/tree/5b827b1acd7c)                       | `desktop`           | 7, 9            | no         | yes    | Desktop workspace app (59 routes) on adapter-static, `ssr = false`.                                         |
| [tracepad/tracepad](https://github.com/tracepad/tracepad/tree/efc7016a839e)                           | `ui`                | 7, 9, 10        | no         | yes    | LLM observability UI (31 routes) on adapter-static, `ssr = false`.                                          |
| [Herover/shareviz](https://github.com/Herover/shareviz/tree/83ec327f1b6a)                             | `.`                 | 7, 8, 9, 10     | no         | yes    | Collaborative data-visualisation tool (16 routes) on adapter-node with hooks, partly `ssr = false`.         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 4    |
| 7   | large SPA/dashboard, `ssr = false`          | 9    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 14   |
| 10  | component-resolution shapes                 | 6    |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 6    |

Items 3, 4, 11 and 12 have no app: the one candidate with superforms was dropped for its lockfile, none
of the 140 read uses a meta-tag library, and the workspace packages of Hoop-Rush and spoty-stalk hold
types, logic and data access, no components.

## How the first look runs

As in holdouts 5–28, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: saiku and tracepad Apache-2.0; buscabase, saffron-hive, quizare and relicblade-companion MIT; data-forge GPL-3.0; ranking-forge AGPL-3.0; shareviz MPL-2.0; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: no pick imports `$env/static` or uses Prisma.
- The read-list filter used to compare names case-sensitively, so a repository whose name has capital letters could be read again in a later round; it now compares them case-insensitively. No repository was ever taken twice: the exclusion of earlier candidates was already case-insensitive.
- Runners-up, read and not picked: giellatekno/lingtools, offtherailz/renkei, Git-on-my-level/codex-autorunner,
  pxldi/schall, PleatherStarfish/flan-zines, zli117/RUOK and jaagupku/partygame.
