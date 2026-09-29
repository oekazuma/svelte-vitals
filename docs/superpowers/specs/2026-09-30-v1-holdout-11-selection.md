# v1 holdout 11 — selection (2026-09-30)

The eleventh holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–10 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: the pool of holdouts 3–10 (as recorded in the carried-over repository metadata) plus one new
round of code search (12 queries) aimed at the shapes holdout 10's fixes touched and at the checklist:
Prisma `.update({` and Drizzle `db.update(` in route files; a store `.update((` next to
`$app/environment`; `{#if step ==` next to an `<h1>`; `as const` lists next to `{#each`;
`svelte-meta-tags`, `svelte-seo` and `@svelte-put/metatags` in `package.json`; a literal `paths.base`;
`workspace:*` UI packages; and `<svelte:head>`/`<title>` in published package files.

15,610 repositories came back; 7,876 remained after dropping the 213 of the 221 excluded repositories
that appeared (the 150 corpus repositories and every candidate and runner-up of earlier holdouts) and
7,521 with no push in six months; 2,367 had at least 10 routes and a lockfile; 2,145 were on Svelte 5
and Kit 2; 2,008 remained after dropping 66 app directories named `docs`, `site`, `examples`,
`templates`, `tests`, `demo` or similar, and 71 copies or mirrors of an excluded app. 575 of the 2,008
had been read in an earlier round; none of those was read again or taken. Of the 1,433 others, 256 had
a hit from the new searches; 140 of them were read from a shallow clone, taken round-robin across the
seven shapes, highest-starred first. The 21 finalists were re-fetched at pin time. 13 pinned SHAs equal
the clone that was read; zveltio had been pushed to since, so it is pinned to the commit that was read
(e075f279), which exists on GitHub. Nothing was installed, built or run.

