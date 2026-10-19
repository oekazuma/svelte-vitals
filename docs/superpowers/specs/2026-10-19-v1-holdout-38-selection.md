# v1 holdout 38 — selection (2026-10-19)

The thirty-eighth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–37 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–37:
`@libsql/client`, `@neondatabase/serverless`, `@node-rs/argon2`, `jsonwebtoken`, `uuid`, `jszip`,
`qrcode`, `apexcharts`, `howler`, `svelte-persisted-store`, `sveltekit-flash-message` and
`@stripe/stripe-js` with `@sveltejs/kit` in `package.json`; `rel="preload"`, `theme-color`, `aria-live`,
`<picture` and `noindex` in Svelte files; `rel="icon"`, `<nav` (over 3 KB), `<header` and `{#each`
(over 8 KB) in route Svelte files; `<footer` in `src/lib` Svelte files and `$props()` (over 6 KB) in
`src/lib/components`; `export const POST` and `cookies.get(` in TypeScript route modules;
`locals.session` and `event.fetch` in TypeScript; and `rel="manifest"` in `app.html`. As in holdouts
16–37, the pool is this round's searches only.

15,331 repositories came back. GitHub's hourly rate limit cut both the repository lookup and the file
listing short; both were rerun after the limit reset, after which every repository resolved and listed.
6,551 remained after dropping 396 excluded repositories (the corpus repositories and every candidate and
runner-up of earlier holdouts) and 8,384 with no push in six months. 1,835 had at least 10 routes and a
lockfile; 1,619 were on Svelte 5 and Kit 2, after dropping two whose `package.json` could not be read;
1,462 remained after dropping 29 app directories named `docs`, `site`, `examples`, `templates`, `tests`,
`demo` or similar, and 128 copies or mirrors of an excluded app. 1,302 of the 1,462 had been read in an
earlier round, as far as the kept read list records (holdouts 9–37); none of those was read again or
taken. Of the 160 others, 38 belong to owners of excluded apps and were dropped; all 122 left were
shallow-cloned and read. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every
pinned SHA equals the clone that was read. Nothing was installed, built or run.

