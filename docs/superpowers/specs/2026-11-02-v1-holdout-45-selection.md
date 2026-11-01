# v1 holdout 45 — selection (2026-11-02)

The forty-fifth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–44 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–44 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 29–44: `runed`,
`arktype`, `arctic`, `shiki`, `@skeletonlabs/skeleton`, `postgres`, `@melt-ui/svelte`,
`@tanstack/svelte-table`, `sveltekit-i18n`, `@tiptap/starter-kit`, `@formkit/auto-animate` and
`@tailwindcss/typography` with `@sveltejs/kit` in `package.json`; `role="tablist"`, `role="alert"`,
`aria-controls`, `<caption`, `<address`, `<mark`, `<svelte:document`, `bind:clientWidth` and `<th scope`
in Svelte files; `transition:fade` in route Svelte files; `export const prerender = 'auto'` and
`request.formData()` in TypeScript route modules; and `redirect(308`, `redirect(301`, `event.platform`
and `getClientAddress` in TypeScript. As in holdouts 16–44, the pool is this round's searches only.

The 13,946 results named 13,945 repositories, and one of them did not resolve. 6,789 remained after
dropping 447 excluded repositories (the corpus repositories and every candidate and runner-up of earlier
holdouts) and 6,709 with no push in six months. GitHub's hourly rate limit cut the file listing short; it
was rerun after the limit reset, after which two repositories still could not be listed. 1,538 had at
least 10 routes and a lockfile; 1,371 were on Svelte 5 and Kit 2, after dropping one whose `package.json`
could not be read; 1,214 remained after dropping 23 app directories named `docs`, `site`, `examples`,
`templates`, `tests`, `demo` or similar, and 134 copies or mirrors of an excluded app. 1,091 of the 1,214
had been read in an earlier round, as far as the kept read list records (holdouts 9–44); none of those
was read again or taken. Of the 123 others, 31 belong to owners of excluded apps and were dropped; all 92
left were shallow-cloned and read. As in holdouts 38–44, every clone's source files were compared with
the corpus clones, `components/ui/` left out: three candidates share most of their source files with a
corpus app (124 of 162, 701 of 1,043 and 405 of 505) and were dropped as copies. The 20 finalists (picks
and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing
was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 14 of the 92 were rejected because runes are in half their
components or fewer, one of them also a copy. Five were dropped as not fitting: a component library, a
tutorial app, a branch of a template tree, a copy of another project's repository kept for evaluation,
and a variant of another candidate by the same owner. Twelve otherwise fitting candidates were dropped:
two commit a gitlink (one of them also a `file:` dependency outside its checkout, the other a lockfile
that disagrees with `package.json`), four a `file:`/`link:` dependency outside the checkout (one of them
also a second lockfile), three a lockfile that disagrees with `package.json` (two of them also a second
lockfile), and three two lockfiles. Each pick's lockfile was compared with its `package.json` on each
declared range: all 14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at a
private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                   | Path          | Checklist       | Prerenders | Builds | Why                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ------------- | --------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [paulgerlach/paul](https://github.com/paulgerlach/paul/tree/5550d3e46306)                             | `.`           | 1, 3, 5, 9      | no         | yes    | Marketing site of a landlord-and-tenant software company (55 routes) on adapter-vercel with JSON-LD, superforms, a markdown chat widget, hooks and form actions. |
| [andreabuttarelli/feega](https://github.com/andreabuttarelli/feega/tree/a1f47333c882)                 | `.`           | 1, 5, 7, 9      | no         | yes    | Infinite design canvas shared by people and AI agents (66 routes) on adapter-vercel with JSON-LD, markdown docs, hooks and form actions, the app `ssr = false`.  |
| [colibri-hq/colibri](https://github.com/colibri-hq/colibri/tree/2a282d3e9d02)                         | `apps/app`    | 5, 8, 9, 10, 11 | no         | yes    | Self-hosted ebook library (25 routes) on adapter-node with hooks and form actions, UI from a workspace package.                                                  |
| [olell/uURU](https://github.com/olell/uURU/tree/f5e78f7ec35f)                                         | `frontend`    | 6, 7, 9, 9b, 10 | yes        | yes    | Self-registration frontend for a telephone exchange (13 routes) on adapter-static under `paths.base` `/app`, `ssr = false` with `prerender = true`.              |
| [wolfwdavid/tran_real_estate](https://github.com/wolfwdavid/tran_real_estate/tree/7372b611be76)       | `apps/web`    | 1, 6, 9, 9b, 10 | yes        | yes    | Real-estate tools with renter, investor and agent portals (44 routes) on adapter-static under an environment-set `paths.base`, with JSON-LD.                     |
| [hurtener/Harbor](https://github.com/hurtener/Harbor/tree/7f1a3b3d8308)                               | `web/console` | 7, 9, 10        | no         | yes    | Operator console of a Go runtime for AI agents (22 routes) on adapter-static, `ssr = false`.                                                                     |
| [Wjouter/InTheKnow](https://github.com/Wjouter/InTheKnow/tree/9653c3c6ba87)                           | `frontend`    | 8, 9            | no         | yes    | Self-hosted watcher that reports changes in iCalendar feeds (28 routes) on adapter-node with hooks and form actions.                                             |
| [jmorf/ldns](https://github.com/jmorf/ldns/tree/5fa09d05e2fd)                                         | `ldns2`       | 1, 9            | no         | yes    | DNS and domain toolkit site (31 routes) on adapter-cloudflare with JSON-LD and hooks.                                                                            |
| [94mrdshyml/open-loops](https://github.com/94mrdshyml/open-loops/tree/640279a4e788)                   | `.`           | 1, 9, 10        | no         | yes    | Editorial explainer blog (31 routes) on adapter-cloudflare with JSON-LD, hooks and form actions.                                                                 |
| [Indy-Center/training-tools](https://github.com/Indy-Center/training-tools/tree/fc611f9152b4)         | `.`           | 5, 9            | no         | yes    | Training management for an air-traffic-control simulation group (11 routes) on a forked Cloudflare adapter with markdown, hooks and form actions.                |
| [Carson-Fricke/FCA](https://github.com/Carson-Fricke/FCA/tree/a6fda770e7c9)                           | `src/ui`      | 5, 7, 9         | no         | yes    | UI of a market-data and trading platform (21 routes) on adapter-static with markdown, `ssr = false`.                                                             |
| [Drezzing/storefront](https://github.com/Drezzing/storefront/tree/2cdcfb8a2f88)                       | `.`           | 3, 7, 8, 9, 9b  | yes        | yes    | Clothing storefront (19 routes) on adapter-node with superforms, hooks and form actions, one route `ssr = false`.                                                |
| [dimastirtan/portalditek-revamp](https://github.com/dimastirtan/portalditek-revamp/tree/e07c7fcdccdc) | `.`           | 9, 9b           | yes        | yes    | Internal portal of an aerospace company's technology directorate (24 routes) on adapter-node, a few static routes prerendered.                                   |
| [Cyxno/tornscope](https://github.com/Cyxno/tornscope/tree/f771902422e5)                               | `apps/web`    | 9               | no         | yes    | Self-hosted analytics and history portal for an online game (29 routes) on adapter-node with hooks.                                                              |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 14   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Items 2, 4 and 12 have no app: the one pick with an alternate-language link (paul) points it at its own
canonical URL in its only language, and no candidate uses a meta-tag library or a head set through an
npm package.

## How the first look runs

As in holdouts 5–44, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: uURU and ldns MIT; feega and Harbor Apache-2.0; colibri and tornscope AGPL-3.0; InTheKnow GPL-3.0; the other seven have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Runners-up, read and not picked: jmantonellini/conforma-system, SilosMC/silos-mc-windows,
  drlholloway/akashic, ishaandixit22/ARTHSCAN, at-creations/atcreations and not-skylarrr/reselling-app.
