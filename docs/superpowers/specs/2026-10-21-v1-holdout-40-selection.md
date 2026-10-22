# v1 holdout 40 — selection (2026-10-21)

The fortieth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–39 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34, 37, 38 and 39 passed every
deciding criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and
recorded here **before svelte-vitals has run on any of them**. The criteria are judged on the first look
only. C8 is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only
rules whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–39: `bcryptjs`,
`@codemirror/view`, `daisyui`, `@vite-pwa/sveltekit`, `html2canvas`, `jspdf`, `@google/generative-ai`,
`canvas-confetti`, `mongodb`, `exceljs`, `hono` and `driver.js` with `@sveltejs/kit` in `package.json`;
`<header`, `bind:this`, `<select` and `aria-hidden` in route Svelte files, and `<table` there over 5 KB;
`aria-label=` (over 4 KB), `transition:` and `<h2` (over 5 KB) in `src/lib/components`; `+error.svelte`
and `<video` in Svelte files; `cookies.set(` in TypeScript route modules; `event.locals` in TypeScript
hooks; `LayoutLoad` in TypeScript; `RequestHandler` in TypeScript under `src/routes/api`;
`$env/dynamic/private` in TypeScript under `src/lib/server`; and `apple-touch-icon` in `app.html`. As in
holdouts 16–39, the pool is this round's searches only.

14,036 repositories came back; 2 no longer resolved. 5,935 remained after dropping 391 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 7,708
with no push in six months. GitHub's hourly rate limit cut the file listing short; it was rerun after the
limit reset, and every repository listed. 1,797 had at least 10 routes and a lockfile; 1,606 were on
Svelte 5 and Kit 2, after dropping two whose `package.json` could not be read; 1,463 remained after
dropping 15 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and
128 copies or mirrors of an excluded app. 1,339 of the 1,463 had been read in an earlier round, as far as
the kept read list records (holdouts 9–39); none of those was read again or taken. Of the 124 others, 44
belong to owners of excluded apps and were dropped; all 80 left were shallow-cloned and read. As in
holdouts 38 and 39, every clone's source files were compared with the corpus clones, `components/ui/`
left out; no candidate shares source files with a corpus app. The 20 finalists (picks and runners-up)
were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 20 of the 80 were rejected because runes are in half their
components or fewer. Two otherwise fitting candidates were dropped: both commit a gitlink, and one of them
also commits two lockfiles. Each pick's lockfile was compared with its `package.json` on each declared
range: all 14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at a private
registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                       | Path                | Checklist           | Prerenders | Builds | Why                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------- | ------------------- | ------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ajith4Tech/rforum](https://github.com/ajith4Tech/rforum/tree/903c553f485f)                               | `frontend`          | 1, 9                | no         | yes    | Live audience engagement platform for presentations (14 routes) on adapter-static with JSON-LD in `app.html`.                                                    |
| [ubeann/vmb](https://github.com/ubeann/vmb/tree/e18a3abbcaba)                                             | `apps/web`          | 3, 8, 9, 10, 11     | no         | yes    | Internal warehouse and project admin tool (17 routes) on Cloudflare with superforms, hooks and form actions, in a workspace.                                     |
| [westborn/SB-Reg-svelte5](https://github.com/westborn/SB-Reg-svelte5/tree/bd39957fefed)                   | `.`                 | 3, 8                | no         | no     | Artist registration and artwork submission system for a sculpture exhibition (16 routes) with superforms, Prisma, hooks and form actions.                        |
| [Gooowan/matchup](https://github.com/Gooowan/matchup/tree/7426d52cf4dd)                                   | `services/frontend` | 3, 7, 9, 9b         | yes        | yes    | Dance partner matching app with feed, chats, map and admin (25 routes) on adapter-static with superforms, and a root layout that prerenders with `ssr = false`.  |
| [Isaza-Labs/flow-weaver](https://github.com/Isaza-Labs/flow-weaver/tree/0e8448928f3f)                     | `frontend`          | 5, 7, 9             | no         | yes    | Self-hosted network automation platform with a visual workflow editor (99 routes) on adapter-node with markdown, hooks and `ssr = false`.                        |
| [Heracraft/repose](https://github.com/Heracraft/repose/tree/83eb7d166090)                                 | `apps/web`          | 5, 7, 9, 9b, 10, 11 | yes        | yes    | Site and dashboard for persistent remote coding-agent machines (13 routes) on adapter-node with markdown, part `ssr = false`, prerendered pages, in a workspace. |
| [reubenmiller/lab-ztp-provisioner](https://github.com/reubenmiller/lab-ztp-provisioner/tree/a7f13f95404b) | `web`               | 6, 7, 9             | no         | yes    | Zero-touch device provisioning console (11 routes) on adapter-static with `kit.paths.base` set to `''` and `ssr = false`.                                        |
| [jhoelzl/swing-dance-moves](https://github.com/jhoelzl/swing-dance-moves/tree/a7bc08068264)               | `frontend`          | 6, 7, 9, 9b         | yes        | yes    | Swing dance moves catalogue as a PWA (12 routes) on adapter-static under a computed `paths.base`, `ssr = false`, with a prerendered page.                        |
| [ABGEO/maroid](https://github.com/ABGEO/maroid/tree/60e9336d38ba)                                         | `apps/deck`         | 7, 9, 10, 11        | no         | yes    | Admin dashboard for a self-hosted device hub with workspaces, plugins and providers (20 routes) on adapter-node, `ssr = false`, UI from a workspace package.     |
| [diniztheus/controle-financeiro](https://github.com/diniztheus/controle-financeiro/tree/231d56d9a8c5)     | `.`                 | 8, 9                | no         | yes    | Local personal finance tracker on SQLite (24 routes) on adapter-node with hooks and form actions.                                                                |
| [DriscollDev/Widgetry](https://github.com/DriscollDev/Widgetry/tree/a0a719345aa8)                         | `apps/web`          | 8, 9, 11            | no         | yes    | Customisable API-monitoring dashboard of widget boards (16 routes) on adapter-node with hooks and form actions, in a workspace.                                  |
| [JaakkoLipp/concord](https://github.com/JaakkoLipp/concord/tree/24fb446c6795)                             | `apps/web`          | 7, 9, 10, 11        | no         | yes    | Discord-style chat and voice app for one community (14 routes) on adapter-node with hooks and `ssr = false`, UI from a workspace package.                        |
| [ajianaz/gofin-full](https://github.com/ajianaz/gofin-full/tree/ea7b2bbd2730)                             | `web`               | 9                   | no         | yes    | Self-hosted double-entry personal finance tracker (50 routes) on adapter-node with hooks.                                                                        |
| [evanxdsouza/mangrove](https://github.com/evanxdsouza/mangrove/tree/bef04a7e1e74)                         | `web`               | 7, 9, 10            | no         | yes    | Control plane for a small self-hosted PaaS (10 routes) on adapter-static, `ssr = false`.                                                                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 1    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 8    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 5    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 2, 4 and 12 have no app: no candidate writes alternate-language links, uses a meta-tag library or
sets its head through an npm package.

## How the first look runs

As in holdouts 5–39, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: rforum MIT; flow-weaver, lab-ztp-provisioner and gofin-full Apache-2.0; concord AGPL-3.0; vmb commits a license GitHub does not classify; the other eight have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop SB-Reg-svelte5 without its env file.
- Runners-up, read and not picked: OscarCarPu/gv-web, LNA-DEV/HomePageCompanion, Klaynight-dev/Openforms,
  germaniii-com/devtools, samuelstrom93/pingit and mbaneshi/rusvel.
