# v1 holdout 3 — selection (2026-09-25)

The third holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1 and 2 failed and their apps
joined the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: GitHub repository search by topic (`sveltekit`, `svelte5`, `sveltekit2`, `svelte-kit`,
`superforms`, `mdsvex`, `paraglide`, `runes`) and description, and code search for each checklist
library, `hreflang`, `application/ld+json`, `paths.base`, `accesskey` and `javascript:` hrefs. About
3,840 results became 2,305 repositories after dropping forks, archived repositories, repositories with
no push in six months, the 42 corpus apps and holdout 2's 22 candidates. 569 have a `svelte.config`,
at least 10 routes and a lockfile; 518 of them are on Svelte 5 and Kit 2; 104 were read from a shallow
clone. Nothing was installed, built or run.

The filters are the same as holdout 2's: a real application (not a docs site, component gallery,
template or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at
least 10 routes, and a push within six months. The most common rejections were runes in fewer than
half the components and fewer than 10 routes; five were copies of corpus apps.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                         | Path                    | Checklist      | Prerenders | Builds | Why                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ----------------------- | -------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| [hyvor/blogs](https://github.com/hyvor/blogs/tree/a78e7615c43e)                                             | `frontend`              | 1, 2, 7, 9, 10 | yes        | yes    | Blogging platform: JSON-LD, hreflang alternates, `ssr = false` console, prerendered pages, `javascript:` hrefs.             |
| [chipi/orrery](https://github.com/chipi/orrery/tree/f216622b46d7)                                           | `.`                     | 2, 9           | yes        | yes    | hreflang alternates and prerendered content pages; likely builds.                                                           |
| [glowingkitty/OpenMates](https://github.com/glowingkitty/OpenMates/tree/9f3228ef9ac3)                       | `frontend/apps/web_app` | 1, 2, 7, 9, 10 | yes        | yes    | JSON-LD, hreflang, prerendered pages, and UI from a workspace package that ships its source.                                |
| [josh-collinsworth/joco-sveltekit](https://github.com/josh-collinsworth/joco-sveltekit/tree/cf6ee85821af)   | `.`                     | 5, 9           | yes        | yes    | mdsvex blog, prerendered, with preconnect/preload in `app.html`.                                                            |
| [ow-mods/outerwildsmods.com](https://github.com/ow-mods/outerwildsmods.com/tree/2afa15fc3662)               | `.`                     | 1, 9           | yes        | yes    | JSON-LD and prerendered pages; client lodash. Its build fetches a public mod database.                                      |
| [openiap/core-web](https://github.com/openiap/core-web/tree/c3c8d8746374)                                   | `.`                     | 3, 6, 7, 10    | no         | no     | Deployed under `kit.paths.base` (`/ui`); superforms, `ssr = false`, a positive `tabindex`.                                  |
| [primocms/primo](https://github.com/primocms/primo/tree/f0db28a5a471)                                       | `.`                     | 6, 7, 10       | no         | no     | `kit.paths.base` (`/admin`) SPA with component-resolution variety; client lodash. No `vite.config`, so no build-mode check. |
| [scpwiki/wikijump](https://github.com/scpwiki/wikijump/tree/11231f37c3d3)                                   | `framerail`             | 3, 8, 9        | no         | yes    | adapter-node with hooks, form actions and superforms; `javascript:` hrefs.                                                  |
| [Bastian/bstats-web](https://github.com/Bastian/bstats-web/tree/76630c53babf)                               | `.`                     | 3, 4, 8, 9     | no         | yes    | adapter-node with hooks and actions, superforms and a meta-tag library.                                                     |
| [intuitem/ciso-assistant-community](https://github.com/intuitem/ciso-assistant-community/tree/2d7e695948b6) | `frontend`              | 3, 8, 9, 10    | no         | yes    | The largest app (198 routes): adapter-node, hooks, actions, superforms, barrels.                                            |
| [damoang/angple](https://github.com/damoang/angple/tree/16084b2c27ac)                                       | `apps/web`              | 1, 8, 9, 10    | no         | yes    | Large community site (128 routes): JSON-LD, adapter-node, and a module-level cache written in a server `load`.              |
| [SciSharp/BotSharp-UI](https://github.com/SciSharp/BotSharp-UI/tree/8ceb94109778)                           | `.`                     | 7, 9           | no         | yes    | Dashboard with `ssr = false`, `javascript:` hrefs and client lodash.                                                        |
| [QAStudio-Dev/studio](https://github.com/QAStudio-Dev/studio/tree/00b4599339ed)                             | `.`                     | 4, 5           | yes        | no     | Meta-tag library and markdown content with prerendered pages.                                                               |
| [spuithori/tokimekibluesky](https://github.com/spuithori/tokimekibluesky/tree/f0883fba527c)                 | `.`                     | 7              | no         | no     | Large SPA (83 routes) reading `window` in a universal `+layout.ts`.                                                         |

## Checklist coverage

| #   | Item                               | Apps |
| --- | ---------------------------------- | ---- |
| 1   | JSON-LD                            | 4    |
| 2   | i18n + hreflang                    | 3    |
| 3   | superforms                         | 4    |
| 4   | meta-tag library                   | 2    |
| 5   | markdown/mdsvex blog               | 2    |
| 6   | `kit.paths.base`                   | 2    |
| 7   | large SPA/dashboard, `ssr = false` | 6    |
| 8   | adapter-node, hooks, form actions  | 4    |
| 9   | likely builds without services     | 10   |
| 10  | component-resolution shapes        | 6    |
| 9b  | prerenders pages and likely builds | 5    |

Item 9b is new. Holdout 2 exercised build mode's rendered-HTML path on one app, because the rest
prerender nothing.

## Rules without real-app evidence that these apps may exercise

67 of 105 rules have evidence; eight cannot get any under the default config. Signals found by
grepping the source (a signal is not a finding):

- `security/javascript-url`: `javascript:` hrefs in hyvor/blogs, wikijump, BotSharp-UI
- `a11y/positive-tabindex`: openiap/core-web
- `correctness/server-browser-global`: tokimekibluesky reads `window` in a universal `+layout.ts`
- `security/handler-state-write`: angple writes a module-level cache in a server `load`
- `performance/preconnect`, `preload-missing-as`: joco-sveltekit, primo, tokimekibluesky
- `performance/heavy-import`: client lodash in primo, BotSharp-UI, ow-mods

No candidate uses `accesskey`, so `a11y/no-accesskey` is unlikely to gain evidence.

## Build-mode harness

C2 uses `scripts/holdout-build/`, which now also installs a `link:`/`file:` dependency that sits
outside the installed workspace.

## Notes

- primo has no `vite.config` (only `app.config.js`), so the harness cannot wrap it; it counts for the
  CLI criteria only.
- ow-mods' build fetches a public, unauthenticated database, so it needs network access.
- joco-sveltekit and ow-mods publish their source without a license file. The measurement
  reads the source and redistributes nothing.
