# v1 holdout 10 — selection (2026-09-29)

The tenth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–9 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: holdout 9's pool (the repository and code searches of holdouts 3–9 and holdout 5's discovery),
plus one new round of code search (12 queries) aimed at the shapes holdout 9's fixes and the heading
order change touched, and at the checklist items holdout 9 left empty: JSON-LD from `structuredData`
or a `jsonLd(…)` call next to `{@html`; an `<h3>` next to `PageHeader`, `SectionHeader`,
`SettingsSection` or `CardTitle`; an `<h1>` next to `Dialog.Title`; `{#if !` next to an `<h1>`; a
module-level `let` next to `browser` in a `+layout.ts`; `svelte-meta-tags` `MetaTags`; and
`package.json` files depending on a `@repo/ui` or `packages/ui` workspace package.

13,827 repositories came back; 6,979 remained after dropping the 192 of the 200 excluded repositories
that appeared (the 136 corpus repositories and every candidate and runner-up of earlier holdouts) and
6,656 with no push in six months; 2,199 had at least 10 routes and a lockfile; 1,990 were on Svelte 5
and Kit 2; 1,855 remained after dropping 64 app directories named `docs`, `site`, `examples`,
`templates`, `tests`, `demo` or similar, and 71 copies or mirrors of an excluded app. 456 of the 1,855
had been read in an earlier round; none of those was read again or taken. Of the 1,399 others, 470 had
a hit from the new searches; 140 of them were read from a shallow clone, taken round-robin across the
eleven shapes, highest-starred first. Push dates for the 11,650 repositories already in holdout 9's
pool came from that snapshot; the 2,177 new ones were fetched fresh. The 21 finalists (picks and
runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing
was installed, built or run.

The filters are unchanged: a real application (not a docs site, component gallery, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 11 of the 140 were rejected because more of their components
use `export let` than runes. Each pick's lockfile was compared with its `package.json` on each declared
range: all 14 agree. No pick has a `.gitmodules` file or an `.npmrc` registry.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                       | Path            | Checklist            | Prerenders | Builds | Why                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [arpi09/grocery-manager](https://github.com/arpi09/grocery-manager/tree/fcfd052f28a2)                     | `.`             | 1, 2, 8, 10          | no         | no     | JSON-LD from `{#each jsonLdBlocks}` in `MarketingSeoHead`; `x-default` alternate; 31 action files on adapter-node; `Card` renders its title with `<svelte:element>`. |
| [triskel-labs/localsnow-legacy](https://github.com/triskel-labs/localsnow-legacy/tree/3275667124d7)       | `.`             | 1, 2, 3, 5, 8, 9, 10 | no         | yes    | Snowsports booking site: sveltekit-i18n alternates with `x-default`, mdsvex, superforms, 37 action files; review JSON-LD from `{#each reviewSchemas}`.               |
| [pmh-only/welplan2](https://github.com/pmh-only/welplan2/tree/4eb7a342f89c)                               | `webapp`        | 1, 8, 9, 10          | no         | yes    | Canteen-menu web app: JSON-LD from `{#each jsonLd}` in the root layout (with `<` escaped); a `ko-KR` alternate; adapter-node with hooks and an action.               |
| [arkanere/solar-app](https://github.com/arkanere/solar-app/tree/84be045550b6)                             | `apps/main-app` | 1, 3, 10             | no         | no     | Solar marketplace with `[country=country]` routes; business JSON-LD from `{#each businessLDs}`; superforms.                                                          |
| [AxelDeneu/aden.solutions](https://github.com/AxelDeneu/aden.solutions/tree/101c467d6f41)                 | `.`             | 1, 2, 5, 10          | yes        | no     | Studio site: svelte-i18n `[[locale]]` routes with alternates, mdsvex, JSON-LD from `{#each structuredData}` in two places.                                           |
| [dldx/kissaten](https://github.com/dldx/kissaten/tree/232dde0a36c9)                                       | `frontend`      | 1, 3, 10             | no         | no     | Coffee database: `WebSite` JSON-LD built by a `safeJsonLdStringify` helper in the `(main)` layout; superforms.                                                       |
| [ygrip/raksara](https://github.com/ygrip/raksara/tree/ccd9ccfd5c4e)                                       | `sveltekit`     | 1, 10                | yes        | no     | Static blog: root `prerender = true` over 19 routes; JSON-LD from a `seo.ts` helper.                                                                                 |
| [company-of-heroes/app](https://github.com/company-of-heroes/app/tree/592503c38df7)                       | `packages/app`  | 7, 10, 11            | yes        | no     | Game companion app: UI from the workspace package `@company-of-heroes/ui`; `ssr = false`.                                                                            |
| [hoaxisr/awg-manager](https://github.com/hoaxisr/awg-manager/tree/e4bff4a7ed16)                           | `frontend`      | 3, 7, 9, 10          | no         | yes    | Router tunnel manager SPA: superforms; `SectionHeader`/`SettingsSection` headings; an `<h1>` behind `{#if mode === 'page'}`.                                         |
| [joeldesante/TurfBuilder](https://github.com/joeldesante/TurfBuilder/tree/c0de9d0ab8d6)                   | `.`             | 7, 8, 9, 10          | no         | yes    | Canvassing tool: 63 routes on adapter-node with hooks and actions; a `PageHeader` component renders the `<h1>`.                                                      |
| [obellprat/augur-hakesch](https://github.com/obellprat/augur-hakesch/tree/75fd9b9585f5)                   | `src/frontend`  | 6, 8, 10             | no         | no     | Literal `paths.base: '/abfluss'`; its root `+layout.ts` writes stores behind `browser`; adapter-node with 7 action files.                                            |
| [selfagency/open-communities](https://github.com/selfagency/open-communities/tree/b3b81fe1d774)           | `.`             | 3, 8, 9, 10          | no         | yes    | A 2.2 MB, 32,803-line component (`flex-render.svelte`); superforms and paraglide on adapter-node.                                                                    |
| [shuji-bonji/e-shiwake](https://github.com/shuji-bonji/e-shiwake/tree/2228be1b098a)                       | `.`             | 6, 9, 9b, 10         | yes        | yes    | Bookkeeping PWA: `paths.base` is `'/e-shiwake'` in production builds; dialogs; two prerendered route files.                                                          |
| [takara2314/3rd-tobamaru-lastyear](https://github.com/takara2314/3rd-tobamaru-lastyear/tree/298abb5c5802) | `.`             | 4, 10                | no         | no     | Team website whose head comes from `svelte-meta-tags` `MetaTags` in a local `MetaTags` component.                                                                    |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 7    |
| 2   | i18n + hreflang                             | 3    |
| 3   | superforms                                  | 5    |
| 4   | meta-tag library                            | 1    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 6    |
| 9   | likely builds without services              | 6    |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 1    |

Item 12 has no app: no unread candidate renders its head from an npm package the analyzer has no
adapter for. Item 6 counts augur-hakesch (a literal base) and e-shiwake (a literal under
`NODE_ENV === 'production'`, which a production build sets). Item 2 counts the two i18n apps with
alternates per locale (localsnow-legacy, aden.solutions) and grocery-manager's `x-default`; welplan2's
single `ko-KR` alternate is not counted.

Shapes the last fixes touched:

- **JSON-LD from `{#each}`:** grocery-manager (`jsonLdBlocks`), localsnow-legacy (`reviewSchemas`),
  welplan2 (`jsonLd`), solar-app (`businessLDs`) and aden.solutions (`structuredData`) — only some of
  these lists are named for JSON-LD.
- **Headings from components before a page's:** `SectionHeader`/`SettingsSection` (awg-manager),
  a `PageHeader` `<h1>` (TurfBuilder), a `<svelte:element>` title (grocery-manager's `Card`).
- **Store writes behind `browser`:** augur-hakesch's root `+layout.ts`.
- **A very large component:** open-communities's 2.2 MB `flex-render.svelte`.

## How the first look runs

As in holdouts 5–9, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets, now wrapping `.mjs` Vite configs as well.
The per-app results, in `holdout.json` order, make up the first-look file. An app whose install fails
is measured uninstalled, and the result records which apps were. The criteria and their thresholds are
unchanged.

## Notes

- License: solar-app, aden.solutions, awg-manager, augur-hakesch and e-shiwake are MIT, TurfBuilder
  GPL-3.0; grocery-manager and tobamaru carry a license GitHub does not classify; the other six have no
  license file. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop grocery-manager, solar-app, aden.solutions, raksara,
  company-of-heroes, augur-hakesch and tobamaru without their env files; kissaten's build script passes
  `--env-file=.env`, which the checkout does not have.
- Runners-up, read and not picked: JayantDevkar/claude-code-karma, Sudashiii/Sake, padelindex/padelindex,
  Escherbridge/plantcommerce, jansinger/ostsee-tiere, betagouv/pitchou and logscore/plank (its
  `bun.lock` disagrees with `package.json` on `bits-ui`).
