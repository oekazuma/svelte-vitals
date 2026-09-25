# v1 holdout 4 — selection (2026-09-25)

The fourth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–3 failed and their apps joined
the tuning corpus. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only.

## How they were chosen

Search: code search for workspace-package monorepos (`"@sveltejs/kit" "workspace:"` under `apps/`,
UI packages exporting `svelte`), for each checklist library, `hreflang`, `application/ld+json`,
`ssr = false`, `paths.base`, `accesskey` and `minify: false`, plus holdout 3's repository-search
pool. About 2,000 repositories came back; 1,153 remained after dropping forks, archived repositories,
repositories with no push in six months and the 71 excluded ones (the 56 corpus apps and holdouts 2
and 3's candidates); 783 had at least 10 routes and a lockfile; 739 were on Svelte 5 and Kit 2; 82
were read from a shallow clone. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component gallery, template or
demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. The most common rejections were legacy (non-runes) components
and workspace packages that ship only a built `dist`.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                               | Path               | Checklist         | Prerenders | Builds | Why                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ------------------ | ----------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| [civitai/civitai](https://github.com/civitai/civitai/tree/6ff7aff2ab52)                           | `apps/moderator`   | 8, 10, 11         | no         | yes    | adapter-node moderator app with hooks and actions; UI from the `@civitai/ui` workspace package, which ships source. |
| [pauljoda/Prismedia](https://github.com/pauljoda/Prismedia/tree/627958a491f5)                     | `apps/web-svelte`  | 7, 9, 10, 11      | no         | yes    | Static SPA-style app with `ssr = false`; UI from `@prismedia/ui-svelte` (source); a `treegrid` role.                |
| [flazouh/acepe](https://github.com/flazouh/acepe/tree/7706ea493779)                               | `packages/website` | 1, 10, 11         | no         | yes    | Website in a monorepo with JSON-LD (with dates) and UI from `@acepe/ui` (source); preconnect in `app.html`.         |
| [logdash-io/logdash.io](https://github.com/logdash-io/logdash.io/tree/3e7432d7c267)               | `apps/frontend`    | 1, 9, 10, 11      | yes        | yes    | Prerendered pages that build offline, JSON-LD, and UI from `@logdash/hyper-ui` (source).                            |
| [IcelandicIcecream/aphex](https://github.com/IcelandicIcecream/aphex/tree/1241575ad942)           | `apps/studio`      | 1, 10, 11         | no         | no     | CMS studio with JSON-LD and `@aphexcms/ui` `.svelte` source; a positive `tabindex`.                                 |
| [rleeon/hoard](https://github.com/rleeon/hoard/tree/1c147e0c7302)                                 | `web`              | 1, 2, 5, 9        | yes        | yes    | Prerendered static app with JSON-LD, hreflang alternates and markdown content.                                      |
| [torrust/torrust-website](https://github.com/torrust/torrust-website/tree/3ee3ae4089b0)           | `.`                | 6, 9              | yes        | yes    | Prerendered static site deployed under a base path.                                                                 |
| [Ratimon/openquok-monorepo](https://github.com/Ratimon/openquok-monorepo/tree/f5d2a1452819)       | `web`              | 1, 4, 5, 7, 10    | yes        | no     | Large app (123 routes) with svelte-meta-tags, JSON-LD, markdown and `ssr = false` areas.                            |
| [xKesvaL/kesval.com](https://github.com/xKesvaL/kesval.com/tree/1e188bdc8584)                     | `.`                | 2, 3, 4, 5, 9, 10 | yes        | no     | svelte-meta-tags with language alternates, superforms, and mdsvex content.                                          |
| [BlackbirdWorks/gopherstack](https://github.com/BlackbirdWorks/gopherstack/tree/ed13a01a3dfa)     | `ui`               | 6, 9, 10          | no         | yes    | Large static dashboard (162 routes) under a literal `kit.paths.base` (`/dashboard`).                                |
| [tp-link-extender/MercuryCore](https://github.com/tp-link-extender/MercuryCore/tree/b9acfa53ae57) | `Site`             | 3, 8              | no         | no     | adapter-node with hooks, actions and superforms; its `app.html` has no charset or viewport meta.                    |
| [temporalio/ui](https://github.com/temporalio/ui/tree/ffee0375c167)                               | `.`                | 3, 7, 9, 10       | no         | yes    | Large SPA (61 routes) with superforms, `ssr = false` and `$effect` in runes modules.                                |
| [greymass/unicove](https://github.com/greymass/unicove/tree/2cbc1c00728b)                         | `.`                | 1, 2, 10          | no         | yes    | Large app (119 routes) with JSON-LD and hreflang alternates; preconnect in `app.html`.                              |
| [sillsdev/appbuilder-portal](https://github.com/sillsdev/appbuilder-portal/tree/efa44e416c07)     | `.`                | 3, 8, 10          | no         | no     | adapter-node with hooks, form actions and superforms across 71 routes.                                              |

## Checklist coverage

| #   | Item                               | Apps |
| --- | ---------------------------------- | ---- |
| 1   | JSON-LD                            | 6    |
| 2   | i18n + hreflang                    | 3    |
| 3   | superforms                         | 4    |
| 4   | meta-tag library                   | 2    |
| 5   | markdown/mdsvex                    | 3    |
| 6   | `kit.paths.base`                   | 2    |
| 7   | large SPA/dashboard, `ssr = false` | 3    |
| 8   | adapter-node, hooks, form actions  | 3    |
| 9   | likely builds without services     | 7    |
| 10  | component-resolution shapes        | 11   |
| 11  | UI from a workspace package        | 5    |
| 9b  | prerenders pages and likely builds | 3    |

Item 11 is new. Workspace-package resolution was added after holdout 3 (it removed the last
`seo/title-presence` false positives on the corpus), so this holdout checks it on apps nobody has
tuned it on: 5 of the 14 import UI from a workspace package that ships `.svelte` source.

## Rules without real-app evidence that these apps may exercise

73 of 105 rules have evidence. Signals found by grepping the source (a signal is not a finding):

- `a11y/positive-tabindex`: aphex (`login/+page.svelte:375`)
- `seo/charset`, `seo/viewport`: MercuryCore's `app.html` has neither
- `a11y/invalid-role` / `a11y/unknown-aria-attribute`: unusual roles and `aria-roledescription` in Prismedia, temporal, kesval
- `correctness/orphan-effect`: `$effect` in `.svelte.ts` modules (civitai, temporal)
- `seo/json-ld-date-format`: JSON-LD with dates in acepe and hoard
- `performance/preconnect`: acepe, unicove, torrust

No candidate uses `accesskey`, an untitled `<abbr>`, or duplicate `<dt>`.

## Notes

- Prismedia (CC BY-NC-SA 4.0) and logdash (BUSL-1.0) read NOASSERTION on GitHub, and kesval.com has no
  license file. The measurement reads the source and redistributes nothing.
- aphex's workspace package exports a built `index.js`, so its build needs the package built first.
