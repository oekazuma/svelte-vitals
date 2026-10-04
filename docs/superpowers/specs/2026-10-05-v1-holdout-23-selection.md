# v1 holdout 23 — selection (2026-10-05)

The twenty-third holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–22 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdouts 21 and
22 failed C6. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries). The SEO and head terms of earlier rounds were
replaced by terms for how an application is built, since three in four of the repositories they found
in holdout 22 had already been read: form actions with `fail(` in route files; `drizzle-orm`,
`@supabase/ssr`, `@prisma/client`, `better-auth` and `bits-ui` with `@sveltejs/kit` in `package.json`;
`@sveltejs/adapter-cloudflare` in `package.json`; `export const ssr = false` in route files;
`handleError` in `hooks.client.ts`; `$derived.by(` in route files; `{#snippet` with `{@render` in
`src/lib/components`; and three queries of holdout 22 restricted by file size (`Dialog.Title` in route
files, `handle` with `redirect(` in `hooks.server.ts`, `page.url.pathname.startsWith` in route files)
to reach past the 1,000 results code search returns per query. As in holdouts 16–22, the pool is this
round's searches only.

8,713 repositories came back; 3,916 remained after dropping 273 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 4,522 with no push in six
months; 1,512 had at least 10 routes and a lockfile; 1,402 were on Svelte 5 and Kit 2; 1,336 remained
after dropping 17 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 49 copies or mirrors of an excluded app. 843 of the 1,336 had been read in an earlier
round, as far as the kept read list records (holdouts 9–22); none of those was read again or taken. Of
the 493 others, 30 belong to owners of excluded apps and were dropped; 140 were taken round-robin
across the queries, highest-starred first, shallow-cloned and read. The 21 finalists (picks and
runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing
was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 15 of the 140 were rejected because more of their components use
`export let` than runes. Two otherwise fitting candidates were dropped because their lockfile disagrees
with `package.json` (one also installs from a private registry), and one because its `packageManager`
names a different package manager than its lockfile. Each pick's lockfile was compared with its
`package.json` on each declared range: all 14 agree. No pick has a `.gitmodules` file, an `.npmrc`
pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                         | Path             | Checklist      | Prerenders | Builds | Why                                                                                          |
| ------------------------------------------------------------------------------------------- | ---------------- | -------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- |
| [arackaf/booklist](https://github.com/arackaf/booklist/tree/4d3eddbf0d08)                   | `svelte-kit`     | 9, 10          | no         | yes    | Book-tracking site (12 routes) on Cloudflare with hooks and form actions.                    |
| [kurozenzen/kurosearch](https://github.com/kurozenzen/kurosearch/tree/631fcdb1e1ea)         | `.`              | 9, 10, 9b      | yes        | yes    | Image-board browsing client (15 routes) on adapter-static with a prerendered route.          |
| [unb-mds/2025-1-NoFluxoUnB](https://github.com/unb-mds/2025-1-NoFluxoUnB/tree/df5ee5f468c9) | `frontend`       | 1, 7, 10       | yes        | no     | University course planner with an assistant (27 routes): JSON-LD, four `ssr = false` routes. |
| [stuy-arista/arista-web](https://github.com/stuy-arista/arista-web/tree/e5c4d1ff1a77)       | `.`              | 1, 3, 9, 10    | no         | yes    | Student-society site (24 routes) on Vercel: JSON-LD, superforms, fifteen action files.       |
| [ieedan/skilless](https://github.com/ieedan/skilless/tree/e7ea1ab2b7cd)                     | `apps/web`       | 5, 9, 10       | no         | yes    | Skill-management app (20 routes) with markdown, a workspace package, hooks and actions.      |
| [martinemde/martinemde.com](https://github.com/martinemde/martinemde.com/tree/d544d22f5df9) | `.`              | 5, 10          | yes        | no     | Personal blog (21 routes) on Cloudflare with 38 markdown files and prerendered routes.       |
| [DHBern/ACO](https://github.com/DHBern/ACO/tree/a7d6c05a5cef)                               | `.`              | 6, 9, 10, 9b   | yes        | yes    | Digital scholarly edition (15 routes) on adapter-static under a `paths.base`.                |
| [hiro-league/hiroleague](https://github.com/hiro-league/hiroleague/tree/a565474a6330)       | `admin_frontend` | 7, 9, 10, 9b   | yes        | yes    | Admin UI for a personal assistant (12 routes) on adapter-static, `ssr = false`.              |
| [gibsondevhouse/novellum](https://github.com/gibsondevhouse/novellum/tree/e8205026bc7f)     | `.`              | 1, 7, 8, 9, 10 | no         | yes    | Novel-writing workspace (55 routes) on adapter-node with hooks: JSON-LD, `ssr = false`.      |
| [DieSoftwarerobbe/HUMAN](https://github.com/DieSoftwarerobbe/HUMAN/tree/07ad22540bfb)       | `.`              | 10             | no         | no     | Relief-organisation manager (56 routes) on Vercel with hooks and 35 action files.            |
| [julioborgesigt/escalas](https://github.com/julioborgesigt/escalas/tree/968cd6477b5c)       | `.`              | 9, 10          | no         | yes    | Duty-roster platform (42 routes) on Cloudflare with hooks and 39 action files.               |
| [Cordn-msg/cordn-web](https://github.com/Cordn-msg/cordn-web/tree/3ffa7bfab717)             | `.`              | 7, 9, 10       | no         | yes    | Group-messaging client (20 routes) on adapter-static with a workspace package.               |
| [andreucv/puzzle_league](https://github.com/andreucv/puzzle_league/tree/d86f34b68435)       | `.`              | 3, 10          | no         | no     | Puzzle-competition manager (33 routes) on Vercel: superforms, Prisma, hooks.                 |
| [lqn5/senftube](https://github.com/lqn5/senftube/tree/650e13437d94)                         | `.`              | 8, 10          | no         | no     | Video-sharing site (15 routes) on adapter-node with hooks and form actions.                  |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 2    |
| 9   | likely builds without services              | 9    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 2 and 4 have no app: this round's queries were aimed at how apps are built rather than at
those libraries, and none of the 140 read uses one. kurosearch and hiroleague set `paths.base` to
`''`, so only ACO counts for item 6. The two workspace packages (skilless, cordn-web) hold no
components, so item 11 has none.

## How the first look runs

As in holdouts 5–22, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: NoFluxoUnB GPL-3.0; skilless, hiroleague and cordn-web MIT; novellum NOASSERTION; the other nine have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop NoFluxoUnB, martinemde.com, HUMAN, puzzle_league and senftube
  without their env files.
- Runners-up, read and not picked: liubimba/otklik, GoodMannersHosting/Meticulous, ndrewwm/svelteblog,
  Kusefiru/Mist, SuperJackfruitLabs/agentpod, geode-sdk/website and appsoftwareltd/etherpk-client.
