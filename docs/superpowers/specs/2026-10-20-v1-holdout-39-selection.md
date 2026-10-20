# v1 holdout 39 — selection (2026-10-20)

The thirty-ninth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–38 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34, 37 and 38 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 26–38: `@ai-sdk/svelte`,
`@anthropic-ai/sdk`, `pdfjs-dist`, `xlsx`, `dompurify`, `sanitize-html`, `markdown-it`, `gray-matter`,
`@tanstack/svelte-virtual`, `pino`, `redis` and `satori` with `@sveltejs/kit` in `package.json`;
`og:image:alt`, `twitter:site`, `hrefLang`, `role="main"` and `alt=""` in Svelte files; `<article`,
`<aside` and `{@html` in route Svelte files; `<svelte:head>`, `<h1` and `<img` (over 3 KB) in
`src/lib/components`; `import { base }` in `src/lib` Svelte files; `PageServerLoad` and `fail(422` in
TypeScript; `error(500` in TypeScript route modules; and `%lang%` in `app.html`. As in holdouts 16–38,
the pool is this round's searches only.

12,792 repositories came back; 1 no longer resolved. 6,285 remained after dropping 387 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 6,119
with no push in six months. GitHub's hourly rate limit cut the file listing short; it was rerun after the
limit reset, and every repository listed. 1,807 had at least 10 routes and a lockfile; 1,601 were on
Svelte 5 and Kit 2, after dropping four whose `package.json` could not be read; 1,447 remained after
dropping 24 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar, and
130 copies or mirrors of an excluded app. 1,325 of the 1,447 had been read in an earlier round, as far as
the kept read list records (holdouts 9–38); none of those was read again or taken. Of the 122 others, 31
belong to owners of excluded apps and were dropped; the 91 left were shallow-cloned, one of them an empty
repository, and the other 90 read. As in holdout 38, every clone's source files were compared with the
corpus clones, `components/ui/` left out; no candidate shares source files with a corpus app. The 20
finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that
was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 22 of the 90 were rejected because runes are in half their
components or fewer. Three otherwise fitting candidates were dropped: two depend on a `file:` path outside
their checkout and one commits two lockfiles. Each pick's lockfile was compared with its `package.json`
on each declared range: all 14 agree. No pick has a committed submodule (gitlink), an `.npmrc` pointing at
a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                   | Path                | Checklist          | Prerenders | Builds | Why                                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------- | ------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| [trakt/trakt-web](https://github.com/trakt/trakt-web/tree/4242837b6b9c)                               | `projects/client`   | 1, 5, 7, 9         | no         | yes    | Watch-history tracking service's web client (95 routes) on Cloudflare with JSON-LD and markdown, part `ssr = false`. |
| [owodunni/curarehab](https://github.com/owodunni/curarehab/tree/0e410321bbd9)                         | `packages/web`      | 1, 2, 10           | no         | no     | Physiotherapy clinic website (19 routes) on Cloudflare with JSON-LD and alternate-language links.                    |
| [brodbeckleon/matthias-brodbeck](https://github.com/brodbeckleon/matthias-brodbeck/tree/0044f88d80cc) | `.`                 | 1, 2, 8, 9, 9b, 10 | yes        | yes    | Musician's portfolio site (23 routes) on Vercel with JSON-LD, alternate-language links, hooks and form actions.      |
| [ESchouten/ai-detector](https://github.com/ESchouten/ai-detector/tree/5a56ed06cfd3)                   | `web`               | 3, 8, 9            | no         | yes    | Local camera-detection recorder (19 routes) on adapter-node with superforms, hooks and form actions.                 |
| [Flexksx/ai-marketing-platform](https://github.com/Flexksx/ai-marketing-platform/tree/27d180efe45c)   | `apps/web`          | 3, 5, 7, 9         | no         | yes    | Marketing-content generation platform (11 routes) with superforms and mdsvex, part `ssr = false`.                    |
| [maltzsama/baleia](https://github.com/maltzsama/baleia/tree/b765fa4786ed)                             | `web`               | 5, 7, 9, 9b        | yes        | yes    | Self-hosted SQL IDE and catalog manager (41 routes) on adapter-static with markdown and prerendered pages.           |
| [the-astrosky-ecosystem/website](https://github.com/the-astrosky-ecosystem/website/tree/3ef773f4590f) | `.`                 | 5, 9, 9b, 10       | yes        | yes    | Community project website (12 routes) on adapter-static with mdsvex, prerendered.                                    |
| [nathanfaucett/rs-of](https://github.com/nathanfaucett/rs-of/tree/9cfad4be26ff)                       | `apps/app`          | 6, 7, 9, 9b, 11    | yes        | yes    | Offline-first identity provider's app (19 routes) on adapter-static under a computed `paths.base`, in a workspace.   |
| [vaionex/telomere.ai](https://github.com/vaionex/telomere.ai/tree/24df3ba9b908)                       | `apps/web`          | 1, 7, 9, 11        | no         | yes    | In-browser genetic analysis platform (14 routes) on adapter-static with JSON-LD, part `ssr = false`, in a workspace. |
| [thoutmose/axon](https://github.com/thoutmose/axon/tree/890413101f4b)                                 | `web`               | 7, 9, 9b           | yes        | yes    | Self-hosted personal organiser (72 routes) on adapter-node, part `ssr = false`, with a prerendered page.             |
| [gr8monk3ys/finance-owl](https://github.com/gr8monk3ys/finance-owl/tree/7df2911db61d)                 | `packages/frontend` | 8, 9, 11           | no         | yes    | Self-hosted personal finance manager (75 routes) on Vercel with hooks and form actions, in a workspace.              |
| [b4its/kepin-official](https://github.com/b4its/kepin-official/tree/8c3be5a99252)                     | `frontend`          | 10                 | no         | no     | Multi-tenant small-business finance app (50 routes) on adapter-node with hooks.                                      |
| [schmolldechse/archive](https://github.com/schmolldechse/archive/tree/fd63cc4c95c3)                   | `frontend`          | 8, 9, 10           | no         | yes    | Web-page snapshot archive (12 routes) on a Bun adapter with hooks and form actions.                                  |
| [lilBunnyRabbit/series-tracker](https://github.com/lilBunnyRabbit/series-tracker/tree/abc4adec0e70)   | `.`                 | 6, 7, 9, 9b        | yes        | yes    | Browser-only TV and film tracker (33 routes) on adapter-static under a computed `paths.base`, part `ssr = false`.    |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 4    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 7    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 5    |
| 11  | UI from a workspace package                 | 3    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 6    |

Items 4 and 12 have no app: no candidate uses a meta-tag library or sets its head through an npm package.

## How the first look runs

As in holdouts 5–38, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: curarehab, ai-marketing-platform, finance-owl and trakt-web (Trakt Inc.) GPL-3.0; axon AGPL-3.0; baleia and rs-of Apache-2.0; telomere.ai and the Astrosky website MIT; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop curarehab and kepin-official without their env files.
- Runners-up, read and not picked: VeeLume/starlume, jump-stuff/site, muksmuksmuks/ruesoft.com,
  Lenny004/koffisoft_admin, jaapstronks/woobuddy and heftreng49/heftreng-android.
