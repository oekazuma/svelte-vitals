# v1 holdout 14 — selection (2026-10-01)

The fourteenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–13 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only; C8
is published but no longer decides the result (`2026-10-01-c8-design-share.md`).

## How they were chosen

Search: the pool of holdouts 3–13 (as recorded in the carried-over repository metadata) plus one new
round of code search (12 queries; three that GitHub could not parse were rewritten and rerun) aimed at
the shapes holdout 13's fixes touched and at the checklist items it left empty: `{@render children()}`
next to `{:else` in a route file; `z.enum(` next to `as const`; `if (!locals.user)` /
`if (!locals.session)` next to `redirect(`, and `error(401` next to `locals`, in route modules;
`svelte-meta-tags` and `svelte-seo` in `package.json`; a literal `paths.base`; `workspace:*` UI
packages; `application/ld+json` in route files; `hreflang` in `src/lib`; and `sveltekit-superforms`
in `package.json`.

18,745 repositories came back, 1,282 of them new; 9,377 remained after dropping the 277 of the 284
excluded repositories that appeared (the corpus repositories and every candidate and runner-up of
earlier holdouts) and 9,090 with no push in six months; 2,716 had at least 10 routes and a lockfile;
2,467 were on Svelte 5 and Kit 2; 2,300 remained after dropping 68 app directories named `docs`,
`site`, `examples`, `templates`, `tests`, `demo` or similar, and 99 copies or mirrors of an excluded
app. 925 of the 2,300 had been read in an earlier round, as far as the read lists of holdouts 7–13
record (those of holdouts 5 and 6 are no longer available, so an app read and rejected then could be
read again; every pick and runner-up of those rounds stays excluded); none of those was read again or
taken. Of the 1,375 others, 305 had a hit from the new searches (5 belong to owners of excluded apps
and were dropped); 140 of them were read from a shallow clone, taken round-robin across the eight
shapes that had hits, highest-starred first. The meta-tag library, `paths.base` and workspace-UI
searches left no unread application with 10 routes. The 21 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 15 of the 140 were rejected because more of their components use
`export let` than runes. Two otherwise fitting candidates were dropped as one codebase published twice
(HyuseCS/HRIS and Aguynamedkent7/Veent_HRIS). Each pick's lockfile was compared with its `package.json`
on each declared range: all 14 agree, two of them (ubumaths' `esbuild`, otterscale's `vite`) through
the project's own pnpm `overrides`. No pick has a `file:`/`link:` dependency outside its checkout or an
`.npmrc` registry; JobPilot's `.gitmodules` names one public submodule (an SDK under `docs/references`).

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                     | Path           | Checklist          | Prerenders | Builds | Why                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | -------------- | ------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Zahara-Nour/ubumaths](https://github.com/Zahara-Nour/ubumaths/tree/d7ab0237cb13)       | `.`            | 5, 7, 10           | yes        | no     | Math-learning app built by a teacher: 270 routes, 1,007 components; a dashboard layout renders its children in two `{#if}` arms; `z.enum` over `as const` lists; hooks and load gates. |
| [ontoplano/ontoplano](https://github.com/ontoplano/ontoplano/tree/892c2ed096c2)         | `.`            | 5, 8, 9, 10        | no         | yes    | Self-hosted life organizer (64 routes, 49 action files) on adapter-node; the root layout renders its children in two arms and its server load redirects on `locals`.                   |
| [scottcarlton/threadline](https://github.com/scottcarlton/threadline/tree/1927c3784954) | `.`            | 3, 5, 10           | no         | no     | Wholesale sales SaaS (84 routes): superforms, `z.enum` over `as const` channel lists, children in several arms in two layouts, session gates in hooks and loads.                       |
| [vrennat/nah-tools](https://github.com/vrennat/nah-tools/tree/c676b6ed12a5)             | `.`            | 1, 7, 9, 9b, 10    | yes        | yes    | Public browser-tools site on Cloudflare (135 routes): JSON-LD on the tool pages, a `ssr = false` management page, two prerendered pages.                                               |
| [syr-is/syr](https://github.com/syr-is/syr/tree/139dbed01f21)                           | `apps/syr/app` | 3, 5, 8, 10, 11    | no         | no     | Social app (32 routes) whose UI comes from the workspace package `@syr-is/ui` (138 components); a settings layout renders its children in two arms; a `(private)` layout gate.         |
| [simonbrunou/diversif](https://github.com/simonbrunou/diversif/tree/4a32a01b291a)       | `.`            | 1, 2, 8, 9, 9b, 10 | yes        | yes    | Self-hosted baby-food diversification tracker (34 routes, French UI): JSON-LD and alternates, the root layout renders its children in three places.                                    |
| [atiohaidar/s2if](https://github.com/atiohaidar/s2if/tree/44573f831c88)                 | `.`            | 5, 9, 9b, 10       | yes        | yes    | University course-notes site (78 routes) on adapter-static, `paths.base` from `BASE_PATH`; the root layout renders its children in two arms.                                           |
| [mia-cx/maal](https://github.com/mia-cx/maal/tree/74a12ec38f6c)                         | `.`            | 1, 3, 5, 9, 10     | no         | yes    | Household meal-planning app on Cloudflare (14 routes, 414 components): JSON-LD, superforms, an `(app)` layout with children in two arms, a hooks session gate.                         |
| [Optikt/optikt-app](https://github.com/Optikt/optikt-app/tree/7e2fed416152)             | `.`            | 9, 10              | no         | yes    | Optical-store management system (47 routes, 424 components); `z.enum` over exported `as const` lists; an `(app)` layout gate.                                                          |
| [akmmp241/akmmp-porto](https://github.com/akmmp241/akmmp-porto/tree/1b58e7ba5b75)       | `.`            | 1, 2, 3, 8, 9, 10  | no         | yes    | Personal blog with an admin area (30 routes): JSON-LD built in `{#each}`, alternates, superforms; root and admin layouts render children in two arms; an admin load gate.              |
| [otterscale/dashboard](https://github.com/otterscale/dashboard/tree/2ffeabbb9cd6)       | `.`            | 5, 9, 10           | no         | yes    | Kubernetes and VM management console (22 routes, 558 components) on adapter-node; session gates in hooks and route loads.                                                              |
| [Mbehbahani/JobPilot](https://github.com/Mbehbahani/JobPilot/tree/aed10d813aab)         | `.`            | 2, 3, 5, 9, 10     | no         | yes    | Job-application orchestration platform (21 routes, 546 components): alternates, superforms, a hooks gate, email templates built with `better-svelte-email`.                            |
| [fcrozatier/SoME](https://github.com/fcrozatier/SoME/tree/253b383a2861)                 | `.`            | 5, 8, 10           | yes        | no     | Summer of Math Exposition site (32 routes, 20 action files) on adapter-node: voting and profile loads gated on the session, markdown content.                                          |
| [radio4000/r4atproto](https://github.com/radio4000/r4atproto/tree/b59ba7aba728)         | `.`            | 7, 9, 9b, 10       | yes        | yes    | Radio4000 on the AT Protocol (17 routes): `ssr = false` in the root layout, adapter-static, `paths.base` from `R4_BASE`.                                                               |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 3    |
| 3   | superforms                                  | 5    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 9    |
| 6   | `kit.paths.base`                            | 0    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 5    |
| 9   | likely builds without services              | 10   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Items 4, 6 and 12 have no app: the meta-tag library and `paths.base` searches found no unread
application that passed the filters, and s2if's and r4atproto's `paths.base` come from environment
variables, as sunnylink's and spelwijsheid's did, so they are not counted. JobPilot's
`better-svelte-email` `<Head>` belongs to email templates, not to a route's head.

Shapes the last fixes touched:

- **Layout children in several arms of one `{#if}`:** ubumaths, ontoplano, threadline, syr, diversif,
  s2if, maal, akmmp-porto.
- **`z.enum` over an exported `as const` list:** ubumaths, threadline, Optikt.
- **Server `load` gates on `locals`:** ubumaths, ontoplano, threadline, syr, Optikt, akmmp-porto,
  otterscale, SoME; **`hooks.server.ts` gates:** ubumaths, ontoplano, threadline, maal, akmmp-porto,
  otterscale, JobPilot.

## How the first look runs

As in holdouts 5–13, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged;
C8 is reported without deciding the result.

## Notes

- License: nah-tools and SoME MIT, ontoplano and otterscale AGPL-3.0, diversif GPL-3.0; the other nine
  have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop ubumaths, threadline and SoME without their env files; syr's
  workspace packages export a `dist/` the checkout does not contain.
- Runners-up, read and not picked: mgetf/website-next, Vegm92/mise-en-place-sk, elijahstorm/thunderlite,
  xpressabhi/selftest-lite, ehubbartt/volition-site, syntaxfm/synhax and averwhy/Penpoint.
