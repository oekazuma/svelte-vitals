# v1 holdout 35 — selection (2026-10-15)

The thirty-fifth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–34 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32 and 34 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–34:
`@sveltejs/adapter-node`, `@inlang/paraglide-sveltekit`, `appwrite`, `nanoid`, `dayjs`, `echarts`,
`embla-carousel-svelte`, `unified`, `@iconify/svelte`, `@vercel/analytics`, `mysql2` and `lodash-es` with
`@sveltejs/kit` in `package.json`; `replaceState` with `$app/navigation`, `<svelte:body`,
`deserialize` with `$app/forms`, `applyAction`, `og:locale`, `$inspect(` and `disableScrollHandling` in
Svelte files; `export const load` in JavaScript route modules; `sequence(` with `@sveltejs/kit/hooks` and
`transformPageChunk` in TypeScript; `meta name="description"`, `$env/static/public` and
`{@render children()}` (over 3 KB) in route files; `robots.txt` and `sitemap.xml` in TypeScript route
modules; and `$bindable(` in `src/lib` Svelte files. The `dayjs` query failed on the network after its
first page and was rerun. As in holdouts 16–34, the pool is this round's searches only.

14,978 repositories came back; 50 no longer resolved. 6,351 remained after dropping 375 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 8,202
with no push in six months. GitHub's hourly rate limit stopped part of the file listing; it was rerun
after the limit reset, and every repository listed. 1,628 had at least 10 routes and a lockfile; 1,423
were on Svelte 5 and Kit 2; 1,298 remained after dropping 25 app directories named `docs`, `site`,
`examples`, `templates`, `tests`, `demo` or similar, and 100 copies or mirrors of an excluded app. 1,135
of the 1,298 had been read in an earlier round, as far as the kept read list records (holdouts 9–34);
none of those was read again or taken. Of the 163 others, 28 belong to owners of excluded apps and were
dropped; all 135 left were shallow-cloned and read. The 20 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 31 of the 135 were rejected because runes are in half their
components or fewer. Three otherwise fitting candidates were dropped: two because they commit two
lockfiles for one app that disagree with `package.json`, and one because it commits gitlinks. Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                         | Path               | Checklist       | Prerenders | Builds | Why                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------ | --------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [skybridgeskills/orca](https://github.com/skybridgeskills/orca/tree/9082b7c69ccb)                           | `.`                | 4, 5, 8, 10     | no         | no     | Open Badges recognition app (28 routes) with svelte-meta-tags, markdown, hooks and form actions.                                                           |
| [dahisea/GF-HOME-NEXT](https://github.com/dahisea/GF-HOME-NEXT/tree/2fe823ce2a64)                           | `.`                | 2, 6, 9, 9b, 10 | yes        | yes    | Product website under a `[lang]` segment (15 routes) on adapter-static under a computed `paths.base`, with alternate-language links and prerendered pages. |
| [bmccorm2/web](https://github.com/bmccorm2/web/tree/2db249325ed5)                                           | `.`                | 1, 3, 7         | yes        | no     | Personal life-tracking app (14 routes) on Vercel with JSON-LD and superforms, part of it `ssr = false`.                                                    |
| [Vantaneant-International-Ltd/vnta](https://github.com/Vantaneant-International-Ltd/vnta/tree/d796dcb11bf9) | `.`                | 1, 7, 9, 9b, 10 | yes        | yes    | Corporate website (12 routes) on adapter-static with JSON-LD and prerendered pages, part of it `ssr = false`.                                              |
| [Gamacore/orchestrate](https://github.com/Gamacore/orchestrate/tree/1e5b5ca4649d)                           | `.`                | 1, 5, 9, 9b     | yes        | yes    | Product site with a blog and a demo console (14 routes) on Cloudflare with JSON-LD and markdown.                                                           |
| [guycorbaz/kesh](https://github.com/guycorbaz/kesh/tree/c780f2e37cf7)                                       | `frontend`         | 7, 9            | no         | yes    | Small-business ERP (49 routes) on adapter-static, `ssr = false`.                                                                                           |
| [athNdev/carbon-panel](https://github.com/athNdev/carbon-panel/tree/beb83bc26934)                           | `web/carbon-panel` | 3, 7, 9         | no         | yes    | Game-server management panel (12 routes) on adapter-static, `ssr = false`, with superforms.                                                                |
| [Ottohesten/fastapi-svelte](https://github.com/Ottohesten/fastapi-svelte/tree/3b4621e0e062)                 | `frontend`         | 3, 9            | no         | yes    | Nutrition and drinking-game rules site (22 routes) with superforms, hooks and form actions.                                                                |
| [addun/cowkoszyku](https://github.com/addun/cowkoszyku/tree/039993ac7951)                                   | `apps/web`         | 8, 9            | no         | yes    | Shopping log for bulk purchases (44 routes) on adapter-node with hooks and form actions.                                                                   |
| [Danieldotcomcoder/fastpitstop](https://github.com/Danieldotcomcoder/fastpitstop/tree/10e18b0e1d5e)         | `apps/web`         | 1, 7, 9, 10     | no         | yes    | Formula 1 second-screen companion (19 routes) on adapter-node with JSON-LD and hooks.                                                                      |
| [AlphaTechini/Mithra](https://github.com/AlphaTechini/Mithra/tree/56fa3b22852b)                             | `apps/web`         | 7, 9, 11        | no         | yes    | Treasury approval console (22 routes) on adapter-static, `ssr = false`, in a workspace.                                                                    |
| [manos-zalokostas/R2WX](https://github.com/manos-zalokostas/R2WX/tree/a78f3f29b4b9)                         | `front`            | 6, 10, 11       | no         | no     | Event-data browser under an optional `[[lang]]` segment (11 routes) on adapter-node under a computed `paths.base`, in a workspace.                         |
| [CUB-CORR/concepts-browser](https://github.com/CUB-CORR/concepts-browser/tree/00a7fa0315fb)                 | `app`              | 8, 9            | no         | yes    | Research concept catalogue with docs (27 routes) on adapter-node with hooks and form actions.                                                              |
| [Gurparkash-Singh/Taqdeer-Alitura](https://github.com/Gurparkash-Singh/Taqdeer-Alitura/tree/d0b8c495d6ad)   | `.`                | 8, 10           | no         | no     | Online shop with an admin (43 routes) with hooks and form actions.                                                                                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 1    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 10   |
| 10  | component-resolution shapes                 | 6    |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Item 12 has no app. The selection script flags two candidates for it: orca, whose head library,
svelte-meta-tags, has an adapter, and one rejected for its `export let` components.

## How the first look runs

As in holdouts 5–34, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: carbon-panel and concepts-browser MIT; kesh EUPL-1.2; vnta NOASSERTION; the other ten have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop orca, bmccorm2's web, R2WX and Taqdeer-Alitura without their env files.
- Runners-up, read and not picked: alexampersandria/diary.computer, TheHoltz/errex,
  simanga-dev/matric-dashboard, HecAguilaV/SIGA, CJ-Uy/KonsulTulong and android-sms-gateway/web-dashboard.
