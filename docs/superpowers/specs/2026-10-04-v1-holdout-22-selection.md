# v1 holdout 22 — selection (2026-10-04)

The twenty-second holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–21 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdout 21 failed
C6. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before svelte-vitals
has run on any of them**. The criteria are judged on the first look only. C8 is published but does not
decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false positives come
from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under its earlier
definition.

## How they were chosen

Search: one new round of code search (12 queries) aimed at the checklist items earlier rounds left
thin and at the shapes holdouts 20 and 21 touched: `svelte-meta-tags` in `package.json` and with
`MetaTags` in components; `paraglide` with `languageTag` in route files; `<svelte:head>` with
`hreflang`; `sveltekit-superforms` with `zod` in `package.json`; `mdsvex` with `extensions` in
`svelte.config.js`; `adapter-node` with `hooks.server` in `package.json`; `let props = $props()` in
`src/lib`; `page.url.pathname.startsWith` and `Dialog.Title` in route files; `handle` with `redirect(`
in `hooks.server.ts`; and `application/ld+json` in route files. One query, on `prerender` in
`+layout.ts`, failed to parse on the code-search API and was replaced by the `mdsvex` one. As in
holdouts 16–21, the pool is this round's searches only.

5,282 repositories came back; 2,228 remained after dropping 180 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 2,874 with no push in six
months; 824 had at least 10 routes and a lockfile; 736 were on Svelte 5 and Kit 2; 706 remained after
dropping 8 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar,
and 22 copies or mirrors of an excluded app. 521 of the 706 had been read in an earlier round, as far as
the kept read list records (holdouts 9–21); none of those was read again or taken. Of the 185 others, 11
belong to owners of excluded apps and were dropped; 140 were taken round-robin across the queries,
highest-starred first, shallow-cloned and read. The 21 finalists (picks and runners-up) were re-fetched
at pin time, and every pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 10 of the 140 were rejected because more of their components use
`export let` than runes. Two otherwise fitting candidates were dropped because their lockfile disagrees
with `package.json`. Each pick's lockfile was compared with its `package.json` on each declared range:
all 14 agree. No pick has a `.gitmodules` file, an `.npmrc` pointing at a private registry or a
`file:`/`link:` dependency outside its checkout.

The pool is thinner than in recent rounds: three in four of the filtered repositories had already been
read, so the picks lean towards smaller and less-starred apps.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                   | Path             | Checklist          | Prerenders | Builds | Why                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------- |
| [lunarr-app/lunarr-go](https://github.com/lunarr-app/lunarr-go/tree/af35226b6a86)                     | `.`              | 8, 9, 10           | no         | yes    | Self-hosted media server UI (30 routes) on adapter-node with hooks and form actions.     |
| [supatv/web](https://github.com/supatv/web/tree/079e27e19383)                                         | `.`              | 9, 10, 9b          | yes        | yes    | Twitch utilities site (11 routes) on Cloudflare with nine prerendered routes.            |
| [solyto/app](https://github.com/solyto/app/tree/22c5a68e4500)                                         | `.`              | 5, 9, 10           | no         | yes    | Personal management app (42 routes) on adapter-node with markdown notes.                 |
| [smovidya/pussadu](https://github.com/smovidya/pussadu/tree/ca040226585e)                             | `.`              | 3, 9, 10           | no         | yes    | Supplies-tracking app (21 routes) on Cloudflare with superforms and hooks.               |
| [kayordDX/pos](https://github.com/kayordDX/pos/tree/e8e6169a407f)                                     | `client`         | 3, 7, 10           | no         | no     | Point-of-sale front end (70 routes) on adapter-static: superforms, `ssr = false`.        |
| [Great-Falls-Tool-Bus/gftb-site](https://github.com/Great-Falls-Tool-Bus/gftb-site/tree/28878ae0ba5f) | `.`              | 1, 5, 6, 9, 10, 9b | yes        | yes    | Community site (10 routes) on adapter-static under a `paths.base`: JSON-LD, markdown.    |
| [colinbate/storied](https://github.com/colinbate/storied/tree/3cd9dfdddafa)                           | `.`              | 5, 9, 10           | no         | yes    | Book-club software (54 routes) on Cloudflare: markdown, hooks, forty-one action files.   |
| [data-miner00/webutils](https://github.com/data-miner00/webutils/tree/2f32b58f738a)                   | `.`              | 5, 7, 9, 10, 9b    | yes        | yes    | Self-hosted web utilities (57 routes) on adapter-static: markdown, `ssr = false`.        |
| [radnou/sci-manager-renew](https://github.com/radnou/sci-manager-renew/tree/9fc6564905bf)             | `frontend`       | 7, 9, 10, 9b       | yes        | yes    | Property-company manager (48 routes) on adapter-node with `ssr = false` routes.          |
| [notizen-00/u-cms](https://github.com/notizen-00/u-cms/tree/11c72baea9cf)                             | `apps/dashboard` | 5, 8, 9, 10        | no         | yes    | CMS dashboard (31 routes) on adapter-node: markdown, hooks, prop-decided headings.       |
| [DevelexGroup/DevelexTasks](https://github.com/DevelexGroup/DevelexTasks/tree/8df9d982028f)           | `.`              | 6, 7, 9, 10, 9b    | yes        | yes    | Task app (16 routes) on adapter-static under a `paths.base`, eight `ssr = false` routes. |
| [PRECEPTORST/preceptor-fisic](https://github.com/PRECEPTORST/preceptor-fisic/tree/c43996eb4fbc)       | `.`              | 1, 9, 10           | no         | yes    | Clinical prescription platform (46 routes) on Vercel: JSON-LD, hooks, form actions.      |
| [hoagsmedia/dead-and-tattooed](https://github.com/hoagsmedia/dead-and-tattooed/tree/38c70315a338)     | `.`              | 1, 3, 9, 10        | no         | yes    | Shop for an artist (18 routes): JSON-LD, superforms, hooks and form actions.             |
| [Neil-Watson-UK/arthawks](https://github.com/Neil-Watson-UK/arthawks/tree/80ddd5ab0eac)               | `.`              | 9, 10              | no         | yes    | Venue directory (44 routes) on adapter-node with prop-decided headings.                  |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 2    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 5    |

Items 2 and 4 have no app: the `paraglide`, `hreflang` and `svelte-meta-tags` searches left no unread
application that passed the filters. Items 11 and 12 have none either among the 140 read.

## How the first look runs

As in holdouts 5–21, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: lunarr-go Apache-2.0; supatv and storied MIT; solyto AGPL-3.0; webutils EUPL-1.2;
  gftb-site and sci-manager-renew NOASSERTION; the other seven have no license GitHub classifies. The
  measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop kayordDX/pos without its env files.
- Runners-up, read and not picked: izderadicka/mbs4-client, kevinnapit/sigma-phaseII,
  ContextVM/contextvm-site, iimcz/mas-ui, stinaaastrom/tidig, cmlong05/anyWarehouse_front and
  jswetzen/tryggare.
