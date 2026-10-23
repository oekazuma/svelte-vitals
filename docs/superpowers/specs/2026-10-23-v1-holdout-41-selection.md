# v1 holdout 41 — selection (2026-10-23)

The forty-first holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–40 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–40 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–40: `monaco-editor`,
`web-vitals`, `ollama`, `minisearch`, `idb-keyval`, `meilisearch`, `unplugin-icons`, `pdf-lib`, `hls.js`,
`flatpickr`, `nprogress` and `shepherd.js` with `@sveltejs/kit` in `package.json`; `role="button"`,
`aria-describedby`, `autofocus`, `bind:group`, `animate:`, `<canvas` and `<audio` in Svelte files;
`<form`, `aria-labelledby`, `sr-only` and `onDestroy` in route Svelte files, `<section` there over 4 KB
and `<svg` over 6 KB; `<h3` (over 4 KB) in `src/lib/components`; `innerHTML` in TypeScript under
`src/lib`; and `Actions` in TypeScript route modules. As in holdouts 16–40, the pool is this round's
searches only.

11,786 repositories came back; 50 no longer resolved. 5,349 remained after dropping 350 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 6,037
with no push in six months. 1,399 had at least 10 routes and a lockfile, after dropping three whose file
listing failed; 1,249 were on Svelte 5 and Kit 2, after dropping two whose `package.json` could not be
read; 1,148 remained after dropping 15 app directories named `docs`, `site`, `examples`, `templates`,
`tests`, `demo` or similar, and 86 copies or mirrors of an excluded app. 1,056 of the 1,148 had been read
in an earlier round, as far as the kept read list records (holdouts 9–40); none of those was read again
or taken. Of the 92 others, 30 belong to owners of excluded apps and were dropped; all 62 left were
shallow-cloned and read. As in holdouts 38–40, every clone's source files were compared with the corpus
clones, `components/ui/` left out: tbt-eng/tybalt_turbo shares 230 of its 323 source files with the
corpus app stamler/tybalt_turbo and was dropped as a copy; no other candidate shares source files with a
corpus app. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA
equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 13 of the 62 were rejected because runes are in half their
components or fewer. Six otherwise fitting candidates were dropped: three commit a gitlink (two of them
also depend on a `file:` path outside their checkout), one commits a lockfile that disagrees with
`package.json`, one commits two lockfiles, and one is a fork of another project's app. Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                             | Path           | Checklist          | Prerenders | Builds | Why                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | -------------- | ------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [muxshed/shed](https://github.com/muxshed/shed/tree/4a8a80c89eb4)                                               | `web`          | 7, 9, 9b           | yes        | yes    | Self-hosted multistream production studio (17 routes) on adapter-static, `ssr = false`, with an `(app)` layout that prerenders its shells.                                     |
| [PURE3D-EU/pure3d](https://github.com/PURE3D-EU/pure3d/tree/4a39d350b3f8)                                       | `.`            | 5, 6, 7, 10        | no         | no     | 3D heritage collections and editions platform (44 routes) on adapter-static under a computed `paths.base`, with markdown, hooks and `ssr = false`.                             |
| [johnverrone/jv](https://github.com/johnverrone/jv/tree/6f925f661283)                                           | `johnverrone`  | 1, 7, 8, 9         | no         | yes    | Personal site with an admin for gear, guitar, coffee and photos (28 routes) on Cloudflare with JSON-LD, hooks and form actions, part `ssr = false`.                            |
| [olafkfreund/skill_pool](https://github.com/olafkfreund/skill_pool/tree/e3ea604d46aa)                           | `web`          | 1, 5, 8, 9         | no         | yes    | Self-hosted registry of agent skills for teams (26 routes) on adapter-node with JSON-LD, markdown, hooks and form actions.                                                     |
| [Ku6epXBOCTuK/ku6epxboctuk.github.io](https://github.com/Ku6epXBOCTuK/ku6epxboctuk.github.io/tree/0f13387dd870) | `.`            | 2, 5, 7, 9, 9b, 11 | yes        | yes    | Personal site with posts, articles and a weekly log in two languages (21 routes) on adapter-static with alternate-language links and markdown, prerendered with `ssr = false`. |
| [shaik-zeeshan/mnema](https://github.com/shaik-zeeshan/mnema/tree/85dcb9931960)                                 | `apps/desktop` | 5, 7, 9, 10        | no         | yes    | Desktop app for a private, searchable record of screen and audio (10 routes) on adapter-static with markdown, `ssr = false`.                                                   |
| [furkanalp41/VulnArena](https://github.com/furkanalp41/VulnArena/tree/89df2cff7824)                             | `web`          | 5, 9               | no         | yes    | Collaborative secure-code-audit training platform (24 routes) on Vercel with markdown.                                                                                         |
| [CPU-commits/muelle](https://github.com/CPU-commits/muelle/tree/918a3f3b5282)                                   | `web`          | 7, 9, 10           | no         | yes    | Deploy manager panel over Docker Swarm (19 routes) on adapter-static, `ssr = false`, with form actions.                                                                        |
| [ianzepp/gofolio-web](https://github.com/ianzepp/gofolio-web/tree/0eca78652ee7)                                 | `.`            | 8, 9               | no         | yes    | Portfolio and wealth management frontend (21 routes) on adapter-node with hooks and form actions.                                                                              |
| [tmag-advisory/support](https://github.com/tmag-advisory/support/tree/72479bed012a)                             | `.`            | 7, 9               | no         | yes    | Support and billing operations console (43 routes) with `ssr = false`.                                                                                                         |
| [lukislp/mowdeck](https://github.com/lukislp/mowdeck/tree/e5d5f9afceab)                                         | `apps/web`     | 7, 9, 10, 11       | no         | yes    | Self-hosted control centre for robotic lawn mowers (33 routes) on adapter-static, `ssr = false`, UI from a workspace package.                                                  |
| [smart-social-contracts/Casals](https://github.com/smart-social-contracts/Casals/tree/dabe5d576a35)             | `frontend`     | 9, 10              | no         | yes    | Lifecycle orchestrator console for Internet Computer canisters (13 routes) on adapter-static.                                                                                  |
| [digitalbenin/okpan-app](https://github.com/digitalbenin/okpan-app/tree/9e3c21529f8f)                           | `.`            | 6, 7, 9            | no         | yes    | Desktop collection-management tool (42 routes) on adapter-static with `kit.paths.base` set to `''` and `ssr = false`.                                                          |
| [maximmalchevsky/hack](https://github.com/maximmalchevsky/hack/tree/8deacc959a1b)                               | `web`          | 5, 9               | no         | yes    | Working-time tracking and team planning app (25 routes) on adapter-node with markdown.                                                                                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 0    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 6    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 9    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 3, 4 and 12 have no app: no pick uses superforms (the one candidate that did commits a gitlink and a
`file:` dependency outside its checkout), a meta-tag library or a head set through an npm package.

## How the first look runs

As in holdouts 5–40, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: shed, mnema and mowdeck AGPL-3.0; pure3d Apache-2.0; the Ku6epXBOCTuK site, muelle and Casals MIT; the other seven have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop pure3d without its env file.
- Runners-up, read and not picked: JunHCha/sessionary, arc360alt/pronouns, brightdev3/maths,
  aikhe/ego-ipse, rdnk2004/expense-tracker-svelte and betallsoph/roomio-client.
