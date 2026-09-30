# v1 holdout 13 — selection (2026-09-30)

The thirteenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–12 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: the pool of holdouts 3–12 (as recorded in the carried-over repository metadata) plus one new
round of code search (12 queries, one of which GitHub could not parse) aimed at the shapes holdout 12's
fixes touched and at the checklist items it left empty: `export const ssr = dev` / `csr = dev`;
`csr = false` in route files; `{#if !` next to `||` or `&&` and an `<h1>`; `svelte-meta-tags` in
`package.json`; a literal `paths.base`; `workspace:*` UI packages; `application/ld+json` and
`hreflang` inside `{#each}`; and `sveltekit-superforms` next to `export const actions`.

17,463 repositories came back, 1,005 of them new; 8,644 remained after dropping the 256 of the 263
excluded repositories that appeared (the corpus repositories and every candidate and runner-up of
earlier holdouts) and 8,562 with no push in six months; 2,552 had at least 10 routes and a lockfile;
2,311 were on Svelte 5 and Kit 2; 2,147 remained after dropping 68 app directories named `docs`,
`site`, `examples`, `templates`, `tests`, `demo` or similar, and 96 copies or mirrors of an excluded
app. 810 of the 2,147 had been read in an earlier round; none of those was read again or taken. Of the
1,337 others, 193 had a hit from the new searches (3 more belong to owners of excluded apps and were
dropped); 140 of them were read from a shallow clone, taken round-robin across the seven shapes that
had hits, highest-starred first. The meta-tag library, `paths.base` and workspace-UI searches left no
unread application with 10 routes. The 21 finalists (picks and runners-up) were re-fetched at pin
time, and every pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 23 of the 140 were rejected because more of their components use
`export let` than runes. Each pick's lockfile was compared with its `package.json` on each declared
range: all 14 agree. No pick has a `.gitmodules` file or a `file:`/`link:` dependency outside its
checkout; medora's `.npmrc` names only the public npm registry.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                     | Path       | Checklist             | Prerenders | Builds | Why                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [xavyo/xavyo-web](https://github.com/xavyo/xavyo-web/tree/7c88512b1445)                                                 | `.`        | 3, 8, 9, 10           | no         | yes    | Identity-governance console: 240 routes, 474 components, superforms across 167 action files on adapter-node.                                           |
| [menzies-mariesta-com/medora-web-menzies](https://github.com/menzies-mariesta-com/medora-web-menzies/tree/238aee57ea21) | `.`        | 5, 9, 10              | no         | yes    | Hospital information system (132 routes, 443 components) with paraglide and mdsvex; `<h1>`s behind `{#if !… && …}`.                                    |
| [AlexBocken/homepage](https://github.com/AlexBocken/homepage/tree/19bb5ac71fa6)                                         | `.`        | 1, 2, 5, 8, 10        | yes        | no     | Personal site with recipe, fitness and hiking sections (78 routes): JSON-LD in the root layout, per-language recipe alternates, mdsvex, `csr = false`. |
| [michailbouklas/marketing-offers-tool](https://github.com/michailbouklas/marketing-offers-tool/tree/04f86988edc1)       | `.`        | 3, 5, 8, 10           | no         | no     | Marketing-offers tool (60 routes) on adapter-node: superforms, Prisma, an `<h1>` behind `{#if !… \|\| …}`.                                             |
| [cliffordkleinsr/intuitive](https://github.com/cliffordkleinsr/intuitive/tree/eca3ff75cf08)                             | `.`        | 1, 3, 8, 10           | no         | no     | Survey platform (62 routes, 30 action files): superforms, JSON-LD from a local `meta` component.                                                       |
| [One-Learn-Platform/platform](https://github.com/One-Learn-Platform/platform/tree/dcbb294f3fea)                         | `.`        | 3, 9b, 10             | yes        | no     | Learning-management system on Cloudflare: 45 routes, 30 action files, a prerendered `(landing)` group.                                                 |
| [F-Bureaucracy/wohnraum](https://github.com/F-Bureaucracy/wohnraum/tree/11b88b9db776)                                   | `.`        | 3, 8, 9, 10           | no         | yes    | Housing placement for homeless people: superforms across 21 action files on adapter-node.                                                              |
| [LausanneTourisme/press](https://github.com/LausanneTourisme/press/tree/8c5d0f7a0265)                                   | `.`        | 1, 2, 3, 8, 9, 9b, 10 | yes        | yes    | Tourism press site: `[locale=locale]` routes with alternates built in `{#each}`, JSON-LD in the root layout, 9 prerendered files.                      |
| [tylergraydev/claude-code-tool-manager](https://github.com/tylergraydev/claude-code-tool-manager/tree/63b54d669680)     | `.`        | 7, 9, 10              | no         | yes    | Tauri desktop app (`ssr = false` at the root, 22 routes); a sidebar `<h1>` behind `{#if !… && …}`.                                                     |
| [glennsyang/synapse](https://github.com/glennsyang/synapse/tree/df66868a0762)                                           | `.`        | 3, 5, 8, 9, 10        | no         | yes    | Personal knowledge app: superforms across 19 action files, markdown-it.                                                                                |
| [ut-code/cms.utcode.net](https://github.com/ut-code/cms.utcode.net/tree/de7a2534f37d)                                   | `.`        | 1, 5, 9, 10           | no         | yes    | Club site and CMS (29 routes): JSON-LD from a `json-ld.ts` helper and in an FAQ `{#each}`, `marked`.                                                   |
| [obcode/plexams.gui](https://github.com/obcode/plexams.gui/tree/e2449a1e537d)                                           | `.`        | 5, 9, 10              | no         | yes    | Exam-planning frontend (51 routes); an email-template editor with `<h1>`s behind `{#if !… && …}`.                                                      |
| [MaxOpperman/spelwijsheid](https://github.com/MaxOpperman/spelwijsheid/tree/0e17f1dec7f8)                               | `.`        | 7, 8, 9, 9b, 10       | yes        | yes    | Puzzle-solver web app: four "how to play" pages export `csr = dev`, a `ssr = false` game page, `paths.base` from `BASE_PATH`.                          |
| [tilloh-dev/tilloh.dev](https://github.com/tilloh-dev/tilloh.dev/tree/3013455c974b)                                     | `frontend` | 5, 7, 9, 9b, 10       | yes        | yes    | Personal site with small apps: 15 prerendered page files, `ssr = false` in the root layout, sveltekit-i18n.                                            |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 7    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 7    |
| 6   | `kit.paths.base`                            | 0    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 7    |
| 9   | likely builds without services              | 9    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Items 4, 6, 11 and 12 have no app for the second round running: the searches aimed at them found no
unread application that passed the filters. spelwijsheid's `paths.base` comes from `BASE_PATH`, as
sunnylink's did, so it is not counted.

Shapes the last fixes touched:

- **`csr = dev`:** spelwijsheid's four "how to play" pages.
- **`<h1>`s behind `{#if !…}` with `&&` or `||`:** medora, marketing-offers-tool, claude-code-tool-manager,
  plexams.gui.
- **Alternates and JSON-LD built in `{#each}`:** AlexBocken's recipes, LausanneTourisme, cms.utcode.net.

## How the first look runs

As in holdouts 5–12, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged.

## Notes

- License: One-Learn-Platform, LausanneTourisme, cms.utcode.net and tilloh.dev MIT, AlexBocken and
  spelwijsheid AGPL-3.0, plexams.gui BSD-3-Clause; the other seven have no license GitHub classifies.
  The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop AlexBocken, intuitive and One-Learn-Platform without their env
  files; marketing-offers-tool needs a generated Prisma client.
- Runners-up, read and not picked: yuu19/SubTrack, share-open-sharing-infrastructure/share-mvp,
  lizy3yo/CHTM_Cooks-frontend, godwanglin/anime-frontend, jldev1227/cotransmeq-app,
  bonding-studierendeninitiative/firmen-frontend2 and dcatalim/llm-research.
