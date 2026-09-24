# v1 holdout 2 — selection (2026-09-24)

The second holdout for `2026-09-24-v1-release-criteria.md`. Holdout 1 failed and its 12 apps joined
the tuning corpus, so the criteria can only be claimed on apps nobody has tuned on. These 14 are
pinned in `scripts/corpus/holdout.json` and recorded here **before svelte-vitals has run on any of
them**. The first look is the next step, and the criteria are judged on that run only.

## How they were chosen

Search: GitHub repository search (`topic:sveltekit`, `topic:svelte5`, `topic:sveltekit2`) and code
search for each checklist library (`svelte-meta-tags`, `svelte-seo`, `sveltekit-superforms`,
`@inlang/paraglide-js`, `mdsvex`), `hreflang` and `application/ld+json` in `.svelte` files, and
`paths.base` in `svelte.config.js`. About 610 repositories came back. 337 were left after dropping
forks, archived repositories, repositories with no push in six months, and the 28 corpus apps. About
85 were checked through the GitHub API and 43 were read from a shallow clone; nothing was installed,
built or run.

Every app passes these filters:

- a real application: not a docs site, a component gallery, a starter template or a demo
- SvelteKit 2 and Svelte 5, with runes in most components
- a committed lockfile, at least 10 routes, and a push within six months

The most common rejections were Svelte 4, fewer than 10 routes, and runes in only a few files.
Candidates were chosen on the checklist and those filters only, never on a guess about the tool's
output.

## The 14 apps

Checklist numbers refer to the table below. "Builds" is a reading of the source (adapter, build-time
env and database access), not a build; the build-mode check (C2) finds out.