New this round, every clone's Svelte, TypeScript and JavaScript source files were compared byte for byte
with the corpus clones, to catch a copy of a corpus app under another name (holdout 37 took two). Files
under `components/ui/`, which shadcn-svelte copies into every app that adds it, are left out of the
comparison; with them in, six candidates matched corpus apps through those files alone. No candidate
shares other source files with a corpus app.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 24 of the 122 were rejected because runes are in half their
components or fewer. Seven otherwise fitting candidates were dropped: three commit a lockfile that
disagrees with `package.json` or its `packageManager`, one commits two lockfiles, one does both, one
commits a gitlink, and one is a tool for acquiring films and series for a media server. Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                       | Path                | Checklist      | Prerenders | Builds | Why                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ------------------- | -------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AntiTcb/ygo.tools](https://github.com/AntiTcb/ygo.tools/tree/4836527a9a3d)                               | `.`                 | 1, 4, 8, 9, 12 | no         | yes    | Tools and event map for a trading-card game (13 routes) on Cloudflare with JSON-LD, the `sk-seo` head package, hooks and form actions.                              |
| [TZGyn/shortener](https://github.com/TZGyn/shortener/tree/60347ef6e5fd)                                   | `frontend`          | 3, 8, 9        | no         | yes    | Link shortener with analytics (27 routes) on a Bun adapter with superforms, hooks and form actions.                                                                 |
| [Volkoy/locatra-ex](https://github.com/Volkoy/locatra-ex/tree/89aae4ac01ff)                               | `.`                 | 3, 8           | no         | no     | Interactive story-writing game (20 routes) on Cloudflare with superforms, hooks and form actions.                                                                   |
| [polotto/polotto.dev](https://github.com/polotto/polotto.dev/tree/5a213e69e01a)                           | `.`                 | 1, 5, 9, 9b    | yes        | yes    | Personal blog (12 routes) on adapter-static with JSON-LD and markdown, prerendered.                                                                                 |
| [thiagotn/football-manager](https://github.com/thiagotn/football-manager/tree/e961a6ee19ff)               | `football-frontend` | 1, 5, 7        | yes        | no     | Amateur football match organiser (49 routes) on adapter-node with JSON-LD and markdown, part `ssr = false`.                                                         |
| [MedPACTech/TurnKeyOps](https://github.com/MedPACTech/TurnKeyOps/tree/2c0ca3cc49bf)                       | `client`            | 1, 7, 8, 9     | no         | yes    | Multi-tenant field-service platform with each tenant's public site and admin (121 routes) on adapter-node with JSON-LD, hooks and form actions, part `ssr = false`. |
| [lgriffin/toads](https://github.com/lgriffin/toads/tree/ec197f5c6aa6)                                     | `apps/web`          | 6, 9, 10       | no         | yes    | Web hub for a game guild (19 routes) on adapter-node under a computed `paths.base`.                                                                                 |
| [DanR978/IglesiaRestauracion](https://github.com/DanR978/IglesiaRestauracion/tree/1ecf3a9889b1)           | `web`               | 6, 10          | yes        | no     | Church website (15 routes) on adapter-static under a computed `paths.base`, with a prerendered page.                                                                |
| [scottdkey/bardbase](https://github.com/scottdkey/bardbase/tree/48669f6c2a4c)                             | `projects/web`      | 9, 9b          | yes        | yes    | Multi-edition Shakespeare reader (10 routes) on Cloudflare with prerendered pages.                                                                                  |
| [parent-tobias/shared-gigwidget](https://github.com/parent-tobias/shared-gigwidget/tree/bfac10a3c341)     | `apps/web`          | 7, 11          | no         | no     | Local-first music sharing app (28 routes) on Vercel, part `ssr = false`, in a workspace.                                                                            |
| [Kyroinfra/Kyro](https://github.com/Kyroinfra/Kyro/tree/bdc7632ac47d)                                     | `packages/web`      | 8, 9, 11       | no         | yes    | Self-hosted document storage and retrieval (12 routes) on adapter-node with hooks and form actions, in a workspace.                                                 |
| [Moh-mmed/kidooz](https://github.com/Moh-mmed/kidooz/tree/d0f24ebc0fd6)                                   | `apps/web`          | 8, 11          | no         | no     | Online shop with an admin (66 routes) on adapter-node with hooks and form actions, in a workspace.                                                                  |
| [keplersystems/kepler-chat](https://github.com/keplersystems/kepler-chat/tree/d45e47960bec)               | `.`                 | 5, 8, 9, 10    | no         | yes    | Single-user chat app for a coding agent (16 routes) with markdown, hooks and form actions.                                                                          |
| [SecureCloudGroup/SmartBrain_3000](https://github.com/SecureCloudGroup/SmartBrain_3000/tree/8d753fdf1e9d) | `web`               | 5, 7, 9        | no         | yes    | Local personal assistant (26 routes) on adapter-static, `ssr = false`, with markdown.                                                                               |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 1    |
| 5   | markdown/mdsvex                             | 4    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 7    |
| 9   | likely builds without services              | 9    |
| 10  | component-resolution shapes                 | 3    |
| 11  | UI from a workspace package                 | 3    |
| 12  | head from an npm package without an adapter | 1    |
| 9b  | prerenders pages and likely builds          | 2    |

Item 2 has no app: no candidate writes alternate-language links. Items 4 and 12 are ygo.tools, whose
pages set their head through the `sk-seo` package, which svelte-vitals has no adapter for.

## How the first look runs

As in holdouts 5–37, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: shortener and bardbase MIT; SmartBrain_3000 the Elastic License 2.0; the other eleven have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop locatra-ex, football-manager, IglesiaRestauracion, shared-gigwidget and kidooz without their env files.
- Runners-up, read and not picked: LorenzoRizzolo/splitto, PaddiM8/Planera, witfoo/due-diligence-portal,
  noelzappy/querr, darkolive/inqbeta-q and prashant-shahi/docxpdf.
