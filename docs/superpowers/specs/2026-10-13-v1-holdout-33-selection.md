# v1 holdout 33 — selection (2026-10-13)

The thirty-third holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–32 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31 and 32 passed every deciding criterion
and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is
published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: two new rounds of code search (28 queries), none repeated from holdouts 26–32. The first 14,
several aimed at checklist items earlier rounds left thin: `sveltekit-superforms`, `bits-ui`, `lucia`,
`@auth/sveltekit`, `@prisma/client`, `svelte-seo`, `@sveltejs/adapter-cloudflare` and `workspace:*` with
`@sveltejs/kit` in `package.json`; `schema.org` in Svelte files; `og:title` in route files;
`export const csr = false` in route modules; `paths: {` in `svelte.config.js`; `<svelte:head>` in
`src/lib/components`; and `$app/environment` in route files over 4 KB. They left 41 unread candidates, so
a second 14 followed: `svelte-i18n`, `@sveltejs/adapter-vercel`, `@sveltejs/adapter-static`,
`lucide-svelte`, `firebase`, `tailwind-variants` and `layerchart` with `@sveltejs/kit` in `package.json`;
`export async function load` in route modules over 3 KB; `error(404` in route modules; `goto(` in
`src/lib` Svelte files; `$derived(` in route files over 6 KB; `<svelte:window` in Svelte files;
`redirect(303` in TypeScript under `src`; and `handleFetch` in TypeScript. As in holdouts 16–32, the pool
is this round's searches only.