| App                                                                                                             | Path                | Checklist   | Builds | Why                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ------------------- | ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [strelov1/freehire](https://github.com/strelov1/freehire/tree/357088b4277d)                                     | `web`               | 1, 5, 9, 10 | yes    | Largest app in the set (123 routes). JSON-LD built in a helper and rendered by a `Seo` component; mdsvex posts; UI through `export * from` a linked workspace design system. |
| [JuiceBoxxGames/utsuwa](https://github.com/JuiceBoxxGames/utsuwa/tree/f6dcad9b6320)                             | `.`                 | 1, 5, 9, 10 | yes    | JSON-LD and a prerendered mdsvex blog; barrel and `$derived` component shapes.                                                                                               |
| [SkillsCat/skillscat](https://github.com/SkillsCat/skillscat/tree/cecb16529882)                                 | `apps/web`          | 1, 2        | yes    | `<link rel="alternate" hreflang>` in the head, JSON-LD, head content in `$lib` components.                                                                                   |
| [meshcore-ninja/meshcore-ninja](https://github.com/meshcore-ninja/meshcore-ninja/tree/cef2c91fc0bb)             | `.`                 | 1, 2, 9, 10 | yes    | hreflang alternates and JSON-LD; `$derived` component choice; likely builds.                                                                                                 |
| [WelcometoMyGarden/welcometomygarden](https://github.com/WelcometoMyGarden/welcometomygarden/tree/51c8c320e9dc) | `.`                 | 2, 10       | no     | i18n with hreflang alternates; `import * as` and barrels; preconnect and fonts in `app.html`.                                                                                |
| [itswadesh/svelte-commerce](https://github.com/itswadesh/svelte-commerce/tree/7dff73af6311)                     | `.`                 | 1, 3, 10    | yes    | adapter-node storefront with superforms and JSON-LD, and the widest spread of component shapes (`<svelte:component>`, `import * as`, barrels, `$derived`).                   |
| [chithi-dev/chithi](https://github.com/chithi-dev/chithi/tree/b53647156e38)                                     | `src/frontend`      | 3, 4, 9     | yes    | superforms and svelte-meta-tags in a nested app path; `import * as` and barrels.                                                                                             |
| [tradingstrategy-ai/frontend](https://github.com/tradingstrategy-ai/frontend/tree/06129ca54672)                 | `.`                 | 1, 4, 7, 9  | yes    | Large dashboard (108 routes) with `ssr = false` areas, svelte-meta-tags and JSON-LD.                                                                                         |
| [apchrme/phoxiv](https://github.com/apchrme/phoxiv/tree/5f5dcda625a6)                                           | `.`                 | 4, 5, 9, 10 | yes    | svelte-seo and an mdsvex blog; `import * as` and `$derived` component shapes.                                                                                                |
| [Django-CRM/Django-CRM](https://github.com/Django-CRM/Django-CRM/tree/7ef17056d131)                             | `frontend`          | 8, 9        | yes    | adapter-node with server hooks and form actions across many routes (90).                                                                                                     |
| [ZTL-ARTCC/scheddy](https://github.com/ZTL-ARTCC/scheddy/tree/29587e6fdbe8)                                     | `.`                 | 3, 8, 9     | yes    | adapter-node with hooks, form actions and superforms.                                                                                                                        |
| [logtide-dev/logtide](https://github.com/logtide-dev/logtide/tree/3c0c0bbf41ce)                                 | `packages/frontend` | 7, 9, 10    | yes    | Dashboard with `ssr = false`, UI from a workspace package, `import * as` and barrels.                                                                                        |
| [krmanik/Anki-xiehanzi](https://github.com/krmanik/Anki-xiehanzi/tree/6da570ecf920)                             | `.`                 | 6, 9        | yes    | Deployed under a non-empty `kit.paths.base`; adapter-static.                                                                                                                 |
| [EpicenterHQ/epicenter](https://github.com/EpicenterHQ/epicenter/tree/20e9f3b4af61)                             | `apps/whispering`   | 6, 7, 10    | yes    | `kit.paths.base`, an SPA, and UI from a workspace package that ships its source (`@epicenter/ui`).                                                                           |

## Checklist coverage

| #   | Item                               | Apps |
| --- | ---------------------------------- | ---- |
| 1   | JSON-LD                            | 6    |
| 2   | i18n + hreflang                    | 3    |
| 3   | superforms                         | 3    |
| 4   | meta-tag library                   | 3    |
| 5   | markdown/mdsvex blog               | 3    |
| 6   | `kit.paths.base`                   | 2    |
| 7   | large SPA/dashboard, `ssr = false` | 3    |
| 8   | adapter-node, hooks, form actions  | 2    |
| 9   | likely builds without services     | 10   |
| 10  | component-resolution shapes        | 8    |

Item 10 is new for this holdout. It targets the shapes behind most of holdout 1's false positives
(barrels, `import * as`, workspace UI packages, dynamic components), so it tests whether those fixes
generalise rather than re-finding the same apps' code.

## Rules without real-app evidence that these apps may exercise

C10 counts rules with at least one labelled finding; 62 of 105 have one now. Eight can never get
evidence under the default config (the six architecture rules, `a11y/required-element`,
`a11y/disallowed-element`). The signals below were found by grepping the source. A signal is not a
finding: it only says the rule has code to look at.

- `strelov1/freehire`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/orphan-effect, orphan-lifecycle; performance/preconnect; seo/json-ld-* (validity, required props, deprecated type); seo/json-ld-date-format
- `JuiceBoxxGames/utsuwa`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; seo/hreflang; seo/json-ld-* (validity, required props, deprecated type); seo/json-ld-date-format
- `SkillsCat/skillscat`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; performance/font-preload-crossorigin; performance/preconnect; performance/preload-missing-as; seo/hreflang; seo/json-ld-* (validity, required props, deprecated type); seo/json-ld-date-format
- `meshcore-ninja/meshcore-ninja`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/nonreactive-builtin-state; seo/hreflang; seo/json-ld-* (validity, required props, deprecated type)
- `WelcometoMyGarden/welcometomygarden`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; correctness/checkable-bind-value; performance/font-preload-crossorigin; performance/preconnect; seo/hreflang
- `itswadesh/svelte-commerce`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/nonreactive-builtin-state; correctness/orphan-effect, orphan-lifecycle; seo/json-ld-* (validity, required props, deprecated type); seo/json-ld-date-format
- `chithi-dev/chithi`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; correctness/checkable-bind-value; correctness/nonreactive-builtin-state
- `tradingstrategy-ai/frontend`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/orphan-effect, orphan-lifecycle; seo/json-ld-* (validity, required props, deprecated type); seo/json-ld-date-format
- `apchrme/phoxiv`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/orphan-effect, orphan-lifecycle
- `Django-CRM/Django-CRM`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/nonreactive-builtin-state; performance/font-preload-crossorigin; performance/preconnect
- `ZTL-ARTCC/scheddy`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; correctness/checkable-bind-value; correctness/nonreactive-builtin-state; correctness/orphan-effect, orphan-lifecycle
- `logtide-dev/logtide`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value; correctness/nonreactive-builtin-state
- `krmanik/Anki-xiehanzi`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; a11y/no-duplicate-dt; correctness/checkable-bind-value
- `EpicenterHQ/epicenter`: a11y/invalid-aria-value, unknown-aria-attribute, no-missing-id-ref; a11y/invalid-role; correctness/checkable-bind-value; correctness/orphan-effect, orphan-lifecycle

No candidate had `javascript:` URLs, `accesskey`, a positive `tabindex`, or browser globals in a load
function, so `security/javascript-url`, `a11y/no-accesskey`, `a11y/positive-tabindex` and
`correctness/server-browser-global` are unlikely to gain evidence from this holdout.

## Not picked

- nearcade: covered only item 1, which six picked apps cover
- openpost: needs bun, and logtide already covers a workspace-package dashboard
- rill `web-admin`: runes in only 73 of 331 components
- orbit, living-dictionaries, credimi, sveltesociety.dev: overlapped with picked apps and do not build without services
- wanderer: covered no checklist item

## Notes

- `svelte-commerce` is a storefront that others deploy. It is included as a product, and because it has
  the widest spread of component shapes.
- `epicenter` resolves `svelte` and `@sveltejs/kit` through a pnpm catalog (Svelte 5, Kit 2), and it
  installs with bun.
- chithi and tradingstrategy publish their source without a license file. The measurement reads the
  source and redistributes nothing.
