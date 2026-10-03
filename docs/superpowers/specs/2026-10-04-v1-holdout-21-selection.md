# v1 holdout 21 — selection (2026-10-04)

The twenty-first holdout for `2026-09-24-v1-release-criteria.md`. Holdout 20 passed every deciding
criterion; its apps joined the tuning corpus, as every holdout's do. These 14 apps are pinned in
`scripts/corpus/holdout.json` and recorded here **before svelte-vitals has run on any of them**. The
criteria are judged on the first look only. C8 is published but does not decide the result
(`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false positives come from two or
more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (12 queries) aimed at the checklist items earlier rounds left
thin and at the shapes holdout 20's fixes touched: `@inlang/paraglide-js` in `package.json`;
`hreflang` with `alternate` in components; `svelte-meta-tags` with `MetaTags` in route files; `svead`
in `package.json`; `{#if` with `&&` next to `$props()` in `src/lib`; `{@html` with `marked` in route
files; `import.meta.glob` with `?raw`; `paths:` with `base:`, and `fallback:` with `adapter-static`,
in `svelte.config.js`; `export const actions` in route modules; `workspace:^` next to
`@sveltejs/kit`; and `superForm(` in route files. As in holdouts 16–20, the pool is this round's
searches only.

6,378 repositories came back; 3,351 remained after dropping one no longer reachable, 172 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and
2,854 with no push in six months; 873 had at least 10 routes and a lockfile; 786 were on Svelte 5 and
Kit 2; 717 remained after dropping 22 app directories named `docs`, `site`, `examples`, `templates`,
`tests`, `demo` or similar, and 47 copies or mirrors of an excluded app. 468 of the 717 had been read
in an earlier round, as far as the kept read list records (holdouts 9–20); none of those was read
again or taken. Of the 249 others, 10 belong to owners of excluded apps and were dropped; 140 were
taken round-robin across the queries, highest-starred first, shallow-cloned and read. The 21
finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone
that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 15 of the 140 were rejected because more of their components use
`export let` than runes. One otherwise fitting candidate was dropped because its lockfile disagrees
with `package.json`. Each pick's lockfile was compared with its `package.json` on each declared range:
all 14 agree. No pick has a `.gitmodules` file, an `.npmrc` pointing at a private registry or a
`file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                             | Path           | Checklist       | Prerenders | Builds | Why                                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | -------------- | --------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| [gnanakeethan/veli](https://github.com/gnanakeethan/veli/tree/ed4e0a310771)                                     | `frontend`     | 1, 2, 8, 9, 10  | no         | yes    | Procedures portal (15 routes) on adapter-node: hreflang alternates, JSON-LD, hooks, form actions.          |
| [sandsower/hundavaent](https://github.com/sandsower/hundavaent/tree/cb93c07de829)                               | `.`            | 9, 10, 11       | no         | yes    | Bilingual place directory (32 routes) on Cloudflare; its head comes from a workspace design-system `Meta`. |
| [Home-Vermeylen/homevermeylen-svelte](https://github.com/Home-Vermeylen/homevermeylen-svelte/tree/5ee32298525b) | `.`            | 1, 3, 9, 10     | no         | yes    | Residence council site (21 routes) on Netlify: JSON-LD, superforms, hooks and form actions.                |
| [dyad-berlin/dyad](https://github.com/dyad-berlin/dyad/tree/e96ceb807b37)                                       | `.`            | 1, 10           | no         | no     | Conversation-matching platform (43 routes) on Cloudflare: JSON-LD, prop-decided headings.                  |
| [Boszsp/discord-wh-manager-v2](https://github.com/Boszsp/discord-wh-manager-v2/tree/53d2a3502446)               | `.`            | 1, 3, 5, 7, 10  | yes        | no     | Webhook manager (10 routes) on adapter-static: JSON-LD, superforms, markdown, `ssr = false`.               |
| [mtaanquist/Codex](https://github.com/mtaanquist/Codex/tree/c170280c82b5)                                       | `.`            | 5, 8, 9, 10     | no         | yes    | Worldbuilding and writing app (27 routes) on adapter-node: markdown, hooks, twenty-one action files.       |
| [kubedoio/chv](https://github.com/kubedoio/chv/tree/1fbb2b0431b8)                                               | `ui`           | 9, 10           | no         | yes    | Hypervisor control plane UI (31 routes) on adapter-static with prop-decided headings.                      |
| [stonith404/umpteenth](https://github.com/stonith404/umpteenth/tree/9a1d9f5ef02f)                               | `frontend`     | 5, 7, 9, 10     | no         | yes    | Agent job runner UI (24 routes) on adapter-static: markdown, `ssr = false`, `<svelte:element>` headings.   |
| [p-arndt/uprox](https://github.com/p-arndt/uprox/tree/910aacf0d380)                                             | `.`            | 3, 8, 9, 10     | no         | yes    | AI gateway console (16 routes) on adapter-node: superforms, hooks, twelve action files.                    |
| [hernihistorie/haweb](https://github.com/hernihistorie/haweb/tree/4f90d18e49f1)                                 | `.`            | 9, 10, 9b       | yes        | yes    | Game archive website (41 routes) on adapter-node with two prerendered routes.                              |
| [Dwi-Wahyu/minmat-puskomlekad](https://github.com/Dwi-Wahyu/minmat-puskomlekad/tree/2d0137846bbf)               | `.`            | 3, 9, 10        | no         | yes    | Inventory app (57 routes) on a Bun adapter: superforms, hooks, forty-one action files.                     |
| [banklab/banklab.github.io](https://github.com/banklab/banklab.github.io/tree/2b3292a24dd6)                     | `.`            | 5, 6, 9, 10, 9b | yes        | yes    | Research lab site (14 routes) on adapter-static under a `paths.base`, with markdown content.               |
| [halideworks/onelight](https://github.com/halideworks/onelight/tree/dc5b1bdfc9de)                               | `packages/web` | 9, 10, 11       | no         | yes    | Media review tool (29 routes) on adapter-static with workspace packages.                                   |
| [ViniZap4/devnook-web](https://github.com/ViniZap4/devnook-web/tree/e1ed658d9588)                               | `.`            | 5, 7, 9, 10     | no         | yes    | Developer workspace client (61 routes) on adapter-static: markdown, `ssr = false`.                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 4    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Item 4 has no app: the `svelte-meta-tags` and `svead` searches left no unread application that passed
the filters. Item 12 has none either; hundavaent renders its head from a component of its own
workspace package, which is item 11's shape.

## How the first look runs

As in holdouts 5–20, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: hundavaent and Codex MIT; dyad, umpteenth and onelight AGPL-3.0; chv Apache-2.0; the other
  eight have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop dyad and discord-wh-manager-v2 without their env files.
- Runners-up, read and not picked: qimiko/lychee-tools, mprice78usa/CollectRelay, alttpr/csrando,
  fluid-movement/fpa-events, hotkhwan/phibek-app, der-bandsalat/bandsalat and tpbnick/simple-wiki.
