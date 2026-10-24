# v1 holdout 42 — selection (2026-10-24)

The forty-second holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–41 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–41 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 27–41: `langchain`,
`localforage`, `lottie-web`, `emoji-picker-element`, `wavesurfer.js`, `socket.io-client`, `xstate`,
`nanostores`, `@sanity/client`, `@directus/sdk`, `@sveltejs/enhanced-img` and `ofetch` with
`@sveltejs/kit` in `package.json`; `<fieldset`, `<blockquote`, `role="tab"`, `aria-modal`, `popover` and
`decoding="async"` in Svelte files; `<details`, `<time` and `role="alert"` in route Svelte files, and
`page.data` there over 4 KB; `<figure` and `aria-expanded` (over 4 KB) in `src/lib/components`;
`SvelteMap` and `ParamMatcher` in TypeScript, `MediaQuery` in TypeScript under `src/lib`, and
`trailingSlash` in TypeScript route modules. As in holdouts 16–41, the pool is this round's searches
only.

11,623 repositories came back, and every one resolved. 6,172 remained after dropping 367 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 5,084
with no push in six months. 1,511 had at least 10 routes and a lockfile; 1,318 were on Svelte 5 and Kit 2,
after dropping one whose `package.json` could not be read; 1,206 remained after dropping 22 app
directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and 90 copies or
mirrors of an excluded app. 1,118 of the 1,206 had been read in an earlier round, as far as the kept read
list records (holdouts 9–41); none of those was read again or taken. Of the 88 others, 39 belong to
owners of excluded apps and were dropped; all 49 left were shallow-cloned and read. As in holdouts 38–41,
every clone's source files were compared with the corpus clones, `components/ui/` left out:
Cinephage/Cinephage shares all 2,060 of its source files with the corpus app MoldyTaint/Cinephage and was
dropped as a copy; no other candidate shares source files with a corpus app. The 20 finalists (picks and
runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was
installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 11 of the 49 were rejected because runes are in half their
components or fewer. Nine otherwise fitting candidates were dropped: two depend on a `file:` path outside
their checkout (one of them also with a lockfile that disagrees with `package.json`), one commits a
gitlink, one points `.npmrc` at a non-npm registry and commits a lockfile that disagrees with
`package.json`, one has no lockfile in its app directory, and the others are a component showcase, a
demo, a project's marketing site and one published under a notice forbidding its use. Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                                 | Path           | Checklist  | Prerenders | Builds | Why                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [outpoot/twoblade](https://github.com/outpoot/twoblade/tree/effbbd253c99)                                                           | `website`      | 7, 8       | no         | no     | Web interface for a decentralized email protocol (16 routes) on adapter-node with hooks and form actions, `ssr = false`.                                                                                            |
| [iagolavor/inertia](https://github.com/iagolavor/inertia/tree/9557831cff51)                                                         | `apps/web`     | 7, 9, 9b   | yes        | yes    | Peer-to-peer social network client (12 routes) on adapter-static, prerendered with `ssr = false`.                                                                                                                   |
| [Moravec-Pty-Ltd/deck](https://github.com/Moravec-Pty-Ltd/deck/tree/0614596a30bc)                                                   | `.`            | 7, 9       | no         | yes    | Browser app driving coding-agent sessions and terminals on one machine (10 routes) on adapter-node with hooks, part `ssr = false`.                                                                                  |
| [zajca/zfaktury](https://github.com/zajca/zfaktury/tree/52190cd112ee)                                                               | `frontend`     | 7, 9, 9b   | yes        | yes    | Invoicing and tax app for sole proprietors (45 routes) on adapter-static, prerendered with `ssr = false`.                                                                                                           |
| [curtis9735/The-Whatever-Tracker](https://github.com/curtis9735/The-Whatever-Tracker/tree/b136f7e38abe)                             | `.`            | 8, 9       | no         | yes    | Self-hosted tracker for collections of anything (25 routes) on adapter-node with hooks and form actions.                                                                                                            |
| [waffleflopper/trooptotask](https://github.com/waffleflopper/trooptotask/tree/9ea63f4122ca)                                         | `.`            | 10         | no         | no     | Unit personnel, training and assignment management platform (72 routes) on Vercel with hooks and form actions.                                                                                                      |
| [benditandayusaputra/depotin](https://github.com/benditandayusaputra/depotin/tree/3f76243275f1)                                     | `apps/web`     | 7, 9, 9b   | yes        | yes    | Order and courier management for a water refill depot (19 routes) on Vercel with hooks, a prerendered landing and `ssr = false` dashboards.                                                                         |
| [gaato/offkai-manager](https://github.com/gaato/offkai-manager/tree/71c271bdb955)                                                   | `.`            | 2, 3, 8, 9 | no         | yes    | Organiser web UI for a meetup bot (39 routes) on adapter-node with alternate-language links, superforms, hooks and form actions.                                                                                    |
| [t1stm/musicrain](https://github.com/t1stm/musicrain/tree/e92f53654e71)                                                             | `Frontend`     | —          | no         | no     | Self-hosted web music player (16 routes) on adapter-static.                                                                                                                                                         |
| [migmoroni/veterinary-clinic](https://github.com/migmoroni/veterinary-clinic/tree/7ec74fa355a1)                                     | `apps/vet-app` | 7, 9, 11   | no         | yes    | Local-first veterinary clinic desktop app (29 routes) on adapter-static, `ssr = false`, UI from workspace packages.                                                                                                 |
| [NicholasCullenCooper/nicholascullencooper.com](https://github.com/NicholasCullenCooper/nicholascullencooper.com/tree/103e54f0aae7) | `web`          | 5          | yes        | no     | Personal site with writing, photography and projects (18 routes) on Cloudflare with markdown, prerendered.                                                                                                          |
| [jackhale98/Tessera](https://github.com/jackhale98/Tessera/tree/fc9fdde9e1c3)                                                       | `apps/desktop` | 7, 9       | no         | yes    | Desktop app for engineering artifacts with traceability (71 routes) on adapter-static, `ssr = false`.                                                                                                               |
| [edsuwarna/anjungan](https://github.com/edsuwarna/anjungan/tree/099f7f914716)                                                       | `frontend`     | 9          | no         | yes    | Internal developer platform console (29 routes) on adapter-static with a fallback page; its `ssr = false` and `prerender = true` sit in `src/+layout.js`, outside `src/routes`, where SvelteKit does not read them. |
| [DeckDumpster/pokedumpster](https://github.com/DeckDumpster/pokedumpster/tree/a6c247258fdf)                                         | `frontend`     | 7, 9, 10   | no         | yes    | Single-user trading-card collection tracker (24 routes) on adapter-static, `ssr = false`.                                                                                                                           |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 0    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 1    |
| 6   | `kit.paths.base`                            | 0    |
| 7   | large SPA/dashboard, `ssr = false`          | 8    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 10   |
| 10  | component-resolution shapes                 | 2    |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 1, 4, 6 and 12 have no app: no pick writes JSON-LD, uses a meta-tag library, sets `kit.paths.base`
or sets its head through an npm package.

## How the first look runs

As in holdouts 5–41, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: offkai-manager AGPL-3.0; deck, depotin and Tessera MIT; anjungan Apache-2.0; musicrain the Unlicense; twoblade, inertia and veterinary-clinic commit a license GitHub does not classify; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop twoblade, trooptotask, musicrain and the Cooper site without their env files.
- Runners-up, read and not picked: DebanganThakuria/arcane-translator, k2ct/rdpm-archive,
  Sufiane/psg_inventory, GDB-11/rxlink-sv, Agics-hsjeong/ACP-Project and mitaro-cs/Films-Serials-For-You-.
