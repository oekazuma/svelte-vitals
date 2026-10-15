# v1 holdout 36 — selection (2026-10-16)

The thirty-sixth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–35 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32 and 34 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–35:
`@tolgee/svelte`, `yup`, `quill`, `d3`, `pixi.js`, `pusher-js`, `svelte-clerk`, `better-auth`,
`@upstash/redis`, `googleapis`, `@zerodevx/svelte-toast` and `msw` with `@sveltejs/kit` in
`package.json`; `export function load` in JavaScript route modules; `data.seo`, `role="dialog"` and
`og:type` in Svelte files; `<svelte:head>` (over 4 KB), `{#await`, `$effect(` (over 5 KB) and
`application/ld+json` in route Svelte files; `page.url.pathname` and `setContext(` in `src/lib` Svelte
files; `locals.user` in TypeScript route modules; `handleError`, `PageLoad`, `LayoutServerLoad` and
`$service-worker` in TypeScript; and `<enhanced:img` in Svelte files. As in holdouts 16–35, the pool is
this round's searches only.

12,370 repositories came back; all of them resolved. 5,333 remained after dropping 365 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 6,672
with no push in six months. GitHub's hourly rate limit stopped part of the file listing; it was rerun
after the limit reset, and every repository listed. 1,638 had at least 10 routes and a lockfile; 1,471
were on Svelte 5 and Kit 2, after dropping two whose `package.json` could not be read; 1,399 remained
after dropping 21 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 51 copies or mirrors of an excluded app. 1,228 of the 1,399 had been read in an earlier
round, as far as the kept read list records (holdouts 9–35); none of those was read again or taken. Of
the 171 others, 28 belong to owners of excluded apps and were dropped; all 143 left were shallow-cloned
and read. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA
equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 28 of the 143 were rejected because runes are in half their
components or fewer. Eight otherwise fitting candidates were dropped: two because their lockfile
disagrees with `package.json`, one because it commits two lockfiles, one because it commits gitlinks,
one because its `.npmrc` points at a private registry, one because it is a storefront template, one
because it is course material, and one because it is a reader for content scraped from third-party
sites. Each pick's lockfile was compared with its `package.json` on each declared range: all 14 agree.
No pick has a committed submodule (gitlink), an `.npmrc` pointing at a private registry or a
`file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                       | Path             | Checklist       | Prerenders | Builds | Why                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------- | --------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| [100-tokens/astrophoto](https://github.com/100-tokens/astrophoto/tree/ed12183c5968)       | `frontend`       | 1, 8, 9, 9b, 10 | yes        | yes    | Image-sharing app for amateur astrophotographers (42 routes) on adapter-node with JSON-LD, hooks and form actions.          |
| [j-adom/Alkebu-Load](https://github.com/j-adom/Alkebu-Load/tree/bff2586ceb2f)             | `alkebu-web`     | 1, 8, 10        | no         | no     | Bookstore website with a shop, blog, directory and events (34 routes) on Cloudflare with JSON-LD, hooks and form actions.   |
| [jsuvic/agent-profile](https://github.com/jsuvic/agent-profile/tree/3d7a6c3040bc)         | `apps/web`       | 1, 9            | no         | yes    | Configuration manager for AI coding tools with a landing page (11 routes) on adapter-node with JSON-LD.                     |
| [RasmaPlasma/mill](https://github.com/RasmaPlasma/mill/tree/58f4b0fd03a9)                 | `ui`             | 3, 8, 9         | no         | yes    | Self-hosted agent platform (17 routes) on adapter-node with superforms, hooks and form actions.                             |
| [glowfinger/match-manager](https://github.com/glowfinger/match-manager/tree/0eec47fc4473) | `.`              | 3, 7            | no         | no     | Rugby squad and match manager (38 routes) on Vercel with superforms, `ssr = false`.                                         |
| [Xavelite/RestoStaff](https://github.com/Xavelite/RestoStaff/tree/87cb1d74d554)           | `.`              | 6, 7            | no         | no     | Restaurant-operations app (41 routes) on adapter-static under a computed `paths.base`, `ssr = false`.                       |
| [avifenesh/openslot](https://github.com/avifenesh/openslot/tree/c6006ae481d0)             | `frontend`       | 6, 7, 9         | no         | yes    | Self-hosted scheduling admin (33 routes) on adapter-static under `paths.base`, `ssr = false`.                               |
| [miztiik/yen-idhazh](https://github.com/miztiik/yen-idhazh/tree/bf4969e6b19b)             | `frontend`       | 6, 7, 9, 9b, 10 | yes        | yes    | Daily news digest with an operator console (10 routes) on adapter-static under a computed `paths.base`, part `ssr = false`. |
| [XinShiLab/Foldnano](https://github.com/XinShiLab/Foldnano/tree/7b4c923058e6)             | `.`              | 5, 9            | no         | yes    | In-browser DNA nanostructure design tool with mdsvex docs (10 routes) and hooks.                                            |
| [dispbd/NerdDen](https://github.com/dispbd/NerdDen/tree/182e5b514322)                     | `SudokuManiac`   | 8, 9            | no         | yes    | Puzzle-game site (24 routes) on Vercel with Paraglide i18n (no alternate-language links), hooks and form actions.           |
| [JameZUK/lyrion-anywhere](https://github.com/JameZUK/lyrion-anywhere/tree/8800c27576ab)   | `web/app`        | 9, 10           | no         | yes    | Remote client for a home music server (34 routes) on adapter-static with relative paths.                                    |
| [resu-mx/forge](https://github.com/resu-mx/forge/tree/4ee3914995c3)                       | `packages/webui` | 5, 7, 9, 11     | no         | yes    | Self-hosted resume builder (39 routes) on adapter-static, `ssr = false`, with markdown, in a workspace.                     |
| [escendit/coldframe](https://github.com/escendit/coldframe/tree/ed69105d2dc6)             | `apps/ts/web`    | 8, 9, 10, 11    | no         | yes    | Garden soil-moisture monitor (14 routes) on adapter-node with hooks and form actions, in a workspace.                       |
| [AkiChang0409/MiniERP](https://github.com/AkiChang0409/MiniERP/tree/4540e7d7401b)         | `.`              | 8, 9            | no         | yes    | Finance operations platform for small businesses (50 routes) on Cloudflare with hooks and form actions.                     |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 6    |
| 9   | likely builds without services              | 11   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 2, 4 and 12 have no app. No candidate this round writes alternate-language links or uses a
meta-tag library; NerdDen has i18n without `hreflang`. The selection script flags one candidate for
item 12, but its match is a UI kit, not a head library.

## How the first look runs

As in holdouts 5–35, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: agent-profile, openslot and coldframe Apache-2.0; mill, Foldnano and forge MIT; lyrion-anywhere GPL-2.0; the other seven have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop Alkebu-Load, match-manager and RestoStaff without their env files.
- Runners-up, read and not picked: JaKXz/jakxz.github.io, RomainNeup/showtrackr, T0M13/codekeep,
  tomiwa-code/owltside, robinchoice/music-hub and TastingRogue/HomeLedger.
