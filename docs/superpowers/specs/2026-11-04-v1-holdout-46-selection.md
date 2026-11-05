# v1 holdout 46 — selection (2026-11-04)

The forty-sixth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–45 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–45 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 29–45: `motion`,
`@dnd-kit/svelte`, `graphql`, `@trpc/server`, `vaul-svelte`, `cmdk-sv`, `svelte-maplibre`, `mongoose`,
`@lucide/svelte`, `winston`, `node-cron` and `better-sqlite3` with `@sveltejs/kit` in `package.json`;
`role="listbox"`, `role="tooltip"`, `role="status"`, `role="radiogroup"`, `aria-haspopup`, `aria-selected`,
`aria-checked`, `<nav aria-label`, `<output`, `<object`, `invalidateAll`, `afterNavigate` and `pushState` in
Svelte files; `{@const` in route Svelte files; and `Reroute` and `EntryGenerator` in TypeScript. As in
holdouts 16–45, the pool is this round's searches only.

The searches named 13,727 repositories. 7,281 remained after dropping 431 excluded repositories (the
corpus repositories and every candidate and runner-up of earlier holdouts) and 6,015 with no push in six
months. GitHub's hourly rate limit cut the file listing short; it was rerun after the limit reset, after
which four repositories still could not be listed. 1,482 had at least 10 routes and a lockfile; 1,314 were
on Svelte 5 and Kit 2, after dropping two whose `package.json` could not be read; 1,211 remained after
dropping 27 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and
76 copies or mirrors of an excluded app. 1,107 of the 1,211 had been read in an earlier round, as far as
the kept read list records (holdouts 9–45); none of those was read again or taken. Of the 104 others, 34
belong to owners of excluded apps and were dropped; all 70 left were shallow-cloned and read. As in
holdouts 38–45, every clone's source files were compared with the corpus clones, `components/ui/` left
out; none matched. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned
SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 9 of the 70 were rejected because runes are in half their components
or fewer. Two were dropped as not fitting: a component library and a programming language's documentation
site. Ten otherwise fitting candidates were dropped: five commit a gitlink (two of them also a `file:`
dependency outside the checkout, one also a lockfile that disagrees with `package.json`), two have a
`file:`/`link:` dependency outside the checkout, two have two lockfiles, and one keeps its lockfile in a
parent directory the comparison could not read. Each pick's lockfile was compared with its `package.json`
on each declared range: all 14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at
a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                     | Path                         | Checklist          | Prerenders | Builds | Why                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Linea-Software/ace-blocker-site](https://github.com/Linea-Software/ace-blocker-site/tree/be15792a2469) | `.`                          | 1, 2               | no         | no     | Website, account portal and API of an ad-blocking product (19 routes) on adapter-node with JSON-LD, alternate-language links and hooks.                                               |
| [leonkalema/nordicnews](https://github.com/leonkalema/nordicnews/tree/19890ac87f2a)                     | `.`                          | 1, 2, 5, 9         | no         | yes    | News site for the Nordic countries (16 routes) on adapter-netlify with JSON-LD, regional alternate links, markdown, hooks and a form action.                                          |
| [adityaoberai/Portfolio](https://github.com/adityaoberai/Portfolio/tree/33231e23217b)                   | `.`                          | 1, 9, 9b           | yes        | yes    | Personal site whose home page is a walkable 3D room (14 routes) on adapter-node with JSON-LD, the whole site prerendered.                                                             |
| [MuhibNayem/Quantify](https://github.com/MuhibNayem/Quantify/tree/b383ac3e56cd)                         | `client`                     | 3, 7, 9            | no         | yes    | Inventory management and point-of-sale system (28 routes) on adapter-node with superforms, `ssr = false`.                                                                             |
| [CthulhuOnIce/Decaynet](https://github.com/CthulhuOnIce/Decaynet/tree/a36c01442aca)                     | `.`                          | 5, 8, 9            | no         | yes    | Time-slider map and community wiki of local history (34 routes) on adapter-node with markdown, hooks and form actions.                                                                |
| [KalypzoSolutions/kalypzo-atrium](https://github.com/KalypzoSolutions/kalypzo-atrium/tree/c93ce7faae1b) | `.`                          | 8, 9, 10           | no         | yes    | Self-hosted modular administration platform (32 routes) on adapter-node with hooks and form actions.                                                                                  |
| [jieliapp/Jieli](https://github.com/jieliapp/Jieli/tree/1497a55b853d)                                   | `frontend`                   | 2, 5, 7, 9, 9b, 10 | yes        | yes    | Sync and sharing for AI coding sessions (16 routes) on adapter-static with an optional language segment, alternate-language links and markdown, `ssr = false` with prerendered pages. |
| [oddurs/calenha](https://github.com/oddurs/calenha/tree/e8d10b1c51be)                                   | `web`                        | 6, 9, 9b, 10       | yes        | yes    | Reference site of a constructed language (15 routes) on adapter-static under an environment-set `paths.base`, with hooks.                                                             |
| [aaryanDhakal22/posserver](https://github.com/aaryanDhakal22/posserver/tree/efe970982f7e)               | `backend/frontend`           | 6, 7, 9, 10        | no         | yes    | Operator console of a multi-tenant point-of-sale server (15 routes) on adapter-static under `paths.base` `/app`, `ssr = false`.                                                       |
| [olive-groves/impasto-viewer](https://github.com/olive-groves/impasto-viewer/tree/ac2e6261e4a2)         | `.`                          | 9, 9b              | yes        | yes    | Side-by-side 3D viewer for scans of paintings (43 routes) on adapter-auto with MapLibre, many of the routes component test pages.                                                     |
| [shubro18202758/veer](https://github.com/shubro18202758/veer/tree/72f724381b2f)                         | `VVIP/services/command-deck` | 5, 9, 10           | no         | yes    | Command deck of a city operations platform (25 routes) on adapter-node with markdown files and hooks.                                                                                 |
| [jackesdavid/olhar-ai](https://github.com/jackesdavid/olhar-ai/tree/50b92df106d6)                       | `sentinel-app`               | 7, 9, 10           | no         | yes    | Multi-tenant camera monitoring and automation assistant (37 routes) on adapter-static, `ssr = false`.                                                                                 |
| [frolov2b/infosections](https://github.com/frolov2b/infosections/tree/b41f8a7c1a0e)                     | `frontend`                   | 9                  | no         | yes    | Event intelligence dashboard (20 routes) on the third-party `svelte-adapter-bun` with hooks and a form action.                                                                        |
| [SylveonDeko/PokeFluxDash](https://github.com/SylveonDeko/PokeFluxDash/tree/1a5341cd7562)               | `.`                          | 8, 9, 10           | no         | yes    | Dashboard of a chat-platform collecting bot (28 routes) on adapter-node with hooks and form actions.                                                                                  |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 3    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 4    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 7    |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Items 4, 11 and 12 have no app: no pick uses a meta-tag library, a workspace package of Svelte components
or a head set through an npm package.

## How the first look runs

As in holdouts 5–45, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: infosections MIT; Jieli Apache-2.0; Decaynet and PokeFluxDash AGPL-3.0; impasto-viewer and veer carry a license GitHub cannot classify; the other eight have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Runners-up, read and not picked: Sobr-cc/sobr, xeonixo/DNScraft, juspay/dopamine, JosephPrichard/hexchess,
  MikeyDoya/vision_lego and mrmxf/nabu.
- Builds: a `$env/static/public` import stops ace-blocker-site without its env file.
