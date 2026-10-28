# v1 holdout 44 — selection (2026-10-27)

The forty-fourth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–43 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30, 31, 32, 34 and 37–43 passed every deciding
criterion and the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded
here **before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8
is published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (28 queries), none repeated from holdouts 29–43: `svelte-sonner`,
`mode-watcher`, `paneforge`, `@xterm/xterm`, `@octokit/rest`, `bullmq`, `fflate`, `@sentry/sveltekit`,
`kysely`, `@event-calendar/core`, `formsnap` and `isomorphic-dompurify` with `@sveltejs/kit` in
`package.json`; `<optgroup`, `<datalist`, `<meter`, `<abbr`, `role="menu"`, `aria-pressed`,
`aria-invalid`, `rel="canonical"` and `PageProps` in Svelte files; `tabindex="-1"` in
`src/lib/components`; `beforeNavigate` in route Svelte files, and `$derived.by` there over 4 KB;
`error(400` and `export const entries` in TypeScript route modules; and `redirect(307` and `ServerInit`
in TypeScript. As in holdouts 16–43, the pool is this round's searches only.

The 12,638 results named 12,637 repositories, and one of them did not resolve. 7,012 remained after
dropping 480 excluded repositories (the corpus repositories and every candidate and runner-up of earlier
holdouts), one archived repository and 5,144 with no push in six months. GitHub's hourly rate limit cut
the file listing short; it was rerun after the limit reset, after which one repository still could not be
listed. 1,642 had at least 10 routes and a lockfile; 1,463 were on Svelte 5 and Kit 2, after dropping five
whose `package.json` could not be read; 1,304 remained after dropping 24 app directories named `docs`,
`site`, `examples`, `templates`, `tests`, `demo` or similar, and 135 copies or mirrors of an excluded app.
1,196 of the 1,304 had been read in an earlier round, as far as the kept read list records (holdouts
9–43); none of those was read again or taken. Of the 108 others, 36 belong to owners of excluded apps and
were dropped; all 72 left were shallow-cloned and read. As in holdouts 38–43, every clone's source files
were compared with the corpus clones, `components/ui/` left out; no candidate shares source files with a
corpus app. The 20 finalists (picks and runners-up) were re-fetched at pin time, and every pinned SHA
equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 12 of the 72 were rejected because runes are in half their
components or fewer. Three were dropped as not fitting: the core package of a CMS (a library), a lab
website whose README names a different canonical repository, and an app modified from another project.
Nine otherwise fitting candidates were dropped: two commit a gitlink (one of them also a lockfile that
disagrees with `package.json`), four commit a lockfile that disagrees with `package.json` (one of them
also a second lockfile), and three commit two lockfiles. Each pick's lockfile was compared with its
`package.json` on each declared range: all 14 agree. No pick has a committed submodule (gitlink), an
`.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                               | Path             | Checklist   | Prerenders | Builds | Why                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ---------------- | ----------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [claytonkruse/minewolf](https://github.com/claytonkruse/minewolf/tree/e94985948814)               | `.`              | 1, 3, 5, 8  | no         | no     | Minecraft server list (28 routes) on adapter-node with JSON-LD, superforms, markdown, hooks and form actions.                             |
| [jwt625/lithium-niobate](https://github.com/jwt625/lithium-niobate/tree/9183730a830b)             | `.`              | 1, 5, 9, 9b | yes        | yes    | Reference site about the lithium niobate crystal (85 routes) on adapter-static with JSON-LD and mdsvex.                                   |
| [ICOM-DOC-EP-WG/blog](https://github.com/ICOM-DOC-EP-WG/blog/tree/bc2f3c83dcbb)                   | `.`              | 5, 6, 9, 9b | yes        | yes    | Blog of a museum documentation working group (12 routes) on adapter-static under an environment-set `paths.base`, with mdsvex.            |
| [owlgraph-dev/owlgraph](https://github.com/owlgraph-dev/owlgraph/tree/ddc9a4becae7)               | `.`              | 7, 8, 9, 10 | no         | yes    | Semantic knowledge-graph workspace (32 routes) on adapter-node with hooks and form actions, one route `ssr = false`.                      |
| [21nCo/skillplane](https://github.com/21nCo/skillplane/tree/d971cd950a22)                         | `app`            | 9, 11       | no         | yes    | Management and delivery platform for versioned AI-agent skills (32 routes) on adapter-cloudflare with hooks, UI from a workspace package. |
| [GDGAAU/online-therapy](https://github.com/GDGAAU/online-therapy/tree/35c1d13cea86)               | `front-end`      | 3, 9        | no         | yes    | Frontend of an online therapy platform (27 routes) on adapter-auto with superforms, backed by a separate API.                             |
| [kurashizu/cf-blog](https://github.com/kurashizu/cf-blog/tree/69447a57e773)                       | `landing-worker` | 9, 9b       | yes        | yes    | Landing site of a personal blog with AI-agent tools (11 routes) on adapter-cloudflare with hooks.                                         |
| [mstreicher98/Monsipan-Intern](https://github.com/mstreicher98/Monsipan-Intern/tree/4ad65e02359e) | `.`              | 8, 9        | no         | yes    | Internal operations portal for a building-protection company (73 routes) on adapter-node with hooks and form actions.                     |
| [conzani/cons-system](https://github.com/conzani/cons-system/tree/d5c27e45359a)                   | `.`              | 8           | no         | no     | In-house operations system for a construction contractor (40 routes) on adapter-node with hooks and form actions.                         |
| [QmangaTeam/qmanga](https://github.com/QmangaTeam/qmanga/tree/60dc4f7089f5)                       | `apps/web`       | 9, 9b, 10   | yes        | yes    | Kazakh-language manga platform (50 routes) on adapter-node with hooks.                                                                    |
| [BlueprintLabIO/restless-core](https://github.com/BlueprintLabIO/restless-core/tree/b475dbde8ff5) | `web`            | 7, 9, 10    | no         | yes    | Shared workspace for people and AI agents (46 routes) on adapter-static, `ssr = false`.                                                   |
| [thbertoldi/harpia](https://github.com/thbertoldi/harpia/tree/d0f79de10f60)                       | `frontend`       | 7, 9, 10    | no         | yes    | Multi-tenant AI task-management platform (14 routes) on adapter-node with hooks, part `ssr = false`.                                      |
| [nuin/popgenesjs](https://github.com/nuin/popgenesjs/tree/6d3098f51d45)                           | `.`              | 9, 9b       | yes        | yes    | Browser-only population-genetics simulation suite for teaching (41 routes) on adapter-static.                                             |
| [mixeme/wynd](https://github.com/mixeme/wynd/tree/0f04d476ce53)                                   | `web`            | 7, 9        | no         | yes    | Self-hosted journal for small private groups (101 routes) on adapter-static, `ssr = false`, embedded in a Go binary.                      |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 2    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 4    |
| 11  | UI from a workspace package                 | 1    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 5    |

Items 2, 4 and 12 have no app: the one candidate with alternate-language links commits a gitlink and a
lockfile that disagrees with `package.json`, and no candidate uses a meta-tag library or a head set
through an npm package.

## How the first look runs

As in holdouts 5–43, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: popgenesjs MIT; restless-core and harpia Apache-2.0; lithium-niobate GPL-3.0; owlgraph AGPL-3.0; wynd commits a license GitHub does not classify; the other eight have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop minewolf without its env file, and cons-system imports a Prisma client that its `build` script does not generate.
- Runners-up, read and not picked: tahayvr/tond, bayurstarcool/SigardaPanel, Hafiz-Mhf/mlbb-analytics,
  codecoradev/trapfall, FerrahWolfeh/lanforge and Kovarsta/project-task-manager.
