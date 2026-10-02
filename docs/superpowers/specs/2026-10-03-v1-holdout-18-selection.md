# v1 holdout 18 — selection (2026-10-03)

The eighteenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–17 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only
rules whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result
also reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (12 queries) aimed at the shapes holdout 17's fixes touched and
at the checklist items earlier rounds left thin: `page.route.id` with `includes` in route files;
`$derived(` with `.trim()` next to `$props()` in `src/lib`; `from '.'` in `src/lib`; `forEach` with
`new Set` in a module exporting `load`; `svelte-meta-tags` and `@inlang/paraglide-sveltekit` in
`package.json`; `hreflang` and `application/ld+json` in `src/lib`; `mdsvex`, `sveltekit-superforms`
and `workspace:*` next to `@sveltejs/kit`; and `paths` with `relative:` in `svelte.config.js`. As in
holdouts 16 and 17, the pool is this round's searches only.

5,697 repositories came back; 2,716 remained after dropping 159 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 2,822 with no push in six
months; 819 had at least 10 routes and a lockfile; 720 were on Svelte 5 and Kit 2; 665 remained after
dropping 27 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar,
and 28 copies or mirrors of an excluded app. 448 of the 665 had been read in an earlier round, as far
as the kept read list records (holdouts 9–17; those of holdouts 5–8 are no longer available, so an app
read and rejected then could be read again; every pick and runner-up of those rounds stays excluded);
none of those was read again or taken. Of the 217 others, 11 belong to owners of excluded apps and
were dropped; 140 were taken round-robin across the queries that had hits, highest-starred first,
shallow-cloned and read. The 21 finalists (picks and runners-up) were re-fetched at pin time, and
every pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 19 of the 140 were rejected because more of their components use
`export let` than runes. One otherwise fitting candidate was dropped because its `.npmrc` points at a
private package registry (DaVinciBot/cash). Each pick's lockfile was compared with its `package.json`
on each declared range: all 14 agree. No pick has a `.gitmodules` file, an `.npmrc` pointing at a
private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                     | Path                           | Checklist          | Prerenders | Builds | Why                                                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| [demml/opsml](https://github.com/demml/opsml/tree/fd9731e9fa90)                                         | `crates/opsml_server/opsml_ui` | 5, 7, 8, 9, 10     | no         | yes    | ML lifecycle platform UI (40 routes) on adapter-node: hooks, form actions, eight `ssr = false` routes.                 |
| [koder-cog/kepce](https://github.com/koder-cog/kepce/tree/e4531dec210c)                                 | `webapp`                       | 1, 9, 10           | no         | yes    | Cafeteria data network (61 routes) on adapter-node: JSON-LD, `<svelte:element>` headings, a path-tested layout.        |
| [emse-students/canari](https://github.com/emse-students/canari/tree/07bc794be3fd)                       | `frontend`                     | 1, 7, 9, 10, 9b    | yes        | yes    | Student association platform (55 routes): JSON-LD, many `$derived` trims, a path-tested layout.                        |
| [Rensing1/gustav](https://github.com/Rensing1/gustav/tree/748748f29cb3)                                 | `frontend`                     | 5, 8, 9, 10        | no         | yes    | Learning platform (34 routes, 13 action files) on adapter-node: prop-decided headings, a path-tested layout.           |
| [MaxKeenti/anotame-microservices](https://github.com/MaxKeenti/anotame-microservices/tree/59ccc826ae00) | `anotame-web`                  | 3, 9, 10           | no         | yes    | Order-tracking front end (25 routes) with superforms, `<svelte:element>` headings and a path-tested layout.            |
| [o-in25/Busser](https://github.com/o-in25/Busser/tree/49af452e4934)                                     | `.`                            | 1, 10              | no         | no     | Home bar manager (46 routes, 30 action files) on Vercel: JSON-LD, `page.route.id` tests, a load calling `forEach`.     |
| [4www/enlist](https://github.com/4www/enlist/tree/be2d4e9bc700)                                         | `.`                            | 2, 6, 7, 9, 10, 9b | yes        | yes    | Local-first list app (18 routes) under `[lang=locale]`: hreflang alternates, a `paths.base`, `ssr = false`.            |
| [sophomorica/seminary-sidekick](https://github.com/sophomorica/seminary-sidekick/tree/810168b67986)     | `.`                            | 1, 5, 10           | yes        | no     | Study app (20 routes) on Vercel: JSON-LD built in `{#each}`, markdown content, five prerendered routes.                |
| [statox/apps.statox.fr](https://github.com/statox/apps.statox.fr/tree/ba80b88abbb2)                     | `.`                            | 5, 6, 7, 10        | yes        | no     | Collection of personal tools (38 routes) on adapter-static: markdown, a `paths.base`, eight `ssr = false` routes.      |
| [Bewinxed/cawco](https://github.com/Bewinxed/cawco/tree/a9cea4d58ce7)                                   | `apps/dashboard`               | 7, 9, 10, 11       | no         | yes    | Configuration dashboard (24 routes) with workspace packages, `$derived` trims and prop-decided headings.               |
| [kris-lx/kpos](https://github.com/kris-lx/kpos/tree/49673f0a94b2)                                       | `kpos`                         | 7, 10              | no         | no     | Point-of-sale and back-office system (98 routes) on adapter-node with hooks.                                           |
| [hunchulchoi/dgst](https://github.com/hunchulchoi/dgst/tree/913ec0194ce5)                               | `.`                            | 5, 8, 10           | no         | no     | Community board (25 routes) on adapter-node: `page.route.id` tests, a path-tested layout, Prisma.                      |
| [dxlbnl/website](https://github.com/dxlbnl/website/tree/206452ba4e02)                                   | `.`                            | 1, 5, 7, 10        | yes        | no     | Catalogue and mailing site (24 routes) on Vercel: JSON-LD, markdown, two path-tested layouts, four prerendered routes. |
| [Mi-Bee-Studio/MiBeeSteward](https://github.com/Mi-Bee-Studio/MiBeeSteward/tree/df278c27df03)           | `web`                          | 5, 7, 9, 10, 9b    | yes        | yes    | Device management UI (23 routes) on adapter-static, `ssr = false`, two path-tested layouts.                            |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 7    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 8    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 8    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Item 4 has no app: the meta-tag library searches left no unread application that passed the filters.
Item 12 has none either: the npm head components among the candidates were e-mail templates
(`svelte-email`), not a page's head.

Shapes the last fixes touched:

- **A layout testing the request path:** kepce, canari, gustav, anotame, seminary-sidekick, dgst,
  dxlbnl and MiBeeSteward.
- **`page.route.id` tests:** Busser and dgst.
- **A `$derived` that trims a value:** canari, Busser and cawco.
- **A load calling `forEach`:** Busser and cawco.
- **An import from `'.'`:** none among the picks.

## How the first look runs

As in holdouts 5–17, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: kepce, gustav and Busser AGPL-3.0; seminary-sidekick MIT; opsml, canari and MiBeeSteward
  NOASSERTION; the other seven have no license GitHub classifies. The measurement reads the source and
  redistributes nothing.
- Builds: `$env/static` imports stop Busser, seminary-sidekick, apps.statox.fr, kpos, dgst and dxlbnl
  without their env files; dgst also needs a generated Prisma client.
- Runners-up, read and not picked: davediv/buku-umkm, Andreicr1/netz-analysis-engine, Dunderligan/web,
  eweren/lievito, pyenthu/cadtrain, thalmis-zt/exam-pulse and leokbral/sciledger-online.
