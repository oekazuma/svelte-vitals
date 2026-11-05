# v1 holdout 47 — selection (2026-11-06)

The forty-seventh holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–46 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–45 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 29–46:
`@paralleldrive/cuid2`, `@tabler/icons-svelte`, `phosphor-svelte`, `sveltekit-rate-limiter`,
`sveltekit-search-params`, `superjson`, `livekit-client`, `svelte-codemirror-editor`, `fast-xml-parser`,
`rehype-slug`, `@ark-ui/svelte` and `@aws-sdk/client-ses` with `@sveltejs/kit` in `package.json`;
`role="grid"`, `role="region"`, `role="progressbar"`, `aria-busy`, `aria-required`, `<colgroup`, `<noscript`,
`<template` and `SvelteURL` in Svelte files; `$bindable` in route Svelte files; `HandleClientError`,
`HandleFetch`, `ActionFailure` and `NumericRange` in TypeScript; and `text/plain` and `text/xml` in route
TypeScript. As in holdouts 16–46, the pool is this round's searches only.

The searches named 11,547 repositories. 6,573 remained after dropping 391 excluded repositories (the
corpus repositories and every candidate and runner-up of earlier holdouts) and 4,583 with no push in six
months. GitHub's hourly rate limit cut the file listing short; it was rerun after the limit reset, after
which every repository could be listed. 1,088 had at least 10 routes and a lockfile; 981 were on Svelte 5
and Kit 2, after dropping three whose `package.json` could not be read; 902 remained after dropping 17 app
directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and 62 copies or
mirrors of an excluded app. 826 of the 902 had been read in an earlier round, as far as the kept read list
records (holdouts 9–46); none of those was read again or taken. Of the 76 others, 27 belong to owners of
excluded apps and were dropped; all 49 left were shallow-cloned and read. As in holdouts 38–46, every
clone's source files were compared with the corpus clones, `components/ui/` left out; none matched. The 20
finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was
read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 5 of the 49 were rejected because runes are in half their components
or fewer. One was dropped as an identical copy of another candidate's app directory. Six otherwise fitting
candidates were dropped: three commit a gitlink, two have a `file:`/`link:` dependency outside the checkout
(one of them also has no lockfile the comparison could read), and one has an
`.npmrc` pointing at a private registry. Each pick's lockfile was compared with its `package.json` on each
declared range: all 14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at a private
registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                         | Path           | Checklist         | Prerenders | Builds | Why                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------- | ----------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Blackman99/deskfolk](https://github.com/Blackman99/deskfolk/tree/3f7c11fb2ff4)             | `apps/landing` | 1, 2, 5, 6, 9, 9b | yes        | yes    | Multi-language product site and guides of a desktop agent app (10 routes) on adapter-static with JSON-LD, alternate-language links, markdown and an environment-set `paths.base`.   |
| [Sapd/lumastra](https://github.com/Sapd/lumastra/tree/2994543ed2c0)                         | `.`            | 5, 6, 8, 9, 10    | no         | yes    | Self-hosted media server for movies, series and music (122 routes) on adapter-node with a computed `paths.base`, markdown files, hooks and form actions.                            |
| [pjonaszik/rustbase](https://github.com/pjonaszik/rustbase/tree/4aa10e676344)               | `ui`           | 6, 7, 9           | no         | yes    | Dashboard of a multi-tenant backend service (21 routes) on adapter-static under an environment-set `paths.base`, `ssr = false`.                                                     |
| [huza1fa/auditlift-v2](https://github.com/huza1fa/auditlift-v2/tree/7eef4bff1e4c)           | `.`            | 1, 5, 9           | no         | yes    | Security-questionnaire workspace for B2B SaaS teams (30 routes) on adapter-node with JSON-LD, markdown files and hooks.                                                             |
| [ir-anthology/ir-anthology](https://github.com/ir-anthology/ir-anthology/tree/d6f13f7e2de0) | `frontend`     | 6, 7, 9, 9b, 10   | yes        | yes    | Bibliography of information-retrieval publications (10 routes) on adapter-static under an environment-set `paths.base`, with prerendered pages and `ssr = false` on sign-in routes. |
| [Doom325/llama-forge](https://github.com/Doom325/llama-forge/tree/e2a20ae7a4e9)             | `ui`           | 5, 6, 7, 9, 10    | no         | yes    | Dashboard of an orchestrator for `llama-server` fleets (15 routes) on adapter-static under `paths.base` `/ui`, `ssr = false`, with markdown.                                        |
| [Rainbow-Sands/libby](https://github.com/Rainbow-Sands/libby/tree/c6ebcceaec88)             | `packages/web` | 5, 8, 9, 10       | no         | yes    | Web app of a bot that records tabletop role-playing sessions (12 routes) on adapter-node with markdown, hooks and form actions.                                                     |
| [Fian222/Kampusia](https://github.com/Fian222/Kampusia/tree/38403f7d215b)                   | `apps/web`     | 9                 | no         | yes    | Campus academic information system (34 routes) on adapter-auto with hooks and form actions.                                                                                         |
| [jakob-r/games.jakob-r.de](https://github.com/jakob-r/games.jakob-r.de/tree/7d64a5c15980)   | `frontend`     | 1, 7, 9, 9b       | yes        | yes    | Minimal multiplayer games (16 routes) on adapter-static with JSON-LD, `ssr = false` and prerendered landing pages.                                                                  |
| [KG3solutions/Ripper-Radar](https://github.com/KG3solutions/Ripper-Radar/tree/4107928d328c) | `gen-share`    | 6, 7              | no         | no     | Listings for sharing generators, part of a weather dashboard project (17 routes), on adapter-static under `paths.base` `/generator-share`, `ssr = false`, with hooks.               |
| [samcorky/menagerist](https://github.com/samcorky/menagerist/tree/b716e6cf385c)             | `frontend`     | 7, 9, 9b, 10      | yes        | yes    | Self-hostable platform for organising collections (23 routes) on adapter-static, `ssr = false` with prerendered pages.                                                              |
| [redgreat/teweicun](https://github.com/redgreat/teweicun/tree/8b490b4a9535)                 | `frontend`     | 9                 | no         | yes    | Inventory and sales system for specialist equipment makers (60 routes) on adapter-static with an SPA fallback.                                                                      |
| [starforgefoundry/orion](https://github.com/starforgefoundry/orion/tree/5b8d3094a748)       | `.`            | 7, 8, 9           | no         | yes    | Internal CRM and member management of a makerspace (34 routes) on adapter-node with hooks, form actions and `ssr = false`.                                                          |
| [CoasterFan5/sunlight](https://github.com/CoasterFan5/sunlight/tree/04b5109939f1)           | `.`            | 9                 | no         | yes    | Open information about school software contracts (10 routes) on adapter-cloudflare.                                                                                                 |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 6    |
| 7   | large SPA/dashboard, `ssr = false`          | 7    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Items 3, 4, 11 and 12 have no app: no pick uses superforms, a meta-tag library, a workspace package of
Svelte components or a head set through an npm package.

## How the first look runs

As in holdouts 5–46, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: deskfolk, auditlift-v2, teweicun and sunlight MIT; rustbase, llama-forge and menagerist Apache-2.0; lumastra AGPL-3.0; games.jakob-r.de carries a license GitHub cannot classify; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Runners-up, read and not picked: ifsvivek/2048-lab, acmota2/musmgr, Knockerr/selv, aaovch/gym,
  richard483/jlang-support and HoekR/raa_modernized.
- Builds: a `$env/static/public` import stops Ripper-Radar without its env file.