15,299 repositories came back; 50 no longer resolved. 5,982 remained after dropping 374 excluded
repositories (the corpus repositories and every candidate and runner-up of earlier holdouts) and 8,893
with no push in six months. GitHub's rate limit stopped the file listing of 985 of them, which were not
read. Of the other 4,997, 1,620 had at least 10 routes and a lockfile; 1,433 were on Svelte 5 and Kit 2;
1,309 remained after dropping 34 app directories named `docs`, `site`, `examples`, `templates`, `tests`,
`demo` or similar, and 90 copies or mirrors of an excluded app. 1,152 of the 1,309 had been read in an
earlier round, as far as the kept read list records (holdouts 9–32); none of those was read again or
taken. Of the 157 others, 30 belong to owners of excluded apps and were dropped; all 127 left were
shallow-cloned and read. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every
pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 35 of the 127 were rejected because runes are in half their
components or fewer. Seven otherwise fitting candidates were dropped: five because they commit two
lockfiles for one app, and two because their lockfile disagrees with `package.json`. Each pick's lockfile
was compared with its `package.json` on each declared range: all 14 agree. No pick has a `.gitmodules`
file, a committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                                           | Path              | Checklist    | Prerenders | Builds | Why                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [raymond-itsec/vulnledger](https://github.com/raymond-itsec/vulnledger/tree/fa19701ccc90)                                                     | `frontend`        | 1, 7, 9      | no         | yes    | Vulnerability ledger for security assessments (35 routes) on adapter-static, `ssr = false`, with JSON-LD.                                               |
| [PalmarHealer/opensax](https://github.com/PalmarHealer/opensax/tree/e5c0cb5c5ebd)                                                             | `apps/web`        | 8, 9, 11     | no         | yes    | School collaboration suite with mail, files and a wiki (18 routes) on adapter-node with hooks and form actions, in a workspace.                         |
| [jcsoftlabs/civora-backend](https://github.com/jcsoftlabs/civora-backend/tree/7168e754d506)                                                   | `apps/web`        | 1, 9, 10, 11 | no         | yes    | Membership and governance platform for political organisations (29 routes) on Vercel with JSON-LD, hooks and form actions, UI from a workspace package. |
| [dj-pearson/apidown](https://github.com/dj-pearson/apidown/tree/25b02930bb13)                                                                 | `frontend`        | 1, 9, 10     | no         | yes    | Public API status and incident tracker (32 routes) on Cloudflare with JSON-LD and hooks.                                                                |
| [orbingol/soju-platform](https://github.com/orbingol/soju-platform/tree/0a2c8d45d59f)                                                         | `apps/web`        | 6, 10        | yes        | no     | Korean-learning site (13 routes) on adapter-static under a computed `paths.base`, its routes prerendered.                                               |
| [f-elix/ironkit](https://github.com/f-elix/ironkit/tree/ad6abfc78e29)                                                                         | `.`               | 3, 7         | no         | no     | Strength-training tools and log (12 routes) on Vercel, `ssr = false`, with superforms.                                                                  |
| [CRCKC/BibleTogether](https://github.com/CRCKC/BibleTogether/tree/126f80e67cc4)                                                               | `.`               | 3, 6, 10     | no         | no     | Shared Bible-reading app (11 routes) on adapter-static under a computed `paths.base`, with superforms.                                                  |
| [M0okz/cairnops](https://github.com/M0okz/cairnops/tree/2604f074eb2d)                                                                         | `web`             | 5, 7, 9, 10  | no         | yes    | Infrastructure monitoring console (11 routes) on adapter-static, `ssr = false`, with markdown.                                                          |
| [Forest-Department-of-Belize/wildlife-permit-system](https://github.com/Forest-Department-of-Belize/wildlife-permit-system/tree/3bb4f59068a6) | `.`               | 9            | no         | yes    | Captive-wildlife permit management for a forestry department (55 routes) on Vercel with hooks and form actions.                                         |
| [War-Brokers/War-Brokers](https://github.com/War-Brokers/War-Brokers/tree/4eb25a0936fb)                                                       | `apps/stats-site` | 9, 11        | no         | yes    | Statistics site for an online game (16 routes) on adapter-node, in a workspace.                                                                         |
| [hxri-nxrxyxn/kalharam](https://github.com/hxri-nxrxyxn/kalharam/tree/5d6297b6a34f)                                                           | `web`             | 1, 9, 9b     | yes        | yes    | Online shop (19 routes) on adapter-node with JSON-LD and three prerendered routes.                                                                      |
| [JohnnyFFM/sideout](https://github.com/JohnnyFFM/sideout/tree/eaa497cb1d2b)                                                                   | `web`             | 6, 7, 9      | no         | yes    | Live volleyball scouting for coaches (13 routes) on adapter-static under a computed `paths.base`, `ssr = false`.                                        |
| [g2m7/gardensuite-marketing](https://github.com/g2m7/gardensuite-marketing/tree/f0008ae7dbd4)                                                 | `gs_landing`      | 1, 9, 9b     | yes        | yes    | Marketing site and guides for a tea-estate ERP (29 routes) on adapter-node with JSON-LD and hooks.                                                      |
| [Pikslots/pikslots](https://github.com/Pikslots/pikslots/tree/b1400d5929cb)                                                                   | `packages/ui`     | 3, 9, 10, 11 | no         | yes    | Booking platform (41 routes) on adapter-static with superforms, in a workspace.                                                                         |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 1    |
| 6   | `kit.paths.base`                            | 3    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 1    |
| 9   | likely builds without services              | 11   |
| 10  | component-resolution shapes                 | 6    |
| 11  | UI from a workspace package                 | 4    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 2, 4 and 12 have no app: the one candidate that emits alternate-language links was dropped for
its two lockfiles, and none of the 127 read uses a meta-tag library or renders its head from an npm
package.

## How the first look runs

As in holdouts 5–32, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: sideout MIT; soju-platform BSD-3-Clause; opensax and War-Brokers GPL-3.0; cairnops AGPL-3.0; vulnledger NOASSERTION; the other eight have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop soju-platform, ironkit and BibleTogether without their env files.
- Runners-up, read and not picked: lmf-git/gisaima-web, mylesglass/nz-gymnastics-results,
  Luksch187/bmw-calculation, UMC-Hungary/sermon-helper-applications, megaredb/smplabs and geota/crema.
