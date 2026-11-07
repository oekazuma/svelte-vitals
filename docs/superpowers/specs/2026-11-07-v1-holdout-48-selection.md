# v1 holdout 48 — selection (2026-11-07)

The forty-eighth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–47 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34, 37–45 and 47 passed every
deciding criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and
recorded here **before svelte-vitals has run on any of them**. The criteria are judged on the first look
only. C8 is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only
rules whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 29–47:
`svelte-select`, `@tanstack/svelte-form`, `stripe`, `openapi-fetch`, `mermaid`, `cron-parser`, `uplot`,
`@googlemaps/js-api-loader`, `@internationalized/date`, `argon2`, `rss-parser` and
`svelte-awesome-color-picker` with `@sveltejs/kit` in `package.json`; `aria-valuenow`, `aria-orientation`,
`role="group"`, `role="slider"`, `role="list"` and `role="row"` in Svelte files; `inert` in Svelte
components under `src/lib/components`; `<svelte:window`, `<ol` and `<hr` in route Svelte files;
`HandleServerError`, `isHttpError`, `getRequestEvent` and `$app/server` in TypeScript; and `Cache-Control`
and `fail(404` in route TypeScript. As in holdouts 16–47, the pool is this round's searches only.

The searches named 12,801 repositories. 6,894 remained after dropping 437 excluded repositories (the
corpus repositories and every candidate and runner-up of earlier holdouts) and 5,470 with no push in six
months. GitHub's hourly rate limit cut the file listing short; it was rerun after the limit reset, after
which all but three repositories could be listed. 1,458 had at least 10 routes and a lockfile; 1,271 were
on Svelte 5 and Kit 2, after dropping one whose `package.json` could not be read; 1,127 remained after
dropping 19 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and
125 copies or mirrors of an excluded app. 1,037 of the 1,127 had been read in an earlier round, as far as
the kept read list records (holdouts 9–47); none of those was read again or taken. Of the 90 others, 25
belong to owners of excluded apps and were dropped; all 65 left were shallow-cloned and read. As in
holdouts 38–47, every clone's source files were compared with the corpus clones, `components/ui/` left
out; two matched a corpus app (24 of 108 and 48 of 75 source files identical) and were dropped as copies.
The 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone
that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 9 of the 63 were rejected because runes are in half their components
or fewer. Three were not applications: two identical copies of one workshop demo, and a full-stack
template. Three otherwise fitting candidates were dropped: one commits a gitlink, and two have a lockfile
that disagrees with their `package.json`. Each pick's lockfile was compared with its `package.json` on
each declared range: all 14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at a
private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                   | Path       | Checklist       | Prerenders | Builds | Why                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [swarvex-ai/swarvex](https://github.com/swarvex-ai/swarvex/tree/23dd6429a81d)                                         | `apps/web` | 1, 2, 5, 9, 9b  | yes        | yes    | Coordination platform for software built by AI agents (11 routes) on adapter-node with JSON-LD, alternate-language links, markdown docs, hooks and prerendered docs pages.                   |
| [voidprojectssoftware/voidprojects-site](https://github.com/voidprojectssoftware/voidprojects-site/tree/7b4174061c9d) | `.`        | 1, 5, 9, 9b, 10 | yes        | yes    | Company website of Void Projects (13 routes) on adapter-static with JSON-LD, an mdsvex blog, hooks and barrel-exported components.                                                           |
| [lequan81/buddy-wallet](https://github.com/lequan81/buddy-wallet/tree/2a883167dcc7)                                   | `apps/web` | 3, 5, 9, 9b, 10 | yes        | yes    | Tracker for debts between friends (27 routes) on svelte-adapter-bun with superforms, mdsvex pages, hooks, form actions and components from `data.component`.                                 |
| [filips-alpe/lit-crm](https://github.com/filips-alpe/lit-crm/tree/62c8e840dbe8)                                       | `.`        | 3, 10           | no         | no     | Personal CRM (10 routes) on adapter-vercel with superforms and formsnap, Paraglide, hooks and form actions.                                                                                  |
| [cedricgeissmann/volleyball](https://github.com/cedricgeissmann/volleyball/tree/df05d28fd1b8)                         | `.`        | 5, 6, 9, 9b     | yes        | yes    | Volleyball training and tactics site (24 routes) on adapter-static under an environment-set `paths.base`, with an mdsvex blog and per-language prerendered pages.                            |
| [jinrudals/jinrudals.github.io](https://github.com/jinrudals/jinrudals.github.io/tree/d3a67c19349e)                   | `.`        | 2, 5, 9, 9b     | yes        | yes    | Korean and English personal site (12 routes) on adapter-static with alternate-language links, mdsvex posts and hooks.                                                                        |
| [actuallyhoss/BrainDog](https://github.com/actuallyhoss/BrainDog/tree/67d42cf67d95)                                   | `apps/web` | 7, 9, 10, 11    | no         | yes    | Workspace for projects, decisions and money that agents read (44 routes) on adapter-static at the root (its `paths.base` is empty), `ssr = false`, with components from a workspace package. |
| [temet-ai/mike](https://github.com/temet-ai/mike/tree/34a3bfdf2e60)                                                   | `frontend` | 5, 7, 9, 10     | no         | yes    | Inspector for the requests and answers of an AI coding agent (56 routes) on adapter-static with an SPA fallback, `ssr = false` and markdown rendering.                                       |
| [borgand/kurious](https://github.com/borgand/kurious/tree/b5a58c37e576)                                               | `app`      | 8, 9            | no         | yes    | Course player for courses that AI agents create (18 routes) on adapter-node with hooks and form actions.                                                                                     |
| [EliasMarine/NetTap](https://github.com/EliasMarine/NetTap/tree/f14f7e1cc329)                                         | `web`      | 7, 8, 9         | no         | yes    | Dashboard of a network visibility appliance (47 routes) on adapter-node with hooks, form actions and `ssr = false` on live pages.                                                            |
| [its-nix/meabeclick](https://github.com/its-nix/meabeclick/tree/a887ecf6db6d)                                         | `.`        | 8, 9, 10        | no         | yes    | Private tutoring booking and family portal (25 routes) on adapter-node with hooks, form actions and a component map chosen per route.                                                        |
| [JairusSW/wasm.fyi](https://github.com/JairusSW/wasm.fyi/tree/0b3fb921ebe6)                                           | `.`        | 6, 9, 9b        | yes        | yes    | Reference site about WebAssembly (10 routes) on adapter-static under an environment-set `paths.base`, prerendered.                                                                           |
| [maris-development/beacon-studio-ihm](https://github.com/maris-development/beacon-studio-ihm/tree/07cedb8da100)       | `.`        | 6, 7, 9, 9b     | yes        | yes    | Data exploration studio (18 routes) on adapter-static under an environment-set `paths.base`, `ssr = false`, with one prerendered page.                                                       |
| [MauriceIsrael/archinex](https://github.com/MauriceIsrael/archinex/tree/725127f0e596)                                 | `.`        | 10              | no         | no     | Architecture deliberation workbench for architects and AI agents (19 routes) on adapter-node with hooks and namespace-imported components.                                                   |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 6    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 7    |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 7    |

Items 4 and 12 have no app: no pick uses a meta-tag library or a head set through an npm package.

## How the first look runs

As in holdouts 5–47, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: swarvex AGPL-3.0; BrainDog and beacon-studio-ihm Apache-2.0; mike and archinex MIT; NetTap
  carries a license GitHub cannot classify; the other eight have no license GitHub classifies. The
  measurement reads the source and redistributes nothing.
- Runners-up, read and not picked: pol2k/pol2000, kolaente/meet-mesh, belcoda/home, 2shiraz/loxy,
  fcrozetta/nephos-console and wankdanker/rabmin.
- Builds: lit-crm and archinex import a Prisma client that is generated, not committed, and neither `build`
  script generates it.
