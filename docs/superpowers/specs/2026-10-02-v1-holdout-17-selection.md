# v1 holdout 17 — selection (2026-10-02)

The seventeenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–16 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only; C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`).

## How they were chosen

Search: one new round of code search (12 queries) aimed at the shapes holdout 16's fixes touched and
at the checklist items earlier rounds left thin: `{ get, set` in `src/lib/server`; `.initialize()` in
a module exporting `load`; `{:else}` next to `<CardTitle` in route files; `svelte-meta-tags`, `svead`
and `svelte-seo` in `package.json`; `hreflang` with `alternate`; `@inlang/paraglide` next to
`@sveltejs/kit`; `paths` with `base:` in `svelte.config.js`; `workspace:*` next to `@sveltejs/kit`;
`application/ld+json` in route files; and `sveltekit-superforms`. As in holdout 16, the pool is this
round's searches only.

5,063 repositories came back; 2,328 remained after dropping 157 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts), one that no longer exists and
2,577 with no push in six months; 695 had at least 10 routes and a lockfile; 614 were on Svelte 5 and
Kit 2; 582 remained after dropping 22 app directories named `docs`, `site`, `examples`, `templates`,
`tests`, `demo` or similar, and 10 copies or mirrors of an excluded app. 394 of the 582 had been read in
an earlier round, as far as the kept read list records (holdouts 9–16; those of holdouts 5–8 are no
longer available, so an app read and rejected then could be read again; every pick and runner-up of
those rounds stays excluded); none of those was read again or taken. Of the 188 others, 15 belong to
owners of excluded apps and were dropped; 140 were taken round-robin across the queries that had hits,
highest-starred first, shallow-cloned and read. The 19 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 14 of the 140 were rejected because more of their components use
`export let` than runes. Four otherwise fitting candidates were dropped: three whose lockfile disagrees
with their `package.json` (Thunder-Blaze/Zafkiel, vuthanhtrung2010/simple-lms, Lavescar-dev/clinic-crm)
and one with a `file:` dependency (mgkdante/yesid.dev). Each pick's lockfile was compared with its
`package.json` on each declared range: all 14 agree. No pick has a `.gitmodules` file, an `.npmrc`
pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                 | Path          | Checklist              | Prerenders | Builds | Why                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| [Null-Signal-Games/nrdbv2](https://github.com/Null-Signal-Games/nrdbv2/tree/f79bdc6f487d)                           | `.`           | 7, 8, 10               | yes        | no     | Card-game database (28 routes) on adapter-node: hooks, form actions, eight `ssr = false` routes.                  |
| [LemonTV-win/LemonTV](https://github.com/LemonTV-win/LemonTV/tree/56476be74840)                                     | `.`           | 1, 10                  | no         | no     | Esports information site (35 routes, 16 action files) on Cloudflare: JSON-LD, prop-decided headings.              |
| [SamsterZero/Granthalay](https://github.com/SamsterZero/Granthalay/tree/c3dfe7c9e245)                               | `.`           | 3, 6, 7, 9, 10, 9b     | yes        | yes    | Local-first EPUB library PWA (12 routes) on adapter-static: superforms, a `paths.base`, prop-decided headings.    |
| [dledger-com/dledger](https://github.com/dledger-com/dledger/tree/b1360568fd8a)                                     | `.`           | 5, 7, 9, 10            | no         | yes    | Double-entry accounting app (25 routes), `ssr = false`, `.svelte.ts` modules returning their `$state`.            |
| [0base-vc/whoearns-live](https://github.com/0base-vc/whoearns-live/tree/52e9b3979f05)                               | `ui`          | 1, 2, 7, 10            | yes        | no     | Validator income transparency site (10 routes): JSON-LD, hreflang alternates, six prerendered routes.             |
| [PISSARAW/Black-Whale](https://github.com/PISSARAW/Black-Whale/tree/be7b9415623f)                                   | `apps/web`    | 1, 2, 8, 9, 10, 11     | no         | yes    | Interactive story archive (27 routes) on adapter-node: JSON-LD built in `{#each}`, hreflang, workspace packages.  |
| [sashplatonov/habit-runner](https://github.com/sashplatonov/habit-runner/tree/9ac59e2b6561)                         | `apps/web`    | 1, 2, 5, 7, 9, 10, 9b  | yes        | yes    | Habit app's site (22 routes): JSON-LD, hreflang, a markdown blog, ten prerendered routes.                         |
| [notkimroberts/family-reunion](https://github.com/notkimroberts/family-reunion/tree/86c92c30159f)                   | `.`           | 3, 5, 8, 9, 10         | no         | yes    | Family-reunion organiser (20 routes, 10 action files) on adapter-node with superforms and hooks.                  |
| [getzenai/untitledconference](https://github.com/getzenai/untitledconference/tree/b76e97646a3c)                     | `.`           | 3, 5, 9, 10            | no         | yes    | Conference programme platform (55 routes, 30 action files) on Cloudflare with superforms and markdown.            |
| [Kripta-Studios/ja-automation-platform](https://github.com/Kripta-Studios/ja-automation-platform/tree/fd53da19af02) | `apps/portal` | 6, 8, 9, 10, 11        | no         | yes    | Multilingual field-operations portal (25 routes) on adapter-node: a `paths.base`, workspace packages.             |
| [RajeshPandey057/orderhive](https://github.com/RajeshPandey057/orderhive/tree/ebc489feadd0)                         | `.`           | 1, 3, 10               | no         | no     | Order and sales operations platform (37 routes) with superforms, JSON-LD and hooks.                               |
| [oblivion8282-1337/pulse](https://github.com/oblivion8282-1337/pulse/tree/87ed1bd5c8ef)                             | `web`         | 5, 7, 9, 10            | no         | yes    | Social app front end (32 routes), `ssr = false`, many snippets and `.svelte.ts` modules returning their `$state`. |
| [dotsem/dotsem.be](https://github.com/dotsem/dotsem.be/tree/5cf8d813b57f)                                           | `portfolio`   | 1, 2, 5, 9, 10, 12, 9b | yes        | yes    | Personal site (10 routes) on Netlify: Paraglide's `ParaglideJS` component writes the alternates into the head.    |
| [davideastmond/gov-vote](https://github.com/davideastmond/gov-vote/tree/4c25275abd74)                               | `.`           | 9, 10                  | no         | yes    | Election workflow platform (25 routes) with hooks and form actions.                                               |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 6    |
| 2   | i18n + hreflang                             | 4    |
| 3   | superforms                                  | 4    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 6    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 10   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 2    |
| 12  | head from an npm package without an adapter | 1    |
| 9b  | prerenders pages and likely builds          | 3    |

Item 4 has no app: the meta-tag library searches left no unread application that passed the filters.

Shapes the last fixes touched:

- **A file with an `{:else}` and an `{#if a && b}` test** (the arm-selection reading): 13 of the 14,
  most in pulse, ja-automation-platform, dledger, LemonTV and Black-Whale.
- **A `.svelte.ts` module that creates a `$state` and `return`s a binding:** LemonTV, Granthalay,
  dledger, untitledconference and pulse.
- **An object of a module's own functions written with `.set()`, and a load awaiting a method of an
  object it created:** none found by the searches among the picks.

## How the first look runs

As in holdouts 5–16, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged;
C8 is reported without deciding the result.

## Notes

- License: Granthalay, whoearns-live, Black-Whale, habit-runner and untitledconference MIT; the other
  nine have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop nrdbv2, LemonTV, whoearns-live and orderhive without their env
  files.
- Runners-up, read and not picked: split-share/splitshare, kongesque/locus-vision,
  NuBlox/NuBlox-Digital-Applications-V3, stickerdaniel/hackUPC and proc-hetta/coratella.
