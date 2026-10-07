# v1 holdout 26 — selection (2026-10-07)

The twenty-sixth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–25 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdouts 21–25
did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 23–25 except two broad
ones restricted by file size: `@sveltejs/enhanced-img`, `paneforge`, `better-sqlite3`, `arctic` and
`stripe` with `@sveltejs/kit` in `package.json`; `@sentry/sveltekit` in `package.json`;
`export const entries` and `trailingSlash` in route modules; `page.data` with `$app/state` in
`src/lib`; `$env/dynamic/public` in components; `hreflang` in `src/lib`; `locale` with `i18n` in
`hooks.server.ts`; and `og:image` with `<svelte:head>` in route files and `$derived.by(` in
`src/lib/components`, restricted by file size. As in holdouts 16–25, the pool is this round's searches
only.

7,793 repositories came back; 3,825 remained after dropping 262 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 3,706 with no push in six
months; 1,315 had at least 10 routes and a lockfile; 1,176 were on Svelte 5 and Kit 2; 1,071 remained
after dropping 8 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 97 copies or mirrors of an excluded app. 761 of the 1,071 had been read in an earlier
round, as far as the kept read list records (holdouts 9–25); none of those was read again or taken. Of
the 310 others, 27 belong to owners of excluded apps and were dropped; 140 were taken round-robin across
the queries, highest-starred first, shallow-cloned and read. The 21 finalists (picks and runners-up)
were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 17 of the 140 were rejected because more of their components use
`export let` than runes. Three otherwise fitting candidates were dropped because their lockfile
disagrees with `package.json`, three because they install `file:` dependencies, and one because it
commits a submodule. Each pick's lockfile was compared with its `package.json` on each declared range:
all 14 agree. No pick has a `.gitmodules` file, a committed submodule (gitlink), an `.npmrc` pointing at
a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                             | Path                | Checklist      | Prerenders | Builds | Why                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------- | ---------- | ------ | --------------------------------------------------------------------------------------------- |
| [hoshi-io/hoshi](https://github.com/hoshi-io/hoshi/tree/d642ece8a76d)                                                           | `hoshi-frontend`    | 7, 9, 10       | no         | yes    | Anime, manga and light-novel tracker (11 routes) on adapter-static, `ssr = false`.            |
| [numerique-gouv/ami-notifications-api](https://github.com/numerique-gouv/ami-notifications-api/tree/b3e608c93665)               | `public/mobile-app` | 10             | no         | no     | Web client of a public-service notification app (38 routes) on adapter-static.                |
| [Giant-Bomb-Preservation-Project/duders-zone](https://github.com/Giant-Bomb-Preservation-Project/duders-zone/tree/8bc3a897a7b1) | `.`                 | 6, 9, 10, 9b   | yes        | yes    | Video-game archive site (10 routes) under a `paths.base`, prerendered.                        |
| [decent-stuff/decent-cloud](https://github.com/decent-stuff/decent-cloud/tree/13dda9dee3c8)                                     | `website`           | 9, 10          | no         | yes    | Decentralised cloud marketplace (44 routes) on adapter-static.                                |
| [funmary-app/funmary](https://github.com/funmary-app/funmary/tree/317bde2bd1f3)                                                 | `apps/web`          | 8, 9, 10       | no         | yes    | University students' portal (36 routes) on adapter-node: workspace packages, 22 action files. |
| [caelyreth/site](https://github.com/caelyreth/site/tree/1304dcda57e3)                                                           | `.`                 | 9, 10, 9b      | yes        | yes    | Personal site (11 routes), every route prerendered.                                           |
| [dsa-ntc/brdsa.github.io](https://github.com/dsa-ntc/brdsa.github.io/tree/43b5dcfead0c)                                         | `.`                 | 5, 9, 10, 9b   | yes        | yes    | Local chapter website (15 routes) on adapter-static with 34 markdown files.                   |
| [limoncc/trailer](https://github.com/limoncc/trailer/tree/1e1179cf1850)                                                         | `trailer-ui`        | 3, 9, 10       | no         | yes    | Experiment-tracker UI (17 routes) on adapter-static with superforms.                          |
| [mathiasscherer2007/lemke-bank](https://github.com/mathiasscherer2007/lemke-bank/tree/618f5b171d4f)                             | `client`            | 8, 9, 10       | no         | yes    | Banking app (25 routes) on adapter-node with hooks and 10 action files.                       |
| [KaisAbiyyi/tarkana](https://github.com/KaisAbiyyi/tarkana/tree/6d17c340bbcd)                                                   | `.`                 | 10             | no         | no     | Supabase-backed app (25 routes) with hooks, actions and prop-decided headings.                |
| [yethdev/greenmods](https://github.com/yethdev/greenmods/tree/d2d7d0c01dd2)                                                     | `ui`                | 1, 9, 10       | no         | yes    | Self-hosted mod host (29 routes) on adapter-static: JSON-LD, hooks, a workspace package.      |
| [freekmetsch/kitchenbrain](https://github.com/freekmetsch/kitchenbrain/tree/4a364d356df4)                                       | `.`                 | 1, 5, 8, 9, 10 | no         | yes    | Self-hosted grocery and meal-plan app (18 routes) on adapter-node: JSON-LD, markdown.         |
| [gluonMaster/reg_allgemein](https://github.com/gluonMaster/reg_allgemein/tree/2186969752c2)                                     | `.`                 | 9, 10          | no         | yes    | Registration portal (44 routes) on Cloudflare with hooks and 30 action files.                 |
| [SampleTown-org/eDNA-SampleTown](https://github.com/SampleTown-org/eDNA-SampleTown/tree/650fdee007c4)                           | `.`                 | 9, 10          | no         | yes    | Laboratory information system (46 routes) on adapter-node with hooks.                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 1    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 2 and 4 have no app: none of the 140 read emits alternate-language links or uses a meta-tag
library. The workspace packages seen (funmary, greenmods) hold no components (item 11).

## How the first look runs

As in holdouts 5–25, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: greenmods, kitchenbrain, reg_allgemein and ami-notifications-api MIT; decent-cloud and funmary Apache-2.0; hoshi AGPL-3.0; duders-zone GPL-3.0; caelyreth/site EUPL-1.2; trailer and tarkana NOASSERTION; the other three have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop ami-notifications-api and tarkana without their env files.
- Runners-up, read and not picked: openstack-afterglow/openstack-afterglow, arokyaillam/Ecom_New,
  watchthelight/pawtropolis-tech, dominikcz/gw2helper, esabook/stokasir, kaikai-kitan/yako_web and
  mikkelsvartveit/nagi.
