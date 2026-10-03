# v1 holdout 20 — selection (2026-10-03)

The twentieth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–19 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only
rules whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result
also reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (12 queries) aimed at the shapes holdout 19's fix touched or
left open, and at the checklist items earlier rounds left thin: `dexie` in `package.json`; `await` and
`.clear()` next to `$props()` in components; `$page.data.` in an `{#if}` in route files; `$derived(`
next to `page.url.pathname` in route files; `bits-ui` in `package.json`; `svelte-seo` and
`sveltekit-superforms` in `package.json`; `hreflang` in route files; `mdsvex` in `svelte.config.js`;
`@repo/ui` in `package.json`; `export const prerender = true` in route modules; and `handleError` in
`hooks.server.ts`. As in holdouts 16–19, the pool is this round's searches only.

7,263 repositories came back; 3,321 remained after dropping 193 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts), one archived and 3,748 with no
push in six months; 963 had at least 10 routes and a lockfile; 880 were on Svelte 5 and Kit 2; 818
remained after dropping 14 app directories named `docs`, `site`, `examples`, `templates`, `tests`,
`demo` or similar, and 48 copies or mirrors of an excluded app. 496 of the 818 had been read in an
earlier round, as far as the kept read list records (holdouts 9–19); none of those was read again or
taken. Of the 322 others, 14 belong to owners of excluded apps and were dropped; 140 were taken
round-robin across the queries, highest-starred first, shallow-cloned and read. The 21 finalists
(picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was
read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 18 of the 140 were rejected because more of their components use
`export let` than runes. Two otherwise fitting candidates were dropped because their lockfile
disagrees with `package.json`. Each pick's lockfile was compared with its `package.json` on each
declared range: all 14 agree. No pick has a `.gitmodules` file, an `.npmrc` pointing at a private
registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                             | Path                           | Checklist          | Prerenders | Builds | Why                                                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------ | ------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| [wevisdemo/parliament-watch](https://github.com/wevisdemo/parliament-watch/tree/1cb15ae42e59)   | `.`                            | 5, 9, 10, 9b       | yes        | yes    | Parliament monitoring site (14 routes) on adapter-node: markdown, prop-decided headings.                        |
| [xinity-ai/xinity-ai](https://github.com/xinity-ai/xinity-ai/tree/57ddc2aaaf2f)                 | `packages/xinity-ai-dashboard` | 6, 7, 9, 10, 11    | no         | yes    | AI platform dashboard (41 routes) on a Bun adapter: `paths.base`, workspace packages, awaited prop calls.       |
| [hawkinslabdev/motomate](https://github.com/hawkinslabdev/motomate/tree/8f259cad8417)           | `motomate`                     | 8, 9, 10           | no         | yes    | Vehicle maintenance tracker (24 routes) on adapter-node with hooks and nineteen action files.                   |
| [idah-ai/idah](https://github.com/idah-ai/idah/tree/7ea4c21fd6c0)                               | `app/frontend`                 | 8, 9, 10           | no         | yes    | Annotation hub (24 routes) on adapter-node: bits-ui, awaited prop calls in ten components.                      |
| [cacack/my-family](https://github.com/cacack/my-family/tree/49df53cc1f88)                       | `web`                          | 6, 7, 9, 10        | no         | yes    | Genealogy app (42 routes) on adapter-static under a `paths.base`, with bits-ui and `ssr = false`.               |
| [vizchitra/website](https://github.com/vizchitra/website/tree/03d50484c4b4)                     | `.`                            | 5, 7, 9, 10, 9b    | yes        | yes    | Conference site (40 routes) on Cloudflare: thirteen prerendered routes, `<svelte:element>` headings.            |
| [ImGajeed76/quick-cards](https://github.com/ImGajeed76/quick-cards/tree/103a5b59c5ef)           | `website`                      | 1, 9, 10, 9b       | yes        | yes    | Flashcard export tool site (13 routes) on adapter-static: JSON-LD, bits-ui, four prerendered routes.            |
| [mdragosv/Entropia-Nexus](https://github.com/mdragosv/Entropia-Nexus/tree/371b7c99d192)         | `nexus`                        | 1, 5, 7, 8, 9, 10  | no         | yes    | Game database and tools (119 routes) on adapter-node: JSON-LD built in `{#each}`, path tests via `$derived`.    |
| [ThoughtCloudsLost/Care-y](https://github.com/ThoughtCloudsLost/Care-y/tree/fcdb0cdf541b)       | `packages/client`              | 7, 9, 10, 11       | no         | yes    | Encrypted intake and messaging client (32 routes) with workspace packages, bits-ui and `ssr = false`.           |
| [Xevion/glint](https://github.com/Xevion/glint/tree/04688a27070a)                               | `frontend`                     | 3, 9, 10           | no         | yes    | Screenshot catalog (24 routes) on a Bun adapter: superforms, bits-ui, an awaited prop call.                     |
| [PardalisEdu/PardalisWebSite](https://github.com/PardalisEdu/PardalisWebSite/tree/2148d9882170) | `.`                            | 1, 5, 8, 9, 10, 9b | yes        | yes    | Project website (25 routes) on adapter-node: JSON-LD, markdown, nineteen prerendered routes.                    |
| [clusterzx/netscope](https://github.com/clusterzx/netscope/tree/c950b97d590f)                   | `web`                          | 7, 9, 10           | no         | yes    | Network scanner UI (25 routes) on adapter-static with `ssr = false` and awaited prop calls in eight components. |
| [NeoVand/coms](https://github.com/NeoVand/coms/tree/6163e8d8d8e2)                               | `.`                            | 6, 9, 10, 9b       | yes        | yes    | Interactive atlas of network protocols (17 routes) on adapter-static under a `paths.base`, prerendered.         |
| [rromenskyi/platform-dash](https://github.com/rromenskyi/platform-dash/tree/026a9388e11b)       | `.`                            | 9, 10              | no         | yes    | Kubernetes operator dashboard (35 routes) on adapter-node with `@auth/sveltekit` and a `page.data` layout test. |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 4    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 14   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 5    |

Items 2 and 4 have no app: the `hreflang` and `svelte-seo` searches left no unread application that
passed the filters. Item 12 has none either: no candidate rendered its head from an npm component.

Shapes holdout 19's fix touched or left open:

- **A mutating method name awaited on a prop:** idah, netscope, xinity-ai and glint.
- **A path test through a `$derived`:** Entropia-Nexus, xinity-ai, idah, vizchitra, Care-y,
  quick-cards, PardalisWebSite, parliament-watch and platform-dash.
- **A layout `{#if}` on `page.data`, and `@auth/sveltekit`:** platform-dash.
- **bits-ui:** xinity-ai, idah, my-family, quick-cards, Care-y and glint.

## How the first look runs

As in holdouts 5–19, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: motomate, my-family and Care-y AGPL-3.0; PardalisWebSite GPL-3.0; glint LGPL-3.0;
  xinity-ai Apache-2.0; quick-cards MIT; parliament-watch, idah, vizchitra, Entropia-Nexus and
  netscope NOASSERTION; coms and platform-dash have no license GitHub classifies. The measurement reads
  the source and redistributes nothing.
- Runners-up, read and not picked: AI-Riksarkivet/ra-hcp, denssle/festival, cha0sisme/Audiorr-Web,
  robbdimitrov/cogito, skvale/plaintext-personal-ledger, RealistikOsu/Soumetsu and KalininG/arcagrad.
