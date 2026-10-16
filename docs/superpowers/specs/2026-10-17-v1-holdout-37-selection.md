# v1 holdout 37 — selection (2026-10-17)

The thirty-seventh holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–36 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32 and 34 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–36: `luxon`, `axios`,
`papaparse`, `fuse.js`, `swiper`, `highlight.js`, `sortablejs`, `trpc-sveltekit`, `@urql/svelte`,
`convex`, `@floating-ui/dom` and `@vercel/speed-insights` with `@sveltejs/kit` in `package.json`;
`export const csr`, `error(403`, `export const GET` and `redirect(302` in TypeScript route modules;
`og:site_name`, `article:published_time`, `application/rss+xml`, `<dialog`, `role="navigation"`,
`fetchpriority` and `<iframe` in Svelte files; `onMount(` (over 6 KB), `<main` (over 2 KB) and
`loading="lazy"` in route Svelte files; `srcset` in `src/lib` Svelte files; and `$env/static/private` in
`src/lib/server`. As in holdouts 16–36, the pool is this round's searches only.

13,807 repositories came back. GitHub's hourly rate limit cut both the repository lookup and the file
listing short; both were rerun after the limit reset, after which 2 repositories did not resolve and
every other one listed. 5,426 remained after dropping 379 excluded repositories (the corpus repositories
and every candidate and runner-up of earlier holdouts) and 8,000 with no push in six months. 1,716 had
at least 10 routes and a lockfile; 1,479 were on Svelte 5 and Kit 2, after dropping two whose
`package.json` could not be read; 1,317 remained after dropping 19 app directories named `docs`, `site`,
`examples`, `templates`, `tests`, `demo` or similar, and 143 copies or mirrors of an excluded app. 1,180
of the 1,317 had been read in an earlier round, as far as the kept read list records (holdouts 9–36);
none of those was read again or taken. Of the 137 others, 41 belong to owners of excluded apps and were
dropped; all 96 left were shallow-cloned and read. The 20 finalists (picks and runners-up) were
re-fetched at pin time: every pinned SHA equals the clone that was read, and one runner-up (KairoClaw)
had moved since. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 30 of the 96 were rejected because runes are in half their
components or fewer. Eight otherwise fitting candidates were dropped: four commit two lockfiles or a
lockfile that disagrees with `package.json`, one commits a gitlink, two do both, and one's README forbids
copying its code. Each pick's lockfile was compared with its `package.json` on each declared range: all
14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at a private registry or a
`file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                                     | Path           | Checklist       | Prerenders | Builds | Why                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Advanced-Digital-Marketing-LTDA](https://github.com/Advanced-Digital-Marketing-LTDA/Advanced-Digital-Marketing-LTDA/tree/712637ef17ed) | `.`            | 2, 5, 9         | no         | yes    | Marketing agency website with a blog in English and Brazilian Portuguese, with alternate-language links (16 routes), on adapter-node with hooks. |
| [tanch-p/tomimi-dev](https://github.com/tanch-p/tomimi-dev/tree/a43af0109406)                                                           | `.`            | 9, 9b           | yes        | yes    | Companion site for a game's roguelike mode under a `[lang]` segment (18 routes) on Cloudflare with prerendered pages.                            |
| [Luen/runaround](https://github.com/Luen/runaround/tree/366bca37efa1)                                                                   | `.`            | 1, 8, 9, 10     | no         | yes    | Virtual trail-running race site (13 routes) on adapter-node with JSON-LD, hooks and form actions.                                                |
| [nautilus-cyberneering/nautilus-website](https://github.com/nautilus-cyberneering/nautilus-website/tree/a729ace5a642)                   | `.`            | 9, 9b, 10       | yes        | yes    | Organisation website with a blog (30 routes) on adapter-static, prerendered.                                                                     |
| [CUNY-AI-Lab/slide-maker](https://github.com/CUNY-AI-Lab/slide-maker/tree/282d7180497b)                                                 | `apps/web`     | 6, 7, 9, 10, 11 | no         | yes    | Chat-driven slide builder (10 routes) under a computed `paths.base`, `ssr = false`, with a workspace package.                                    |
| [averagechris/hister](https://github.com/averagechris/hister/tree/d545a2e25d7c)                                                         | `webui/app`    | 6, 7, 9         | no         | yes    | Web UI for searching one's own browser history (11 routes) on adapter-static under a computed `paths.base`, `ssr = false`.                       |
| [anicolao/pantheon](https://github.com/anicolao/pantheon/tree/4a14001a352d)                                                             | `.`            | 6, 9, 9b, 10    | yes        | yes    | Deck-building browser game (11 routes) on adapter-static under a computed `paths.base`, with a prerendered page.                                 |
| [mwmbl/front-end](https://github.com/mwmbl/front-end/tree/acf5dc395f67)                                                                 | `.`            | 7, 8, 9         | no         | yes    | Front end of a non-profit search engine (10 routes) on adapter-node with hooks and form actions, part `ssr = false`.                             |
| [dmwin72015/netdisk](https://github.com/dmwin72015/netdisk/tree/0b7f47f07fbf)                                                           | `frontend`     | 9               | no         | yes    | Self-hosted file storage (29 routes) on adapter-node with a server hook and a universal `src/hooks.ts`.                                          |
| [athuridha/eraport](https://github.com/athuridha/eraport/tree/0da3a148c77a)                                                             | `.`            | 5, 8, 9         | no         | yes    | School report-card and administration system (59 routes) on adapter-node with mdsvex, hooks and form actions.                                    |
| [agazso/feeds](https://github.com/agazso/feeds/tree/5327fcd5a709)                                                                       | `packages/app` | 8, 9, 11        | no         | yes    | Self-hosted feed reader (15 routes) on adapter-node with hooks and form actions, in a workspace.                                                 |
| [oddessentials/skylark](https://github.com/oddessentials/skylark/tree/b52a44260727)                                                     | `web`          | 8, 9            | no         | yes    | Website for a game server's community (19 routes) on adapter-node with hooks and form actions.                                                   |
| [Charge-Research-Platform-Volt/Kennisbank](https://github.com/Charge-Research-Platform-Volt/Kennisbank/tree/ea6fa3edd882)               | `frontend`     | 5, 7, 9         | no         | yes    | Research knowledge base with a chatbot (23 routes) on adapter-static, `ssr = false`, with markdown.                                              |
| [lilith/weaver](https://github.com/lilith/weaver/tree/2c234067a5fd)                                                                     | `apps/play`    | 8               | no         | no     | Collaborative world-building game (19 routes) on Cloudflare with hooks and form actions.                                                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 1    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 6    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 4    |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 3, 4 and 12 have no app. No candidate uses a meta-tag library, and none of the candidates using
superforms was a fitting app this round. The selection script flags four candidates for item 12, but
each match is a UI component import, not a head library.

## How the first look runs

As in holdouts 5–36, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: hister, mwmbl's front end and weaver AGPL-3.0; pantheon GPL-3.0; feeds MIT; skylark MIT (a `LICENSE` GitHub does not classify); Advanced-Digital-Marketing-LTDA PolyForm Shield 1.0.0; nautilus-website AGPL-3.0 for its code; eraport its own license, which permits research use and reading the source; the other five have no license file. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop weaver without its env files.
- Runners-up, read and not picked: Ozraam/typst-blog, DhilipBinny/KairoClaw, Joshimello/cluster-manager,
  seandlg/e7geu, Onin-app/Onin and dev-lou/SiteSync.
