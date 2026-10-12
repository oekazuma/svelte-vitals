# v1 holdout 32 — selection (2026-10-12)

The thirty-second holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–31 have each been judged
and their apps joined the tuning corpus; holdouts 20, 28, 30 and 31 passed every deciding criterion and
the others did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here
**before svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is
published but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules
whose false positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also
reports C7 under its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 26–31, several aimed at
checklist items earlier rounds left thin: `@supabase/supabase-js`, `valibot`, `@inlang/paraglide-js`,
`svelte-meta-tags`, `mdsvex`, `drizzle-orm` and `pocketbase` with `@sveltejs/kit` in `package.json`;
`hreflang` with `alternate` and `<svelte:element this=` in Svelte files; `application/ld+json` in
TypeScript under `src`; `page.params` with `$app/state` and `use:enhance` (over 5 KB) in route files;
`export const ssr = false` in route modules; and `createContext` with `svelte` in TypeScript under
`src/lib`. One page of the `hreflang` query failed on the network, so that query contributed its first
400 results. As in holdouts 16–31, the pool is this round's searches only.

8,323 repositories came back; 3,840 remained after dropping 269 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 4,214 with no push in six
months; 1,017 had at least 10 routes and a lockfile; 927 were on Svelte 5 and Kit 2; 886 remained after
dropping 14 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or similar,
and 27 copies or mirrors of an excluded app. 754 of the 886 had been read in an earlier round, as far as
the kept read list records (holdouts 9–31); none of those was read again or taken. Of the 132 others, 19
belong to owners of excluded apps and were dropped; all 113 left were shallow-cloned and read, fewer
than the 140 of earlier rounds. The 20 finalists (picks and runners-up) were re-fetched at pin time:
one pick had been pushed to after it was read, so it was cloned and read again at its new head, and
every pinned SHA equals the clone that was read. Nothing was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 6 of the 113 were rejected because more of their components use
`export let` than runes. Six otherwise fitting candidates were dropped: four because they commit two
lockfiles for one app, one because its lockfile disagrees with `package.json`, and one because it
commits a gitlink and its `.npmrc` points at a private registry. Each pick's lockfile was compared with
its `package.json` on each declared range: all 14 agree. No pick has a `.gitmodules` file, a committed
submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside
its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                               | Path           | Checklist    | Prerenders | Builds | Why                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | -------------- | ------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| [Finsys/dockhand](https://github.com/Finsys/dockhand/tree/e8c09b1eb666)                                           | `.`            | 5, 7, 9, 10  | no         | yes    | Docker management UI (21 routes) on adapter-node, `ssr = false`, with hooks and markdown.                  |
| [jesperorb/intl-explorer](https://github.com/jesperorb/intl-explorer/tree/d754e31fa265)                           | `.`            | 2, 9         | no         | yes    | Interactive explorer for the `Intl` APIs (14 routes) on Cloudflare with alternate-language links.          |
| [phonesett10401/thailand-dems](https://github.com/phonesett10401/thailand-dems/tree/d07d133dd854)                 | `web`          | 2, 7, 9, 10  | no         | yes    | Disaster and emergency management system (13 routes), `ssr = false`, with alternate-language links.        |
| [suchmememanyskill/mesh-organiser](https://github.com/suchmememanyskill/mesh-organiser/tree/08cdd95509ce)         | `.`            | 7, 9, 9b, 10 | yes        | yes    | 3D-model library (15 routes) on adapter-static, `ssr = false`, four routes prerendered.                    |
| [denlukia/plavna](https://github.com/denlukia/plavna/tree/f6e1a2e9e93e)                                           | `apps/plavna`  | 3, 5, 10, 11 | no         | no     | Animated publishing platform (12 routes) on Vercel with superforms and form actions, in a workspace.       |
| [Kage0x3B/capgo-update-lite](https://github.com/Kage0x3B/capgo-update-lite/tree/d0c0e98de8b8)                     | `packages/app` | 11           | no         | no     | Self-hosted update server for a mobile updater (10 routes) on Cloudflare, in a workspace.                  |
| [mbryzek/hackathon](https://github.com/mbryzek/hackathon/tree/ed720d62e4cc)                                       | `.`            | 7            | yes        | no     | Hackathon website (38 routes) on Cloudflare with form actions and a client-only voting area.               |
| [cirodam/resolute-society](https://github.com/cirodam/resolute-society/tree/3aca1bb6a7a4)                         | `.`            | 5, 8, 9      | no         | yes    | Association membership manager (55 routes) on adapter-node with hooks, form actions and 23 markdown files. |
| [SunReye/SunReye](https://github.com/SunReye/SunReye/tree/7324b5589f3a)                                           | `apps/web`     | 9, 10, 11    | no         | yes    | Home energy management (30 routes) on adapter-node, in a workspace.                                        |
| [MorganKryze/FabDoYouMeme](https://github.com/MorganKryze/FabDoYouMeme/tree/497ef06e87d4)                         | `frontend`     | 8, 9, 10     | no         | yes    | Self-hosted party game (27 routes) on adapter-node with hooks and form actions.                            |
| [DavidK276/empi](https://github.com/DavidK276/empi/tree/58092c01be53)                                             | `empi-web`     | 5, 8, 9, 10  | no         | yes    | Research-participation scheduler (28 routes) on adapter-node with hooks and form actions.                  |
| [StefanBerlin/splitclone](https://github.com/StefanBerlin/splitclone/tree/a4e049c3c0bc)                           | `.`            | 6, 7, 9      | no         | yes    | Expense splitter (17 routes) on adapter-static under a `paths.base`, `ssr = false`.                        |
| [Vermont-Complex-Systems/vcsi-website](https://github.com/Vermont-Complex-Systems/vcsi-website/tree/5bb1c83c14a9) | `.`            | 6, 9, 9b     | yes        | yes    | Research institute website (32 routes) on adapter-static under a computed `paths.base`.                    |
| [Ak-sara/sso](https://github.com/Ak-sara/sso/tree/9b6ff7595417)                                                   | `.`            | 5, 8, 9      | no         | yes    | Single-sign-on identity provider (36 routes) on adapter-node with OAuth, SCIM, hooks and form actions.     |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 0    |
| 2   | i18n + hreflang                             | 2    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 5    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 5    |
| 8   | adapter-node, hooks, form actions           | 4    |
| 9   | likely builds without services              | 11   |
| 10  | component-resolution shapes                 | 7    |
| 11  | UI from a workspace package                 | 3    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 2    |

Items 1, 4 and 12 have no app: none of the 113 read emits JSON-LD, uses a meta-tag library or renders
its head from an npm package.

## How the first look runs

As in holdouts 5–31, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: plavna, capgo-update-lite, empi and vcsi-website MIT; mesh-organiser and FabDoYouMeme GPL-3.0; SunReye AGPL-3.0; splitclone Unlicense; dockhand NOASSERTION; the other five have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop plavna, capgo-update-lite and hackathon without their env files.
- Runners-up, read and not picked: Profiidev/positron, ksiuwr/ksi-core, wilkinsantana/ondacast-admin,
  Junxiao-Liao/r-listener, esaramago/patrimoxi and AlyamanMas/beitbeitak.
