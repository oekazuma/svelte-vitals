# v1 holdout 28 — selection (2026-10-08)

The twenty-eighth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–27 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdouts 21–27
did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 25–27:
`@tailwindcss/typography`, `@melt-ui/svelte`, `shiki`, `@skeletonlabs/skeleton` and `@oslojs/crypto`
with `@sveltejs/kit` in `package.json`; `postgres` with `@sveltejs/kit` and `drizzle-kit` in
`package.json`; `export const prerender = 'auto'` in route modules; `afterNavigate`, `invalidateAll` and
`{@const` (restricted by file size) in route files; `pushState` with `$app/navigation`, `page.state` with
`$app/state`, and `<svelte:document` in components; and `setContext` in `+layout.svelte` files, which the
code-search API failed to parse and so contributed nothing. As in holdouts 16–27, the pool is this
round's searches only.

7,442 repositories came back; 3,161 remained after dropping 243 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 4,038 with no push in six
months; 1,141 had at least 10 routes and a lockfile; 1,025 were on Svelte 5 and Kit 2; 954 remained
after dropping 13 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 58 copies or mirrors of an excluded app. 701 of the 954 had been read in an earlier round,
as far as the kept read list records (holdouts 9–27); none of those was read again or taken. Of the 253
others, 18 belong to owners of excluded apps and were dropped; 140 were taken round-robin across the
queries, highest-starred first, shallow-cloned and read. The 21 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 15 of the 140 were rejected because more of their components use
`export let` than runes; an SDK, a library's docs site, an example app, a boilerplate, a game template
and a release mirror of another candidate were rejected as not applications. Four otherwise fitting
candidates were dropped because their lockfile disagrees with `package.json`, three because they commit
a submodule, one because it installs a `file:` dependency and one because it installs from a private
registry. Each pick's lockfile was compared with its `package.json` on each declared range: all 14
agree. No pick has a `.gitmodules` file, a committed submodule (gitlink), an `.npmrc` pointing at a
private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                             | Path             | Checklist   | Prerenders | Builds | Why                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ---------------- | ----------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| [rbignon/speedfog-racing](https://github.com/rbignon/speedfog-racing/tree/16f591d3d2aa)         | `web`            | 1, 7        | yes        | no     | Competitive racing site for a video game (28 routes) on adapter-static with prerendered pages and JSON-LD. |
| [Hexdigest123/merckel.dev](https://github.com/Hexdigest123/merckel.dev/tree/bef9abd44921)       | `.`              | 1, 5, 9     | no         | yes    | Personal site (14 routes) on adapter-node with JSON-LD and markdown.                                       |
| [frostbase-dev/frostbase](https://github.com/frostbase-dev/frostbase/tree/389a0211faad)         | `.`              | 3, 9        | no         | yes    | Console of an open-source backend platform (15 routes) on Cloudflare with superforms.                      |
| [CiaronHowell/minilib](https://github.com/CiaronHowell/minilib/tree/44280a29780b)               | `.`              | 3, 9, 10    | no         | yes    | Personal library manager (13 routes) on Vercel with superforms and 12 action files.                        |
| [computerlovetech/umbod](https://github.com/computerlovetech/umbod/tree/3513507fbd33)           | `umbod/frontend` | 5, 8, 9, 10 | no         | yes    | Agent-access gateway console (10 routes) on adapter-node with markdown and hooks.                          |
| [MVRU/Conectando-Corazones](https://github.com/MVRU/Conectando-Corazones/tree/2452c1272767)     | `app`            | 5           | no         | no     | Platform connecting institutions in need with donors (40 routes) on Vercel with Prisma and markdown.       |
| [bingud/filemat](https://github.com/bingud/filemat/tree/29f8b31615ac)                           | `web`            | 7, 9, 9b    | yes        | yes    | Web file manager (23 routes) on adapter-static, `ssr = false`.                                             |
| [wrennhq/wrenn](https://github.com/wrennhq/wrenn/tree/a70ea9991508)                             | `frontend`       | 7, 9, 9b    | yes        | yes    | Infrastructure console (27 routes) on adapter-static, `ssr = false`.                                       |
| [d347h-eth/artgod](https://github.com/d347h-eth/artgod/tree/5696b330534b)                       | `frontend`       | 7, 9        | no         | yes    | On-chain art and trading GUI (36 routes) on adapter-node, `ssr = false`, with a workspace types package.   |
| [ePetrack/Puds2](https://github.com/ePetrack/Puds2/tree/d0a1994969ba)                           | `.`              | 8, 9        | no         | yes    | Energy and utility management platform (54 routes) on adapter-node with hooks and 42 action files.         |
| [faulander/chapterlane](https://github.com/faulander/chapterlane/tree/ac1f96150742)             | `.`              | 8, 9        | no         | yes    | Social reading tracker (31 routes) on adapter-node with hooks and 22 action files.                         |
| [ezcorp-org/EZHarness](https://github.com/ezcorp-org/EZHarness/tree/e3309906d4ca)               | `web`            | 9, 10       | no         | yes    | Web app (59 routes) on a Bun adapter with route groups and prop-decided headings.                          |
| [whadafunk/haps](https://github.com/whadafunk/haps/tree/1989de1e4740)                           | `packages/web`   | 9           | no         | yes    | Self-hosted event invitation platform (22 routes) on adapter-node in a workspace.                          |
| [NASA-ACROSS/across-frontend](https://github.com/NASA-ACROSS/across-frontend/tree/8ff597d3569c) | `.`              | 8           | no         | no     | Frontend of a science web service (25 routes) on adapter-node with hooks and 11 action files.              |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 0    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 11   |
| 10  | component-resolution shapes                 | 3    |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 2, 4, 6, 11 and 12 have no app: none of the 140 read emits alternate-language links or uses a
meta-tag library; the two that set `kit.paths.base` were dropped for a `file:` dependency and a
committed submodule; and the workspace packages of artgod and haps hold types and helpers, no
components.

## How the first look runs

As in holdouts 5–27, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: frostbase, wrenn and across-frontend Apache-2.0; umbod and EZHarness MIT; Conectando-Corazones and artgod AGPL-3.0; filemat GPL-3.0; the other six have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop speedfog-racing, Conectando-Corazones and across-frontend without their env files; Conectando-Corazones also uses Prisma, whose client has to be generated before it builds.
- Runners-up, read and not picked: Liatir/liatir-app, xenycx/rivetpanel, flamboh/engage-form-mono,
  Le-Space/belege, H1K0/tanabata, javaBin/javaBinKids and johndavedecano/laragym.
