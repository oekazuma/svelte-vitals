# v1 holdout 16 — selection (2026-10-02)

The sixteenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–15 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only; C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`).

## How they were chosen

Search: one new round of code search (12 queries) aimed at the shapes holdout 15's fixes touched and
at the checklist items earlier rounds left thin: `_ENABLED = false` exports and `{#if !…_ENABLED}`
tests; a renamed `children` prop (`children: content`); `{#snippet header()}` in route files; a
`$state(` next to a `return` in `src/lib`; `svelte-meta-tags` and `svelte-seo` in `package.json`;
`paths` with `base:` in `svelte.config.js`; `workspace:*` next to `@sveltejs/kit`; `hreflang` in route
files; `sveltekit-superforms`; and `mdsvex` in `svelte.config.js`. Unlike earlier rounds, the pool is
this round's searches only: the per-repository tree and `package.json` caches of earlier rounds were
lost with the scratch directory, and only the repositories a new search hit could be shortlisted in
any case.

6,014 repositories came back; 3,093 remained after dropping 136 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 2,785 with no push in six
months; 830 had at least 10 routes and a lockfile; 754 were on Svelte 5 and Kit 2; 719 remained after
dropping 23 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar,
and 12 copies or mirrors of an excluded app. 340 of the 719 had been read in an earlier round, as far
as the kept read list records (holdouts 9–15; those of holdouts 5–8 are no longer available, so an app
read and rejected then could be read again; every pick and runner-up of those rounds stays excluded);
none of those was read again or taken. Of the 379 others, 9 belong to owners of excluded apps and were
dropped; 140 were taken round-robin across the eleven queries that had hits, highest-starred first,
and shallow-cloned. Two clones failed (one network error, one checkout error) and were left out, so
138 were read. The 21 finalists (picks and runners-up) were re-fetched at pin time, and every pinned
SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 10 of the 138 were rejected because more of their components use
`export let` than runes. Two otherwise fitting candidates were dropped: one whose lockfile disagrees
with its `package.json` (gdluxx/gdluxx) and one with a `file:` dependency (Amarosuli/CMMS). Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
`.gitmodules` file, an `.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside
its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                     | Path         | Checklist       | Prerenders | Builds | Why                                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------ | --------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| [AtalayaLabs/OxiCloud](https://github.com/AtalayaLabs/OxiCloud/tree/8c0dd334cf06)                       | `frontend`   | 6, 7, 9, 10     | no         | yes    | Self-hosted cloud storage UI (22 routes) on adapter-static with `ssr = false` and a `paths.base`, many snippets.        |
| [nasty-project/nasty](https://github.com/nasty-project/nasty/tree/9a5801d25461)                         | `webui`      | 7, 9, 10        | no         | yes    | NAS management UI (29 routes), `ssr = false` at the root, `.svelte.ts` state modules.                                   |
| [useindelible/indelible](https://github.com/useindelible/indelible/tree/37e90494d3fa)                   | `web`        | 5, 7, 9, 10     | no         | yes    | Article and book library (37 routes) with `ssr = false` layouts, prop-decided headings, `.svelte.ts` state factories.   |
| [forewit/daggerheart-daggerbrain](https://github.com/forewit/daggerheart-daggerbrain/tree/cdc87eb8a8be) | `.`          | 1, 3, 5, 10     | no         | no     | Tabletop character builder (30 routes) on Cloudflare: JSON-LD, superforms, markdown content, hooks.                     |
| [office-rivals/mmr-project](https://github.com/office-rivals/mmr-project/tree/f70e56a37b3d)             | `frontend`   | 3, 9, 10        | no         | yes    | Office league ranking (23 routes, 14 action files) with superforms and `<svelte:element>` headings.                     |
| [qfiber/hybridsocial](https://github.com/qfiber/hybridsocial/tree/63dfddb4ba14)                         | `frontend`   | 5, 9, 10        | no         | yes    | ActivityPub social network front end (79 routes) with hooks and many snippets.                                          |
| [vgebrev/leagr](https://github.com/vgebrev/leagr/tree/5e620ca7e79b)                                     | `.`          | 9, 10           | no         | yes    | Football league organiser (22 routes) on adapter-node with hooks; `{#snippet header()}` in its routes.                  |
| [lyriks-io/lyriks-community](https://github.com/lyriks-io/lyriks-community/tree/1536fbb47d8a)           | `.`          | 5, 8, 9, 10     | no         | yes    | Product-specification platform (15 routes) on adapter-node with hooks and form actions; `.svelte.ts` stores.            |
| [sirlag/Herocraft](https://github.com/sirlag/Herocraft/tree/98350d243e49)                               | `src/webapp` | 3, 10, 9b       | yes        | no     | Card database and deck builder (29 routes, 9 action files) on Cloudflare: superforms, prop-decided headings, prerender. |
| [tierdom/tierdom-app](https://github.com/tierdom/tierdom-app/tree/14e6a4611a19)                         | `.`          | 5, 8, 9, 10     | no         | yes    | Self-hosted tier list aggregator (17 routes, 12 action files) on adapter-node; prop-decided headings.                   |
| [firdausng/duitgee](https://github.com/firdausng/duitgee/tree/264e139a920e)                             | `.`          | 3, 5, 7, 9, 10  | no         | yes    | Expense tracker (70 routes) on Cloudflare: superforms, markdown, `ssr = false` vault routes, shadcn components.         |
| [Santrionlinecom/web](https://github.com/Santrionlinecom/web/tree/3924a28af1e8)                         | `.`          | 1, 2, 9, 10, 9b | yes        | yes    | Institution directory site (14 routes) on Cloudflare: JSON-LD, hreflang alternates, six prerendered routes.             |
| [caelo-cms/caelo-cms](https://github.com/caelo-cms/caelo-cms/tree/c4896b03ceca)                         | `apps/admin` | 5, 9, 10, 11    | no         | yes    | CMS admin (90 routes, 77 action files) on a Bun adapter; 15 components import a `workspace:*` package.                  |
| [openlobbying/openlobbying](https://github.com/openlobbying/openlobbying/tree/eefd27cb9354)             | `.`          | 1, 8, 9, 10     | no         | yes    | Lobbying-data platform (10 routes) on adapter-node: JSON-LD, mdsvex, hooks and form actions.                            |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 4    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 7    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 4 and 12 have no app: the meta-tag library searches left two unread repositories with 10 routes,
neither an application that passed the filters.

Shapes the last fixes touched:

- **Parameterless snippets** (`{#snippet header()}`, the shape a component's content supplies as a
  prop): 11 of the 14, most in OxiCloud, indelible, hybridsocial, leagr and duitgee.
- **A `.svelte.ts` module that creates a `$state` and `return`s a binding:** OxiCloud, nasty,
  indelible, daggerbrain, hybridsocial, lyriks-community and tierdom-app.
- **A layout `{#if}` on an imported literal-`false` flag:** none. 23 of the 138 read came from the
  `{#if !…_ENABLED}` search; none that passed the filters tests such a flag (the closest,
  jdvlpr/Temperature-Blanket-Web-App, tests `$env/static/public` links).

## How the first look runs

As in holdouts 5–15, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged;
C8 is reported without deciding the result.

## Notes

- License: OxiCloud, mmr-project, leagr and tierdom-app MIT; nasty and openlobbying GPL-3.0;
  indelible, hybridsocial and lyriks-community AGPL-3.0; caelo-cms MPL-2.0; the other four have no
  license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop daggerbrain and Herocraft without their env files.
- Runners-up, read and not picked: dabund24/vahrplan, CropWatchDevelopment/CropWatch,
  Saberr-app/Saberr-UI, helblinglilly/pokecompanion, sabereen/dorkhani, simmons-tech/new-simmons and
  stageddat/shelter-web.
