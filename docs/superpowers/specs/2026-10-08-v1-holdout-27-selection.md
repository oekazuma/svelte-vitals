# v1 holdout 27 — selection (2026-10-08)

The twenty-seventh holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–26 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdouts 21–26
did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 24–26: `mode-watcher`,
`svelte-sonner`, `@lucide/svelte`, `formsnap`, `kysely`, `mongoose` and `wrangler` with `@sveltejs/kit`
in `package.json`; `getRequestEvent` and `$app/server` with `command(` in TypeScript under `src`;
`beforeNavigate` in route files; `<svelte:element` in `src/lib`; `aria-current` in
`src/lib/components`; `rel="canonical"` in route files; and `export const config` in route modules. As
in holdouts 16–26, the pool is this round's searches only.

6,739 repositories came back, one of which no longer exists; 3,139 remained after dropping 208 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 3,391 with no push in six
months; 982 had at least 10 routes and a lockfile; 881 were on Svelte 5 and Kit 2; 809 remained after
dropping 11 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar,
and 61 copies or mirrors of an excluded app. 619 of the 809 had been read in an earlier round, as far as
the kept read list records (holdouts 9–26); none of those was read again or taken. Of the 190 others, 20
belong to owners of excluded apps and were dropped; 140 were taken round-robin across the queries,
highest-starred first, shallow-cloned and read. The 20 finalists (picks and runners-up) were re-fetched
at pin time, and every pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 15 of the 140 were rejected because more of their components use
`export let` than runes. One otherwise fitting candidate was dropped because its lockfile disagrees with
`package.json`, two because they install `file:` dependencies (one of them also from a private
registry), two more because they commit a submodule, and one because its README describes it as a
fictional demonstration project. Each pick's lockfile was compared with its `package.json` on each
declared range: all 14 agree. No pick has a `.gitmodules` file, a committed submodule (gitlink), an
`.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                                     | Path       | Checklist       | Prerenders | Builds | Why                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| [The-Robotics-Catalyst-Foundation/ct-ftc-website](https://github.com/The-Robotics-Catalyst-Foundation/ct-ftc-website/tree/8323c71cb09c) | `.`        | 1, 5, 8, 10     | no         | no     | Regional robotics-league site (24 routes) on adapter-node: JSON-LD, hooks, 13 action files. |
| [michaelbonner/bootpack-digital](https://github.com/michaelbonner/bootpack-digital/tree/6b85d289892d)                                   | `.`        | 1, 10           | yes        | no     | Agency website (24 routes) on a Bun adapter with JSON-LD built in `{#each}`.                |
| [mbocek/syam-web](https://github.com/mbocek/syam-web/tree/712d61ae4281)                                                                 | `.`        | 1, 5, 7, 9, 9b  | yes        | yes    | Personal-finance dashboard (13 routes) on adapter-static with JSON-LD and markdown.         |
| [Manta-Epitech-Academy/jump](https://github.com/Manta-Epitech-Academy/jump/tree/04d06dcd53ee)                                           | `frontend` | 3, 5, 8         | no         | no     | Coding-school platform (58 routes) on adapter-node: superforms, 40 action files, markdown.  |
| [CarloMicieli/rusty-shed](https://github.com/CarloMicieli/rusty-shed/tree/b95e2eca519a)                                                 | `.`        | 3, 5, 7, 9, 9b  | yes        | yes    | Scale-model collection manager (20 routes) on adapter-static with superforms.               |
| [EmKaCe/scipro_review](https://github.com/EmKaCe/scipro_review/tree/efd2eabea1c6)                                                       | `frontend` | 6, 7, 9, 10, 9b | yes        | yes    | Notebook-grading assistant (11 routes) on adapter-static under a `paths.base`.              |
| [LkMasterhub/defisAsso](https://github.com/LkMasterhub/defisAsso/tree/cdb4a8b72c79)                                                     | `.`        | 6, 8, 9, 10     | no         | yes    | Association website (11 routes) on adapter-node under a computed `paths.base`.              |
| [openprx/sylvode](https://github.com/openprx/sylvode/tree/b35d8f2f27a7)                                                                 | `frontend` | 7, 9, 10        | no         | yes    | Project-management app (45 routes) on adapter-static, `ssr = false`.                        |
| [BrettM86/coves-frontend](https://github.com/BrettM86/coves-frontend/tree/02c35021886d)                                                 | `.`        | 5, 7, 9, 10     | no         | yes    | Forum client for an atProto network (27 routes) with prop-decided headings.                 |
| [chickendude/Kalenj.in](https://github.com/chickendude/Kalenj.in/tree/1356bbc0f1da)                                                     | `.`        | 8, 10           | no         | no     | Dictionary, corpus and reader for a language (38 routes) on adapter-node, 22 action files.  |
| [JonasLeonhard/jonasleonhard.de](https://github.com/JonasLeonhard/jonasleonhard.de/tree/6e7d494ae2cb)                                   | `.`        | 9, 9b           | yes        | yes    | Personal site (35 routes) on adapter-static, prerendered.                                   |
| [dennisklappe/CloudMeet](https://github.com/dennisklappe/CloudMeet/tree/5a9f0e3c8ec2)                                                   | `.`        | 9               | no         | yes    | Meeting scheduler (11 routes) on Cloudflare with form actions.                              |
| [Omaledanjumaogale/SchoolXense](https://github.com/Omaledanjumaogale/SchoolXense/tree/e7cc567cece8)                                     | `.`        | 1, 7, 9         | no         | yes    | Computer-based testing platform (80 routes) on Cloudflare with JSON-LD and hooks.           |
| [DeVinci-FabLab/SmartLock-Dashboard](https://github.com/DeVinci-FabLab/SmartLock-Dashboard/tree/6311a5324385)                           | `web`      | 3, 9            | no         | yes    | Stock and resupply dashboard (24 routes) on adapter-node with superforms.                   |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 4    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 3    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 6    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 10   |
| 10  | component-resolution shapes                 | 7    |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 4    |

Items 2, 4, 11 and 12 have no app: of the 140 read, the one that emits alternate-language links is a
demonstration site, none uses a meta-tag library, and none renders UI or its head from a workspace or
npm package.

## How the first look runs

As in holdouts 5–26, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: bootpack-digital, defisAsso, CloudMeet and SmartLock-Dashboard MIT; rusty-shed and sylvode Apache-2.0; scipro_review AGPL-3.0; coves-frontend and Kalenj.in NOASSERTION; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop ct-ftc-website and bootpack-digital without their env files; jump and Kalenj.in use Prisma, whose client has to be generated before they build.
- Runners-up, read and not picked: sayem314/devo, raflyzainn/pfriends, Mauznemo/CrypthoraChat,
  NorskHelsenett/prism, lukaslerche/bookwaves and DavidJChavez/toolbox.
