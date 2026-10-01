# v1 holdout 15 — selection (2026-10-02)

The fifteenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–14 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only; C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`).

## How they were chosen

Search: the pool of holdouts 3–14 (as recorded in the carried-over repository metadata) plus one new
round of code search (12 queries) aimed at the shapes holdout 14's fixes touched and at the checklist
items it left empty: `_ENABLED = false` in `src/lib`; `page.url.pathname.startsWith` or
`$page.url.pathname` next to `{:else}` in route files; `aria-level` next to `heading` in `src/lib`;
`$bindable() as`; `Service = new` in `src/lib`; `<script src=` inside `<svelte:head>` in route files;
`svelte-meta-tags` and `svelte-seo` in `package.json`; a literal `paths.base`; `workspace:*` UI
packages; and `application/ld+json` in `src/lib`.

20,393 repositories came back, 1,648 of them new; 10,152 remained after dropping the 298 of the 305
excluded repositories that appeared (the corpus repositories and every candidate and runner-up of
earlier holdouts) and 9,942 with no push in six months; 2,802 had at least 10 routes and a lockfile;
2,533 were on Svelte 5 and Kit 2; 2,362 remained after dropping 68 app directories named `docs`,
`site`, `examples`, `templates`, `tests`, `demo` or similar, and 103 copies or mirrors of an excluded
app. 1,041 of the 2,362 had been read in an earlier round, as far as the read lists of holdouts 9–14
record (those of holdouts 5–8 are no longer available, so an app read and rejected then could be read
again; every pick and runner-up of those rounds stays excluded); none of those was read again or
taken. Of the 1,321 others, 188 had a hit from the new searches (2 belong to owners of excluded apps
and were dropped); 140 of them were read from a shallow clone, taken round-robin across the eight
shapes that had hits, highest-starred first. The meta-tag library, `paths.base` and workspace-UI
searches left no unread application with 10 routes. The 21 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 21 of the 140 were rejected because more of their components use
`export let` than runes. Three otherwise fitting candidates were dropped: one whose README presents it
as a SaaS boilerplate (tridigitals/ispmanagement), one whose `.npmrc` points at a private package
registry (JessePomeroy/angelsrest), and one whose lockfile disagrees with its `package.json`
(Djebreds/hisabin-web); doniandrian/Omniget-custom was left out as a copy of a pick. Each pick's
lockfile was compared with its `package.json` on each declared range: all 14 agree. No pick has a
`.gitmodules` file, an `.npmrc` registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                       | Path | Checklist       | Prerenders | Builds | Why                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ---- | --------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [OpenSelena/omniget](https://github.com/OpenSelena/omniget/tree/bad83311bf05)                             | `.`  | 7, 9, 10        | no         | yes    | Desktop download manager (108 routes, 547 components, `ssr = false` at the root): the root and `omnidisc` layouts render their children in URL-decided arms. |
| [motis-project/prima](https://github.com/motis-project/prima/tree/e7369576a951)                           | `.`  | 8, 10           | no         | no     | On-demand ride-booking system on adapter-node (29 routes, 21 action files): shadcn `CardTitle` headings with `role="heading"`, hooks and load gates.         |
| [iamernie/BookShelf](https://github.com/iamernie/BookShelf/tree/ae00cc9b2f8d)                             | `.`  | 8, 9, 10        | no         | yes    | Self-hosted book tracker (56 routes) on adapter-node: the root layout renders its children in two URL-decided arms; hooks and admin load gates.              |
| [gitaarik/smart-job-seeker](https://github.com/gitaarik/smart-job-seeker/tree/a881154e5488)               | `.`  | 5, 8, 10        | no         | yes    | Job-search assistant (105 routes, 51 action files) on adapter-node, with hooks and admin load gates.                                                         |
| [Wolfe-Jam/faf-one-svelte-new](https://github.com/Wolfe-Jam/faf-one-svelte-new/tree/b58db9c75df8)         | `.`  | 1, 5, 9, 9b, 10 | yes        | yes    | Product site on Cloudflare (273 routes, 5 prerendered files): JSON-LD in `app.html`, markdown content.                                                       |
| [RainyMrGab/comedy-connector-app](https://github.com/RainyMrGab/comedy-connector-app/tree/63206cc310e7)   | `.`  | 1, 10           | no         | no     | Comedy-scene directory (27 routes, 15 action files) on Netlify: an `SEO` component builds JSON-LD; a dev-login page redirects on a flag.                     |
| [domialbrecht/summit](https://github.com/domialbrecht/summit/tree/93ce5b9081db)                           | `.`  | 3, 8, 9, 10     | no         | yes    | Mountain-summit challenge app (33 routes) on adapter-node: superforms, an `(app)` layout gate, shadcn `AlertTitle` with `role="heading"`.                    |
| [Anquuni/duas-pro-frontend](https://github.com/Anquuni/duas-pro-frontend/tree/5ea841782d01)               | `.`  | 1, 2, 5, 10     | no         | no     | Prayer-text library in eight languages (`[[lang]]` routes): JSON-LD from an `SEOHead` component, hreflang alternates, shadcn `CardTitle` headings.           |
| [reddoorla/beachfront-dentistry](https://github.com/reddoorla/beachfront-dentistry/tree/b0e14c9e6789)     | `.`  | 1, 5, 9, 9b, 10 | yes        | yes    | Dental-practice site on Netlify: JSON-LD built in `{#each}`, `<svelte:element>` headings, a root layout with URL-decided arms, `role="heading"` heroes.      |
| [knicholson32/Contour](https://github.com/knicholson32/Contour/tree/140438d2b923)                         | `.`  | 10              | no         | no     | Flight logbook (25 routes, Prisma): the root layout renders its children in two URL-decided arms; shadcn `CardTitle` headings.                               |
| [fmadore/Website](https://github.com/fmadore/Website/tree/250c6bce6209)                                   | `.`  | 1, 5, 9, 9b, 10 | yes        | yes    | Academic website on adapter-static: JSON-LD from a `JsonLd` component, `<svelte:element>` bibliography headings, markdown content.                           |
| [nickhildebrandt/twincars-manager](https://github.com/nickhildebrandt/twincars-manager/tree/0b9ea1cdf3cc) | `.`  | 9, 10           | no         | yes    | Business ERP system (51 routes) on adapter-node: the root layout renders its children in two URL-decided arms.                                               |
| [SE-UUlm/snowballr-frontend](https://github.com/SE-UUlm/snowballr-frontend/tree/70fbec489f3b)             | `.`  | 7, 9, 10        | no         | yes    | Literature-review tool (24 routes, `ssr = false` at the root): shadcn `CardTitle`/`AlertTitle` with `role="heading"`, a gRPC client service in `src/lib`.    |
| [dnnsmnstrr/muenstererOS](https://github.com/dnnsmnstrr/muenstererOS/tree/43b655952aa9)                   | `.`  | 3, 5, 7, 10     | yes        | no     | Personal site built from shadcn components (43 routes): superforms, markdown, a `ssr = false` page, a root layout with URL-decided arms.                     |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 5    |
| 2   | i18n + hreflang                             | 1    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 6    |
| 6   | `kit.paths.base`                            | 0    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 8    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 4, 6, 11 and 12 have no app: the meta-tag library, `paths.base` and workspace-UI searches found no
unread application that passed the filters, and every candidate's `paths.base` read was an empty
string or an environment variable.

Shapes the last fixes touched:

- **Layouts rendering their children in URL-decided arms:** omniget, BookShelf, beachfront-dentistry,
  Contour, twincars-manager, muenstererOS.
- **`role="heading"` (shadcn `CardTitle`/`AlertTitle`, a hero component):** prima, summit,
  duas-pro-frontend, beachfront-dentistry, Contour, snowballr-frontend, muenstererOS.
- **A load redirecting on a flag:** comedy-connector-app's dev-login page (`if (!IS_LOCAL)`); omniget
  exports `_ENABLED = false` study-feature flags.

## How the first look runs

As in holdouts 5–14, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged;
C8 is reported without deciding the result.

## Notes

- License: omniget, smart-job-seeker and snowballr-frontend GPL-3.0; BookShelf, faf-one, Contour and
  fmadore's Website MIT; the other seven have no license GitHub classifies. The measurement reads the
  source and redistributes nothing.
- Builds: `$env/static` imports stop prima, comedy-connector-app, duas-pro-frontend and muenstererOS
  without their env files; Contour needs a generated Prisma client.
- Runners-up, read and not picked: LordLuceus/chat-lounge, joshdevous/treetag,
  jasoncluck/BombasticLimited, TNRIS/iswp, c-danil0o/gym_manager, wizmer/caf-planning and
  moughamir/dex.
