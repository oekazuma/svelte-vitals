# v1 holdout 30 — selection (2026-10-10)

The thirtieth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–29 have each been judged and
their apps joined the tuning corpus; holdouts 20 and 28 passed every deciding criterion and the others
did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 24–29: `@tiptap/core`,
`maplibre-gl`, `openai`, `@aws-sdk/client-s3`, `nodemailer`, `ioredis` and `svelte-french-toast` with
`@sveltejs/kit` in `package.json`; `export const prerender = true` in route modules; `<svelte:boundary`,
`page.status` with `$app/state`, `$props.id()` and `untrack(` in Svelte files; `$app/stores` in route
files over 3 KB; and `hreflang` with `x-default`. GitHub could not parse the `prerender` query as first
written (with `filename:+layout.ts`), so it was rewritten with `path:src/routes` and rerun. As in
holdouts 16–29, the pool is this round's searches only.

8,158 repositories came back, 51 of which no longer exist; 3,830 remained after dropping 289 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 3,988
with no push in six months; 1,233 had at least 10 routes and a lockfile; 1,090 were on Svelte 5 and
Kit 2; 964 remained after dropping 16 app directories named `docs`, `site`, `examples`, `templates`,
`tests`, `demo` or similar, and 110 copies or mirrors of an excluded app. 767 of the 964 had been read
in an earlier round, as far as the kept read list records (holdouts 9–29); none of those was read again
or taken. Of the 197 others, 21 belong to owners of excluded apps and were dropped; 140 were taken
round-robin across the queries, highest-starred first, shallow-cloned and read. The 20 finalists (picks
and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read.
Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 24 of the 140 were rejected because more of their components use
`export let` than runes. Four otherwise fitting candidates were dropped: one because its lockfile
disagrees with `package.json`, one because it commits a gitlink, one because it installs a `file:`
dependency outside its checkout, and one because its `.npmrc` points at a private registry. Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
`.gitmodules` file, a committed submodule (gitlink), an `.npmrc` pointing at a private registry or a
`file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                   | Path                | Checklist         | Prerenders | Builds | Why                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| [techguide-jp/corporate](https://github.com/techguide-jp/corporate/tree/70e8e50e8895)                                 | `techguide`         | 1                 | yes        | no     | Company website (20 routes) on an Amplify adapter with JSON-LD built in `{#each}` and form actions.                        |
| [Ibrahim-SWE/HadesCompanion](https://github.com/Ibrahim-SWE/HadesCompanion/tree/48e18925c9ea)                         | `.`                 | 1, 9, 9b          | yes        | yes    | Companion app for a game (11 routes) on Cloudflare with JSON-LD built in `{#each}`, prerendered.                           |
| [Patrik-Homelab/Web](https://github.com/Patrik-Homelab/Web/tree/182500dd4471)                                         | `.`                 | 1, 2, 5, 8, 9, 10 | no         | yes    | Personal website (14 routes) under an `[[lang]]` segment on adapter-node with alternate-language links, JSON-LD and hooks. |
| [AI-Almanac/ai-almanac](https://github.com/AI-Almanac/ai-almanac/tree/461af13a2401)                                   | `web`               | 2, 5, 7, 9, 10    | no         | yes    | Weather-model benchmarking platform (25 routes) on adapter-static with alternate-language links, partly `ssr = false`.     |
| [farhanmunim/site-scanner](https://github.com/farhanmunim/site-scanner/tree/c26b4e9174df)                             | `apps/web`          | 2, 8, 9           | no         | yes    | Website scanner (13 routes) on adapter-node with hooks, form actions and alternate-language links, in a workspace.         |
| [dankobg/fluffly](https://github.com/dankobg/fluffly/tree/2ddfdd519ba2)                                               | `web`               | 3, 7, 9, 9b, 10   | yes        | yes    | Pet-adoption app (55 routes) on adapter-static with superforms, its dashboard `ssr = false`.                               |
| [beyondsimulations/statistik-interaktiv](https://github.com/beyondsimulations/statistik-interaktiv/tree/32b823974116) | `.`                 | 5, 6, 9, 9b       | yes        | yes    | Interactive statistics course (16 routes) on adapter-static under a `paths.base` read from the environment, with markdown. |
| [CrispStrobe/CrispDeck](https://github.com/CrispStrobe/CrispDeck/tree/61001b80bd3c)                                   | `.`                 | 6, 7, 9, 9b, 10   | yes        | yes    | Mastodon and Bluesky client (31 routes) on adapter-static under a `paths.base`, `ssr = false`.                             |
| [stamler/tybalt_turbo](https://github.com/stamler/tybalt_turbo/tree/d7f0d21d914a)                                     | `ui`                | 7, 10             | no         | no     | Business-operations app (99 routes) on adapter-static, `ssr = false`.                                                      |
| [formswrite/schoolrise](https://github.com/formswrite/schoolrise/tree/8b611c278857)                                   | `apps/web`          | 8, 9, 10          | no         | yes    | Education-management system (40 routes) on adapter-node with hooks and form actions.                                       |
| [Tessera-Note/tessera](https://github.com/Tessera-Note/tessera/tree/9d499711799c)                                     | `apps/web`          | 7, 9, 10          | no         | yes    | Self-hosted notes workspace (40 routes) on adapter-node with hooks, in a workspace.                                        |
| [Sekai-World/sekai-viewer-reborn](https://github.com/Sekai-World/sekai-viewer-reborn/tree/6e8f00b82a96)               | `apps/content-site` | 9, 10, 11         | no         | yes    | Game-database site (25 routes) on adapter-node with its shell components from a workspace package.                         |
| [jjkroell/ridgeline](https://github.com/jjkroell/ridgeline/tree/014151cce542)                                         | `web`               | 1, 7, 9, 9b       | yes        | yes    | Mesh-network monitoring (37 routes) on adapter-static, `ssr = false`, with JSON-LD and prerendered pages.                  |
| [gvorwaller/madonnahist](https://github.com/gvorwaller/madonnahist/tree/731a583a3678)                                 | `.`                 | 8, 9              | no         | yes    | Family-calendar archive (32 routes) on adapter-node with hooks and form actions.                                           |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 3    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 8    |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 5    |

Items 4 and 12 have no app: none of the 140 read uses a meta-tag library or renders its head from an
npm package.

## How the first look runs

As in holdouts 5–29, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: HadesCompanion, ai-almanac, tybalt_turbo, sekai-viewer-reborn and ridgeline MIT; CrispDeck and schoolrise AGPL-3.0; tessera Apache-2.0; statistik-interaktiv NOASSERTION; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop techguide and tybalt_turbo without their env files.
- Runners-up, read and not picked: pyrite-wiki/pyrite, confidehq/confide, ferrreo/oss-tips, xarmian/canvas,
  aderoian/personal-website and Zyrakia/wishlist.
