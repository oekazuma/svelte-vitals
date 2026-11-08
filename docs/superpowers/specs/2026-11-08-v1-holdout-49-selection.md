# v1 holdout 49 — selection (2026-11-08)

The forty-ninth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–48 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34, 37–45 and 47 passed every
deciding criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and
recorded here **before svelte-vitals has run on any of them**. The criteria are judged on the first look
only. C8 is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only
rules whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 29–48:
`@tauri-apps/api`, `@capacitor/core`, `@fullcalendar/core`, `@mdi/js`, `svelte-markdown`,
`@modelcontextprotocol/sdk`, `zxcvbn`, `sveltekit-sse`, `remark-gfm`, `ws`, `svelte-adapter-bun` and
`@auth/core` with `@sveltejs/kit` in `package.json`; `role="menuitem"`, `role="img"`, `role="heading"`,
`aria-sort`, `aria-disabled`, `aria-errormessage`, `tabindex="0"` and `<menu` in Svelte files; `<h4` and
`<label for=` in route Svelte files; `$env/dynamic/public`, `RequestEvent` and `redirect(303` in
TypeScript; `url.searchParams.get` and `export const config` in route TypeScript; and `json({` in
TypeScript under `src/routes/api`. As in holdouts 16–48, the pool is this round's searches only.

