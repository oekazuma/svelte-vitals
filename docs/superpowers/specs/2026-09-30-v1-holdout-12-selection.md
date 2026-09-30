# v1 holdout 12 — selection (2026-09-30)

The twelfth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–11 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: the pool of holdouts 3–11 (as recorded in the carried-over repository metadata) plus one new
round of code search (12 queries) aimed at the shapes holdout 11's fixes touched and at the checklist:
`document.title =` next to `$effect` or `onMount`; `setContext(` next to a getter over `$state`; a
layout with `{@render children()}` and a lazy `<img>`; `{:else if` next to `{@render children()}` and an
`<h1>`; `use:portal`; `{#await}` next to an `<h1>`; `application/ld+json` next to `hreflang`; an
`x-default` alternate; and `svelte-seo`, `@svelte-put/metatags` and `svead` in `package.json`.

16,458 repositories came back, 847 of them new; 8,316 remained after dropping the 235 of the 242
excluded repositories that appeared (the corpus repositories and every candidate and runner-up of
earlier holdouts) and 7,906 with no push in six months; 2,468 had at least 10 routes and a lockfile;
2,237 were on Svelte 5 and Kit 2; 2,090 remained after dropping 68 app directories named `docs`,
`site`, `examples`, `templates`, `tests`, `demo` or similar, and 79 copies or mirrors of an excluded
app. 694 of the 2,090 had been read in an earlier round; none of those was read again or taken. Of the
1,396 others, 236 had a hit from the new searches (3 more belong to owners of excluded apps and were
dropped); 140 of them were read from a shallow clone, taken round-robin across the nine shapes that
had hits, highest-starred first. The 21 finalists (picks and runners-up) were re-fetched at pin time,
and every pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 9 of the 140 were rejected because more of their components use
`export let` than runes. Each pick's lockfile was compared with its `package.json` on each declared
range: all 14 agree. Two otherwise fitting candidates were dropped because theirs do not. No pick has a
`.gitmodules` file, an `.npmrc` registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                     | Path       | Checklist       | Prerenders | Builds | Why                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [obot-platform/obot](https://github.com/obot-platform/obot/tree/fb4b094cc164)                                           | `ui/user`  | 5, 7, 9, 10     | yes        | yes    | AI governance console (77 routes, 430 components) on adapter-node; a project layout shares `$state` through `setContext` getters.                                    |
| [official-tisao/image.complianttools.com](https://github.com/official-tisao/image.complianttools.com/tree/4caae891f007) | `apps/web` | 1, 2, 9, 9b, 10 | yes        | yes    | Image-tools site: 136 routes, 53 prerendered; every tool page renders JSON-LD and an `en` alternate; a workspace engine package.                                     |
| [glen-spilbraet/portal](https://github.com/glen-spilbraet/portal/tree/d7b7725b6322)                                     | `.`        | 7, 9, 10        | no         | yes    | Sales portal (orders, catalogues, price lists, planograms): the root layout and a `ssr = false` planogram page set `document.title` from `$effect`.                  |
| [mobilars/epj](https://github.com/mobilars/epj/tree/18078a4357b2)                                                       | `.`        | 8, 9, 10        | no         | yes    | Patient-record system on adapter-node with hooks and 31 action files; a patient layout renders its children in two `{:else if}` arms and an `<h1>` in the last.      |
| [jbndrf/ueberblick](https://github.com/jbndrf/ueberblick/tree/b903ee4f389a)                                             | `.`        | 3, 5, 8, 9, 10  | no         | yes    | Map-based workflow app: superforms, 15 action files, a participant layout with context getters, a `use:portal` multi-select.                                         |
| [hkarlsen06/ampoteket](https://github.com/hkarlsen06/ampoteket/tree/909b9f29f640)                                       | `.`        | 2, 5, 9, 10     | no         | yes    | Inventory and sales system with `[[locale=locale]]` routes, alternates with `x-default`, context getters and `<svelte:element>` titles.                              |
| [disnet/skyreader](https://github.com/disnet/skyreader/tree/89d73c6a2774)                                               | `frontend` | 5, 7, 9, 10     | no         | yes    | RSS reader for the AT Protocol (38 routes); tooltips and inputs portal their popups with `use:portal`.                                                               |
| [sunnypilot/sunnylink-frontend](https://github.com/sunnypilot/sunnylink-frontend/tree/7edbc84f605e)                     | `.`        | 7, 10           | yes        | no     | Device-management SPA (`ssr = false` at the root): six modals rendered through `use:portal`; `paths.base` from `BASE_PATH`.                                          |
| [Stoat-Labs/Stoat](https://github.com/Stoat-Labs/Stoat/tree/25a4246c4022)                                               | `apps/web` | 9, 10           | no         | yes    | Workspace app (467 components) on adapter-node with five workspace packages; a stepper shares `$state` through context getters.                                      |
| [yavuzilyas/laf](https://github.com/yavuzilyas/laf/tree/7cecd0693965)                                                   | `.`        | 1, 2, 3, 9, 10  | no         | yes    | Foundation site with `[lang]` routes: an `SEO` component renders JSON-LD and alternates with `x-default`; superforms.                                                |
| [mary-ext/anartia](https://github.com/mary-ext/anartia/tree/c94521e42564)                                               | `.`        | 7, 10           | no         | no     | Public Bluesky frontend (28 routes): a profile layout renders a lazy image before its children.                                                                      |
| [hammadmajid/silroad](https://github.com/hammadmajid/silroad/tree/590e0a0a0a25)                                         | `.`        | 3, 9, 10        | no         | yes    | Event-organizer platform: superforms, 13 action files, a feed with three `{#await}` blocks under its `<h1>`.                                                         |
| [tanvoid0/portal-desktop](https://github.com/tanvoid0/portal-desktop/tree/65689c8040d7)                                 | `.`        | 3, 5, 7, 9, 10  | no         | yes    | Developer desktop app (92 routes, 653 components, `ssr = false`); the settings layout renders an `<h1>`, then its children in the last arm of an `{:else if}` chain. |
| [Ileies/hacibaba](https://github.com/Ileies/hacibaba/tree/dc27556b6c08)                                                 | `.`        | 1, 2, 8, 9, 10  | no         | yes    | B2B webshop on adapter-node with 11 action files; JSON-LD in the root layout and product pages; a `de` alternate with `x-default`.                                   |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 4    |
| 3   | superforms                                  | 4    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 0    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 1    |

Items 4, 6, 11 and 12 have no app this round. The meta-tag library searches returned no unread
application with 10 routes; the only `paths.base` among the picks comes from an environment variable
(sunnylink), which the analyzer does not resolve; Stoat's and image.complianttools's workspace
packages ship no Svelte components. Item 2 counts the four apps whose alternates depend on a locale.

Shapes the last fixes touched:

- **`document.title` set from `$effect`:** glen-spilbraet/portal, in the root layout and in a
  `ssr = false` page.
- **`$state` shared through getters:** `setContext` getters in obot, ueberblick, ampoteket and Stoat.
- **Layout images around `{@render children()}`:** anartia's profile layout.
- **Children in `{:else if}` arms:** epj, ampoteket, portal-desktop.
- **`use:portal`:** ueberblick, skyreader, sunnylink.
- **`{#await}` blocks next to an `<h1>`:** silroad's feed.

## How the first look runs

As in holdouts 5–11, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were. The criteria and their thresholds are unchanged.

## Notes

- License: obot and silroad MIT, epj and skyreader AGPL-3.0, Stoat Apache-2.0, anartia BSD-3-Clause;
  the other eight have no license GitHub classifies. The measurement reads the source and
  redistributes nothing.
- Builds: `$env/static/public` imports stop sunnylink and anartia without their env files.
- Runners-up, read and not picked: fabian-thies/cookify, nscaledev/uni-ui, dash-chat/dash-chat,
  fin-research/dashboard, cosformula/mdxport, smichea/science-explorer and inspektor-gadget/ig-desktop.
