# v1 holdout 31 — selection (2026-10-11)

The thirty-first holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–30 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28 and 30 passed every deciding criterion and the
others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 25–30:
`svelte-dnd-action`, `@tanstack/table-core`, `three`, `marked`, `i18next`, `resend` and `jose` with
`@sveltejs/kit` in `package.json`; `export const actions` in route modules over 4 KB and
`export const prerender = false` in route modules; `twitter:card`, `getContext(` and
`application/ld+json` (over 2 KB) in `src/lib` Svelte files; `{#key` in route files; and `relative:`
with `paths` in `svelte.config.js`. As in holdouts 16–30, the pool is this round's searches only.

8,549 repositories came back; 4,097 remained after dropping 309 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 4,143 with no push in six
months; 1,500 had at least 10 routes and a lockfile; 1,333 were on Svelte 5 and Kit 2; 1,184 remained
after dropping 11 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 138 copies or mirrors of an excluded app. 951 of the 1,184 had been read in an earlier
round, as far as the kept read list records (holdouts 9–30); none of those was read again or taken. Of
the 233 others, 28 belong to owners of excluded apps and were dropped; 140 were taken round-robin across
the queries, highest-starred first, shallow-cloned and read. The 20 finalists (picks and runners-up)
were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was
installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 20 of the 140 were rejected because more of their components use
`export let` than runes. Seven otherwise fitting candidates were dropped: three because they install a
`file:` or `link:` dependency outside their checkout, one because its `.npmrc` points at a private
registry, one because it commits a gitlink, one because its lockfile disagrees with `package.json`, and
one because it commits two lockfiles for one app. Each pick's lockfile was compared with its
`package.json` on each declared range: all 14 agree. No pick has a `.gitmodules` file, a committed
submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside
its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                     | Path                   | Checklist          | Prerenders | Builds | Why                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------- |
| [openclaw/clickclack](https://github.com/openclaw/clickclack/tree/e9938a42620d)                         | `apps/web`             | 1, 5, 7, 9, 9b, 10 | yes        | yes    | Team chat app (10 routes) on adapter-static, `ssr = false`, with JSON-LD and a prerendered page.         |
| [boboshan/wwiser](https://github.com/boboshan/wwiser/tree/eea8e51f7ce3)                                 | `.`                    | 1, 7, 9, 9b, 10    | yes        | yes    | Browser tools for sound designers (13 routes) on Cloudflare, `ssr = false`, with JSON-LD.                |
| [Your-Business-Today/jewelbb](https://github.com/Your-Business-Today/jewelbb/tree/a72399c075c1)         | `.`                    | 1, 5, 9, 9b        | yes        | yes    | Property business site (30 routes) on Vercel with JSON-LD, markdown, hooks and form actions.             |
| [csuzw/gothic-garrison](https://github.com/csuzw/gothic-garrison/tree/625b315e5ccd)                     | `apps/gothic-garrison` | 1, 9, 11           | no         | yes    | List builder for a tabletop game (12 routes) on adapter-node with JSON-LD, in a workspace.               |
| [DSA-Woodshed/dsa-woodshed.space](https://github.com/DSA-Woodshed/dsa-woodshed.space/tree/9baaf71bd462) | `.`                    | 1, 5, 6, 9, 9b     | yes        | yes    | Interview-practice site (16 routes) on adapter-static under a `paths.base`, seven routes prerendered.    |
| [nickheyer/distroface](https://github.com/nickheyer/distroface/tree/d478c4c35b03)                       | `web/distroface`       | 3, 7, 9, 10        | no         | yes    | Container registry UI (33 routes) on adapter-static, `ssr = false`, with superforms.                     |
| [lunzai/arguspam](https://github.com/lunzai/arguspam/tree/275631efa9d5)                                 | `web`                  | 3, 8, 10           | no         | no     | Privileged-access management (33 routes) on adapter-node with superforms, hooks and form actions.        |
| [hildanku/xemarify](https://github.com/hildanku/xemarify/tree/555dec38f71c)                             | `web`                  | 3, 7, 9, 9b, 10    | yes        | yes    | Agent management console (14 routes) on adapter-node with superforms, its management area `ssr = false`. |
| [szigetidev/racona-core](https://github.com/szigetidev/racona-core/tree/099f0cc8ef36)                   | `apps/web`             | 5, 8, 9, 10, 11    | no         | yes    | Web desktop environment (11 routes) on adapter-node with 55 markdown files and hooks, in a workspace.    |
| [kclejeune/sparkles](https://github.com/kclejeune/sparkles/tree/985e3e0c334b)                           | `ui`                   | 1, 6, 7, 9, 10     | no         | yes    | RDF query console (15 routes) on adapter-static under a `paths.base`, `ssr = false`, with JSON-LD.       |
| [monxas/remote-pulse](https://github.com/monxas/remote-pulse/tree/63e0de542dea)                         | `web`                  | 6, 7, 9, 10        | no         | yes    | Fleet monitoring dashboard (12 routes) on adapter-static under a `paths.base`, `ssr = false`.            |
| [it-bcs-tech/erp-bcs-frontend](https://github.com/it-bcs-tech/erp-bcs-frontend/tree/ae02bc503ba8)       | `.`                    | 5, 8, 9, 10        | no         | yes    | ERP frontend (159 routes) on adapter-node with hooks and form actions.                                   |
| [sernl/listing-sync](https://github.com/sernl/listing-sync/tree/360f10a666a8)                           | `web`                  | 7, 9, 10           | no         | yes    | Seller console for teaching materials (67 routes) on adapter-static, `ssr = false`.                      |
| [jerryboganda/radiologyos](https://github.com/jerryboganda/radiologyos/tree/8254579b00b1)               | `apps/web`             | 8, 9, 9b, 10       | yes        | yes    | Radiology learning app (23 routes) on adapter-node with hooks and form actions.                          |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 6    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 7    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 11   |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 6    |

Items 2, 4 and 12 have no app: none of the 140 read emits alternate-language links, uses a meta-tag
library or renders its head from an npm package.

## How the first look runs

As in holdouts 5–30, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: clickclack, distroface and racona-core MIT; sparkles and remote-pulse Apache-2.0; arguspam and xemarify AGPL-3.0; dsa-woodshed.space and listing-sync NOASSERTION; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: arguspam imports `$env/static`, which stops its build without its env files.
- Runners-up, read and not picked: FlorianLeChat/Pericles-Initiative, breezy-bays-labs/mokumo,
  Saeraphinx/BadModelSaber, deafirefly/whatsupsanlee-app-svelte, yashau/prick and cryptly-dev/cryptly.