The filters are unchanged. 17 of the 140 were rejected because more of their components use
`export let` than runes. Each pick's lockfile was compared with its `package.json`: 13 agree; dsh's
`hub` directory carries a stale `package-lock.json` next to the workspace's `pnpm-lock.yaml` (see
Notes). No pick has a `.gitmodules` file or an `.npmrc` registry.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                     | Path                              | Checklist    | Prerenders | Builds | Why                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [exceptionless/Exceptionless](https://github.com/exceptionless/Exceptionless/tree/0cb2090ce55a)         | `src/Exceptionless.Web/ClientApp` | 6, 7, 9, 10  | no         | yes    | Error-tracking dashboard SPA (63 routes, 655 components) under a literal `paths.base: '/next'`.                                           |
| [tracewayapp/traceway](https://github.com/tracewayapp/traceway/tree/1d6a8e6a4371)                       | `frontend`                        | 7, 9, 10     | yes        | yes    | Observability dashboard SPA; a setup wizard with `{#if step == …}` headings.                                                              |
| [peterthepeter/groly](https://github.com/peterthepeter/groly/tree/f86a9b7ced93)                         | `.`                               | 8, 9, 10     | no         | yes    | Self-hosted grocery app on adapter-node; Drizzle `db.update(…)` in `+server` handlers.                                                    |
| [sira313/rapkumer](https://github.com/sira313/rapkumer/tree/c8700c76719c)                               | `.`                               | 5, 8, 9, 10  | no         | yes    | School report-card app: 62 routes, 39 action files, mdsvex; Drizzle writes in actions and endpoints.                                      |
| [mxz7/nypsi-website](https://github.com/mxz7/nypsi-website/tree/7c890dc888c4)                           | `.`                               | 5, 7, 8, 10  | yes        | no     | Discord bot site: Prisma `update` in actions, mdsvex wiki, a docs header whose `<h1>` depends on a `header` prop.                         |
| [willuhmjs/lingolearn](https://github.com/willuhmjs/lingolearn/tree/99515a1bb39e)                       | `.`                               | 8, 10        | no         | no     | Language-learning app: Prisma `update` in actions; onboarding headings behind `{#if step === …}`.                                         |
| [Hunteraulo1/f95-france](https://github.com/Hunteraulo1/f95-france/tree/5c75b0ae604f)                   | `.`                               | 5, 8, 9, 10  | no         | yes    | Community site on adapter-node with 23 action files; Drizzle writes; markdown blocks rendered as headings.                                |
| [kjetilhoiby/resonans](https://github.com/kjetilhoiby/resonans/tree/e6dca4daaae6)                       | `.`                               | 8, 10        | no         | no     | Health app (61 routes): `as const` domain lists iterated in components; Drizzle writes; a `<svelte:element>` card title.                  |
| [MartinoPolo/prejemesi](https://github.com/MartinoPolo/prejemesi/tree/991e98191723)                     | `.`                               | 2, 10        | no         | yes    | Wishlist app: paraglide with a `cs` alternate; `as const` models; a `<svelte:element>` header.                                            |
| [NERC-Digital-Solutions-Hub/dsh](https://github.com/NERC-Digital-Solutions-Hub/dsh/tree/37eff77bfa5f)   | `hub`                             | 6, 7, 10, 11 | yes        | no     | Research hub under a literal `paths.base: '/dsh'`; UI from seven workspace packages (`@dsh/*`, `svelte` exports into an unbuilt `dist/`). |
| [thowerapp/thower-app](https://github.com/thowerapp/thower-app/tree/3c27beb3f396)                       | `.`                               | 1, 3, 10     | no         | no     | Fitness app (80 routes, 50 action files): superforms, Prisma `update` in admin actions, JSON-LD from a `StructuredData` component.        |
| [NahusenayTadesse/BeautySalon](https://github.com/NahusenayTadesse/BeautySalon/tree/a40979376d20)       | `.`                               | 3, 8, 10     | no         | no     | Salon management (70 routes, 46 action files): superforms and Drizzle writes.                                                             |
| [orchestra-canvas-tokyo/homepage](https://github.com/orchestra-canvas-tokyo/homepage/tree/c6597925cb9e) | `.`                               | 4, 9, 10     | no         | yes    | Orchestra website whose head comes from `svelte-meta-tags` `MetaTags` in a local `Meta` component.                                        |
| [zveltio-devs/zveltio](https://github.com/zveltio-devs/zveltio/tree/e075f27985b6)                       | `packages/studio`                 | 6, 7, 9, 10  | no         | yes    | Headless-CMS studio SPA under a literal `paths.base: '/admin'`; its `(admin)/+layout.ts` writes stores behind `browser`.                  |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 1    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 1    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 7    |
| 9   | likely builds without services              | 8    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 1    |

Items 1 and 2 are thin this round: the searches aimed at the database and heading shapes, and only
thower-app renders JSON-LD and only prejemesi renders alternates. Item 12 still has no app. Item 6
counts three literal bases (`/next`, `/dsh`, `/admin`).

Shapes the last fixes touched:

- **Database-client writes in handlers:** Prisma `update` in actions (nypsi-website, lingolearn,
  thower-app) and Drizzle `db.update(…)` in actions and endpoints (groly, rapkumer, f95-france,
  resonans, BeautySalon) — the class behind holdout 10's false criticals.
- **Store writes behind `browser`:** zveltio's `(admin)/+layout.ts`.
- **`as const` lists iterated in components:** resonans, prejemesi.
- **Sibling `{#if step ==}` headings:** traceway, lingolearn, zveltio.

## How the first look runs

As in holdouts 5–10, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged.

## Notes

- License: Exceptionless Apache-2.0, traceway and zveltio MIT, groly AGPL-3.0; rapkumer and f95-france
  carry a license GitHub does not classify; the other eight have no license file. The measurement reads
  the source and redistributes nothing.
- Install risk: dsh's harness install picks the nearest lockfile, `hub/package-lock.json`, which
  disagrees with `hub/package.json` (its `@dsh/*` workspace packages among them) while the workspace
  itself is pnpm; if that install fails, dsh is measured uninstalled, and its workspace packages are
  still read from source.
- Builds: `$env/static` imports stop resonans, thower-app and BeautySalon without their env files;
  nypsi-website, lingolearn and thower-app need a generated Prisma client.
- Runners-up, read and not picked: nullclaw/nullhub, Calnode/calnode, m1ndgames/OpenFishing,
  NonoHM/budgetpilot, Casterlabs/caffeinated, ErenDexter/ResearchQ and Velfi/digital-garden.