The searches named 14,159 repositories. 6,693 remained after dropping 427 excluded repositories (the
corpus repositories and every candidate and runner-up of earlier holdouts) and 7,039 with no push in six
months. GitHub's hourly rate limit cut the file listing short; it was rerun after the limit reset, after
which every repository could be listed. 1,489 had at least 10 routes and a lockfile; 1,316 were on Svelte
5 and Kit 2, after dropping six whose `package.json` could not be read; 1,192 remained after dropping 22
app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and 102 copies
or mirrors of an excluded app. 1,119 of the 1,192 had been read in an earlier round, as far as the kept
read list records (holdouts 9–48); none of those was read again or taken. Of the 73 others, 36 belong to
owners of excluded apps and were dropped; all 37 left were shallow-cloned and read. As in holdouts 38–48,
every clone's source files were compared with the corpus clones, `components/ui/` left out; two matched a
corpus app (293 of 400 and 299 of 399 source files identical) and were dropped as copies. The 20
finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that
was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 6 of the 35 were rejected because runes are in half their
components or fewer. One was not an application: a store its README calls a demo. One otherwise fitting
candidate was dropped because it commits gitlinks. Each pick's lockfile was compared with its
`package.json` on each declared range: all 14 agree. No pick has a committed submodule (gitlink), an
`.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                 | Path                | Checklist | Prerenders | Builds | Why                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------- | --------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [hawkins48b/cw-zro](https://github.com/hawkins48b/cw-zro/tree/7ea17a8c50c9)                         | `.`                 | 2, 7, 9   | no         | yes    | Ballistic calculator for long-range shooting (16 routes) on adapter-static with `ssr = false`, Paraglide, alternate-language links and hooks, in JavaScript.                                                                     |
| [MeowCAT378/SE-Quiz](https://github.com/MeowCAT378/SE-Quiz/tree/fd80921d3470)                       | `website`           | 6, 9      | no         | yes    | Live quiz hosting and library (22 routes) on adapter-cloudflare or adapter-node chosen by an environment variable, under an environment-set `paths.base`, with Paraglide routes under `[[lang=locale]]`, hooks and form actions. |
| [magnus-redkin/ulysses](https://github.com/magnus-redkin/ulysses/tree/e4851439330c)                 | `web`               | 5, 8, 9   | no         | yes    | Site and account pages of a VPN service (10 routes) on adapter-node with mdsvex pages, hooks and form actions.                                                                                                                   |
| [derrickshema/recipe-manager](https://github.com/derrickshema/recipe-manager/tree/e5008af51d70)     | `frontend`          | 8, 9, 10  | no         | yes    | Restaurant ordering with customer and restaurant sides (23 routes) on adapter-node with hooks, form actions and barrel-exported components.                                                                                      |
| [MJ-Conseil/mathieujahnich](https://github.com/MJ-Conseil/mathieujahnich/tree/31dab465f48f)         | `.`                 | 8         | no         | no     | Website of a sustainability communication consultant (19 routes) on adapter-node with a blog, a newsletter form, hooks and form actions.                                                                                         |
| [Plaminh/Blooming](https://github.com/Plaminh/Blooming/tree/1d3447026067)                           | `frontend`          | 7, 10     | yes        | no     | Desktop planner with a companion widget (11 routes), a Tauri shell around adapter-static with `ssr = false`, prerendered widget pages and barrel-exported components.                                                            |
| [Chanadu/better-music](https://github.com/Chanadu/better-music/tree/2c9dd378de1a)                   | `frontend`          | 7, 9, 9b  | yes        | yes    | Tracker for artists and albums (10 routes) on adapter-static with `ssr = false` and every page prerendered.                                                                                                                      |
| [brianramseyau/bookkeeper](https://github.com/brianramseyau/bookkeeper/tree/6d89b6662b5f)           | `apps/web`          | 7, 9, 10  | no         | yes    | Household bookkeeping for bills, expenses, income and subscriptions (15 routes) on adapter-static with `ssr = false` and namespace-imported components.                                                                          |
| [Angelmmiguel/yondrive](https://github.com/Angelmmiguel/yondrive/tree/68b532dfe034)                 | `web`               | 7, 9, 10  | no         | yes    | Self-hosted drive for files, notes, documents and sheets (23 routes) on adapter-static with `ssr = false` and barrel-exported components.                                                                                        |
| [trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004/tree/7718e29d70af)               | `webapp/apps/web`   | 9         | no         | yes    | Registry explorer for AI agents on Stellar (10 routes) on adapter-cloudflare with hooks, in a pnpm workspace.                                                                                                                    |
| [Ibenhoe/quickmail2](https://github.com/Ibenhoe/quickmail2/tree/f4ec5c3508eb)                       | `.`                 | 9         | no         | yes    | Self-hosted email client on Cloudflare Workers (18 routes) on adapter-cloudflare with hooks and form actions.                                                                                                                    |
| [AnibalDams/Mitteiru](https://github.com/AnibalDams/Mitteiru/tree/c0a7ab250458)                     | `mitteiru-frontend` | 5, 9      | no         | yes    | Anime catalog and player (14 routes) on adapter-auto as a server in front of its API, with markdown from `marked`, hooks and form actions.                                                                                       |
| [verapas/cooking-app](https://github.com/verapas/cooking-app/tree/6d7670243594)                     | `.`                 | 9         | no         | yes    | German recipe app (14 routes) on adapter-node with hooks, installable as a PWA.                                                                                                                                                  |
| [Marcus-Adair/svelte_portfolio](https://github.com/Marcus-Adair/svelte_portfolio/tree/2775f5a85b8b) | `.`                 | 9         | no         | yes    | Personal portfolio and blog (10 routes) on adapter-auto.                                                                                                                                                                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 0    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 4    |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 1    |

Items 1, 3, 4, 11 and 12 have no app: the one candidate with JSON-LD keeps runes in fewer than half its
components, and no candidate uses superforms, a meta-tag library, UI from a workspace package or a head
set through an npm package.

## How the first look runs

As in holdouts 5–48, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: SE-Quiz and yondrive AGPL-3.0; ulysses, better-music, stellar-8004 and quickmail2 MIT;
  mathieujahnich LGPL-2.1; the other seven have no license GitHub classifies. The measurement reads the
  source and redistributes nothing.
- Runners-up, read and not picked: kupzed/project-management, muhammedalikutbay/baytar,
  loissascha/localstream, MdShuvon/UnityPulse, raghut/CurioKids and critiq17/trip-listik.
- Builds: mathieujahnich imports two keys from `$env/static/private` and Blooming one from
  `$env/static/public`, none of them committed in a file the production build reads.
