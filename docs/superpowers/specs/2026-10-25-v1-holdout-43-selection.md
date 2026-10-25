# v1 holdout 43 — selection (2026-10-25)

The forty-third holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–42 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–42 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 28–42: `tippy.js`,
`gridstack`, `prismjs`, `mammoth`, `tesseract.js`, `pdfmake`, `js-yaml`, `@electric-sql/pglite`, `sql.js`,
`html5-qrcode`, `web-push` and `cytoscape` with `@sveltejs/kit` in `package.json`; `<legend`,
`<progress`, `role="combobox"`, `role="switch"`, `<kbd` and `contenteditable` in Svelte files;
`<summary` and `IntersectionObserver` in route Svelte files, and `<dl` there over 4 KB; `aria-current`
in `src/lib/components`; `import.meta.glob` in TypeScript under `src`, `$effect.root` and `isRedirect` in
TypeScript, `error(401` and `parent()` in TypeScript route modules; and files named `hooks.client` under
`src`. As in holdouts 16–42, the pool is this round's searches only.

12,016 repositories came back, and every one resolved. 6,671 remained after dropping 368 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 4,977
with no push in six months. GitHub's hourly rate limit cut the file listing short; it was rerun after the
limit reset, after which two repositories still could not be listed. 1,654 had at least 10 routes and a
lockfile; 1,434 were on Svelte 5 and Kit 2, after dropping four whose `package.json` could not be read;
1,286 remained after dropping 20 app directories named `docs`, `site`, `examples`, `templates`, `tests`,
`demo` or similar, and 128 copies or mirrors of an excluded app. 1,184 of the 1,286 had been read in an
earlier round, as far as the kept read list records (holdouts 9–42); none of those was read again or
taken. Of the 102 others, 37 belong to owners of excluded apps and were dropped; all 65 left were
shallow-cloned and read. As in holdouts 38–42, every clone's source files were compared with the corpus
clones, `components/ui/` left out; no candidate shares source files with a corpus app. The 20 finalists
(picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read.
Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 10 of the 65 were rejected because runes are in half their
components or fewer. Five repositories of one owner are evaluation copies of one Docker-management app
and were dropped together, as were a fork of another project and an app kept under an `archive/`
directory. Six otherwise fitting candidates were dropped: two commit a gitlink, one commits a lockfile
that disagrees with `package.json`, one commits two lockfiles, one has no lockfile in its app directory,
and one depends on a `file:` path outside its checkout. Each pick's lockfile was compared with its
`package.json` on each declared range: all 14 agree. No pick has a committed submodule (gitlink), an
`.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                             | Path                  | Checklist      | Prerenders | Builds | Why                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | --------------------- | -------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ebogdum/callfs](https://github.com/ebogdum/callfs/tree/017063818016)                                           | `web`                 | 6, 7, 9        | no         | yes    | Web console for a REST file server (42 routes) on adapter-static under `paths.base: '/ui'`, `ssr = false`.                                           |
| [ESPresense/ESPresense-companion](https://github.com/ESPresense/ESPresense-companion/tree/84de55340a51)         | `src/ui`              | 7, 9, 9b       | yes        | yes    | Indoor-positioning companion for a home-automation add-on (10 routes) on adapter-static, `ssr = false` with `prerender = 'auto'`.                    |
| [dreadnode/agent-lens](https://github.com/dreadnode/agent-lens/tree/9eab2b0ca729)                               | `ui`                  | 5              | no         | no     | Agent observability and replay tool for research (11 routes) on adapter-node with markdown.                                                          |
| [ArefinAlter/dynodoc](https://github.com/ArefinAlter/dynodoc/tree/f17f9b57b601)                                 | `frontend/researcher` | 1, 7, 8, 9, 10 | no         | yes    | Researcher workspace of a document version-control platform (39 routes) on adapter-node with JSON-LD, hooks and form actions, part `ssr = false`.    |
| [rudini/Dwello](https://github.com/rudini/Dwello/tree/c64da85cc6f2)                                             | `.`                   | 8, 9, 10       | no         | yes    | Property management system (48 routes) on adapter-node with hooks and form actions.                                                                  |
| [HaiderBassem/vertualspace](https://github.com/HaiderBassem/vertualspace/tree/75166d4e64ee)                     | `adminspace`          | 8, 9, 10       | no         | yes    | Administration back office for a virtual-office platform (62 routes) on adapter-node with hooks and form actions.                                    |
| [esek/kvitto](https://github.com/esek/kvitto/tree/228302fcd7a4)                                                 | `.`                   | 8, 10          | no         | no     | Receipt and bookkeeping submission site for a student section (19 routes) on adapter-node with hooks and form actions.                               |
| [mindflowgo/coursedeck](https://github.com/mindflowgo/coursedeck/tree/d793f6013999)                             | `app`                 | 5, 6, 7, 9     | no         | yes    | Study tool for course notes (10 routes) on adapter-static under a computed `paths.base`, with markdown and `ssr = false`.                            |
| [Dohkku/innerio](https://github.com/Dohkku/innerio/tree/6c315ee302f3)                                           | `apps/web`            | 7, 9, 11       | no         | yes    | Offline, end-to-end encrypted GTD task manager (13 routes) on adapter-static, `ssr = false`, in a workspace.                                         |
| [erlend-sh/atmo-board](https://github.com/erlend-sh/atmo-board/tree/67505496cb84)                               | `.`                   | 5, 8, 9        | no         | yes    | Forum app on a decentralized social protocol (10 routes) on adapter-node with markdown, hooks and form actions.                                      |
| [delfick/random-ramblings-of-a-ranga](https://github.com/delfick/random-ramblings-of-a-ranga/tree/5ddf4a48c32c) | `.`                   | 1, 5, 9        | no         | yes    | Personal blog (15 routes) on adapter-node with JSON-LD, markdown and hooks.                                                                          |
| [Axellum/vigie-web](https://github.com/Axellum/vigie-web/tree/db026ed8b7a0)                                     | `.`                   | 2, 8, 9, 10    | no         | yes    | Site and live demo for a natural-hazards and weather-warnings API (15 routes) on adapter-node with alternate-language links, hooks and form actions. |
| [BigMarketDao/bigmarket-mr](https://github.com/BigMarketDao/bigmarket-mr/tree/2665069b40a4)                     | `apps/frontend-c1`    | 5, 9, 11       | no         | yes    | Prediction-market frontend (19 routes) on adapter-node with markdown and hooks, UI from workspace packages.                                          |
| [FlorianGross/AidLog](https://github.com/FlorianGross/AidLog/tree/defb6fb3a1e0)                                 | `apps/web`            | 7, 9, 9b, 11   | yes        | yes    | End-to-end encrypted first-aid documentation app (31 routes) on adapter-static, prerendered with `ssr = false`, in a workspace.                      |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 6    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 3    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 3, 4 and 12 have no app: no pick uses superforms, a meta-tag library or a head set through an npm
package.

## How the first look runs

As in holdouts 5–42, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: callfs, agent-lens, coursedeck and vigie-web MIT; ESPresense-companion Apache-2.0; Dwello, innerio and AidLog AGPL-3.0; atmo-board the Unlicense; dynodoc commits a license GitHub does not classify; the other four have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop agent-lens without its env file.
- Runners-up, read and not picked: alv67/peculium, qjoly/hooked, GoudyMT/ask214, MatiasAgelvis/semioteca,
  compasstechlab/dora-yaki and BkOff-fr/sobria.
