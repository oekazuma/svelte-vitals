# v1 holdout 34 — selection (2026-10-14)

The thirty-fourth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–33 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31 and 32 passed every deciding criterion
and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is
published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–33: `@supabase/ssr`,
`flowbite-svelte`, `@sveltejs/adapter-netlify`, `date-fns`, `@tanstack/svelte-query`, `gsap`,
`posthog-js`, `sharp`, `@fontsource`, `katex`, `zod` and `mapbox-gl` with `@sveltejs/kit` in
`package.json`; `fail(400`, `depends(` and `setHeaders` in TypeScript route modules; `cookies.set` in
TypeScript under `src`; `hreflang` in TypeScript; `export const prerender = true` and
`export const ssr = false` in JavaScript route modules; `onNavigate`, `preloadData`, `$state.raw` and
`twitter:image` in Svelte files; `<svelte:options`, `invalidate(` and `{#snippet` (over 5 KB) in route
files; and `$page.url` and `json-ld` in `src/lib` Svelte files. As in holdouts 16–33, the pool is this
round's searches only.

15,472 repositories came back; 51 no longer resolved. 6,667 remained after dropping 369 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 8,385
with no push in six months. GitHub's hourly rate limit stopped the file listing of 898 of them partway;
it was rerun after the limit reset, and two still failed to list. 1,728 had at least 10 routes and a
lockfile; 1,532 were on Svelte 5 and Kit 2; 1,390 remained after dropping 30 app directories named
`docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and 112 copies or mirrors of an
excluded app. 1,176 of the 1,390 had been read in an earlier round, as far as the kept read list records
(holdouts 9–33); none of those was read again or taken. Of the 214 others, 31 belong to owners of
excluded apps and were dropped; 140 were taken round-robin across the queries, highest-starred first,
shallow-cloned and read. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every
pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter or
demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10 routes,
and a push within six months. 34 of the 140 were rejected because runes are in half their components or
fewer. Six otherwise fitting candidates were dropped: two because they commit two lockfiles for one app,
two because their `.npmrc` points at a private registry, one because it commits a gitlink and its
lockfile disagrees with `package.json`, and one because it installs a `file:` dependency outside its
checkout. Each pick's lockfile was compared with its `package.json` on each declared range: all 14 agree.
No pick has a committed submodule (gitlink), an `.npmrc` pointing at a private registry or a
`file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                       | Path                         | Checklist          | Prerenders | Builds | Why                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| [tellbow/schwingen](https://github.com/tellbow/schwingen/tree/ebe3f48e6456)                               | `.`                          | 2, 9               | no         | yes    | Statistics site for Swiss wrestling (15 routes) on a Bun adapter with alternate-language links and hooks.            |
| [RafayGhafoor/gjms-frontend](https://github.com/RafayGhafoor/gjms-frontend/tree/fe648f2d26d7)             | `.`                          | 1, 2, 9, 9b        | yes        | yes    | Academic journal website (13 routes) on adapter-static with JSON-LD, alternate-language links and prerendered pages. |
| [chicomcastro/harpa-crista-online](https://github.com/chicomcastro/harpa-crista-online/tree/6f740478dffa) | `.`                          | 1, 6, 7, 9, 9b, 10 | yes        | yes    | Hymnal app (12 routes) on adapter-static under a `paths.base`, `ssr = false`, with JSON-LD and prerendered pages.    |
| [AlecDusheck/receiverproxy](https://github.com/AlecDusheck/receiverproxy/tree/dab8b41aa7e0)               | `web`                        | 7, 9, 9b           | yes        | yes    | Control console for LED receiver cards (17 routes) on Cloudflare, `ssr = false`, its routes prerendered.             |
| [sansseriff/lab-wizard](https://github.com/sansseriff/lab-wizard/tree/c8274a8f8d18)                       | `lab_wizard/wizard/frontend` | 7, 9, 9b           | yes        | yes    | Lab-instrument measurement console (17 routes) on adapter-static, `ssr = false`, its routes prerendered.             |
| [DawoT/kipuspay](https://github.com/DawoT/kipuspay/tree/fb9587b8eacb)                                     | `apps/pos-web`               | 9, 11              | no         | yes    | Point-of-sale app (52 routes) on Cloudflare with hooks, in a workspace.                                              |
| [wowcrise54/iris-web-utmn](https://github.com/wowcrise54/iris-web-utmn/tree/6cac74aebbb7)                 | `v3/frontend`                | 8                  | no         | no     | Incident-response case manager (66 routes) on adapter-node with hooks and form actions.                              |
| [darrelhong/openplays](https://github.com/darrelhong/openplays/tree/0592884ff152)                         | `web`                        | 8                  | no         | no     | Social app for pick-up sports games (22 routes) on adapter-node with hooks and form actions.                         |
| [bence-boer/clanqr](https://github.com/bence-boer/clanqr/tree/e1b978b3a663)                               | `web`                        | 5, 7, 10, 11       | no         | no     | AI agent management console (16 routes) on adapter-node, `ssr = false`, with markdown, in a workspace.               |
| [grinlemon/sackli](https://github.com/grinlemon/sackli/tree/9ccc338181da)                                 | `.`                          | 1, 9               | no         | yes    | Household budget planner (14 routes) on Vercel with JSON-LD, hooks and form actions.                                 |
| [QaidVoid/awsim](https://github.com/QaidVoid/awsim/tree/eb227bfc04e5)                                     | `ui`                         | 6, 7, 9, 10        | no         | yes    | Console of an offline AWS emulator (76 routes) on adapter-static under a `paths.base`, `ssr = false`.                |
| [BCYCAData/soc-dev](https://github.com/BCYCAData/soc-dev/tree/aaf2de27922b)                               | `.`                          | –                  | no         | no     | Portal for community organisations (89 routes) on Vercel with hooks and form actions.                                |
| [andrei0x309/flashsoft-sk](https://github.com/andrei0x309/flashsoft-sk/tree/7d45109e4dd8)                 | `.`                          | 1                  | no         | no     | Personal website (10 routes) with JSON-LD and hooks.                                                                 |
| [onassis-salinas/CSTGRP_ERP](https://github.com/onassis-salinas/CSTGRP_ERP/tree/68c9d31f519a)             | `apps/app`                   | 5, 7, 9, 9b        | yes        | yes    | Manufacturing ERP (61 routes) on adapter-static, `ssr = false`, with markdown and a prerendered page.                |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 2    |
| 9   | likely builds without services              | 9    |
| 10  | component-resolution shapes                 | 3    |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 5    |

Items 3, 4 and 12 have no app. The one candidate using superforms was rejected for its `export let`
components, and none of the 140 uses a meta-tag library. The four the selection script flags for item 12
import Skeleton's `AppBar`, a header bar that renders no head in the two versions read
(`@skeletonlabs/skeleton` 2.8.0, `@skeletonlabs/skeleton-svelte` 1.2.3).

## How the first look runs

As in holdouts 5–33, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: receiverproxy and sackli MIT; awsim Apache-2.0; iris-web-utmn LGPL-3.0; the other ten have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop iris-web-utmn, openplays, clanqr, soc-dev and flashsoft-sk without their env files.
- Runners-up, read and not picked: Caleb-Irwin/oem3, dhrvjgd/metapress, jordanwallwork/deckle,
  tktb-tess/uq-tess-xi, Vilsol/go-pob and PaoloJN/stickerz.
