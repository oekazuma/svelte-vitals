# v1 holdout 24 — selection (2026-10-05)

The twenty-fourth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–23 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdout 23
failed C3 and C6. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdout 23 except two of its
broadest queries restricted by file size to reach past the 1,000 results code search returns: `use:enhance` in route
files; `error(404` with `export const load` in route modules; `@auth/sveltekit`, `pocketbase`,
`@inlang/paraglide-js` and `mdsvex` with `@sveltejs/kit` in `package.json`;
`@sveltejs/adapter-vercel` in `package.json`; `fallback` with `adapter-static` in `svelte.config.js`;
`export const prerender = true` in route modules; `svelte:boundary` in components; `createContext` in
`src/lib`; `goto(` with `$app/navigation` in `src/lib/components`; and form actions with `fail(` and
`$derived.by(` in route files, restricted by file size. As in holdouts 16–23, the pool is this round's
searches only.

9,449 repositories came back; 4,079 remained after dropping 249 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 5,120 with no push in six
months; 1,380 had at least 10 routes and a lockfile; 1,254 were on Svelte 5 and Kit 2; 1,177 remained
after dropping 17 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 60 copies or mirrors of an excluded app. 790 of the 1,177 had been read in an earlier
round, as far as the kept read list records (holdouts 9–23); none of those was read again or taken. Of
the 387 others, 23 belong to owners of excluded apps and were dropped; 140 were taken round-robin
across the queries, highest-starred first, shallow-cloned and read. The 21 finalists (picks and
runners-up) were re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing
was installed, built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 11 of the 140 were rejected because more of their components use
`export let` than runes. Two otherwise fitting candidates were dropped because their lockfile disagrees
with `package.json`, one because it installs a `file:` dependency outside its checkout, one because it
installs from a second registry, and one desktop
app because it models a fictional organisation with seeded demo personas. Each pick's lockfile was
compared with its `package.json` on each declared range: all 14 agree. No pick has a `.gitmodules`
file, an `.npmrc` pointing at a private registry or a `file:`/`link:` dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                                   | Path             | Checklist       | Prerenders | Builds | Why                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- | ---------- | ------ | ---------------------------------------------------------------------------------------- |
| [banbox/banbot](https://github.com/banbox/banbot/tree/cd037c767c08)                                                   | `web/ui`         | 9, 10, 9b       | yes        | yes    | Web UI of a trading bot (22 routes) with hooks and a prerendered route.                  |
| [sunburnco/sunburn](https://github.com/sunburnco/sunburn/tree/e6e0690a8989)                                           | `pwa`            | 7, 9, 10        | no         | yes    | Self-hosted chat, voice and video client (18 routes) on adapter-static, `ssr = false`.   |
| [alensiljak/cashier-sveltekit](https://github.com/alensiljak/cashier-sveltekit/tree/04ce73501239)                     | `.`              | 7, 9, 10, 9b    | yes        | yes    | Personal finance app (94 routes) on adapter-static, `ssr = false`.                       |
| [MFergie121/kali-afl-stats](https://github.com/MFergie121/kali-afl-stats/tree/b50577b77926)                           | `.`              | 1, 8, 9, 10     | no         | yes    | Sports statistics site (26 routes) on adapter-node: JSON-LD, hooks, form actions.        |
| [adaptocms/adapto-sveltekit-client](https://github.com/adaptocms/adapto-sveltekit-client/tree/691af5f12934)           | `.`              | 9, 10           | no         | yes    | Multi-language CMS client (18 routes) under a `[lang]` route parameter.                  |
| [FRC5800/MagicScouting](https://github.com/FRC5800/MagicScouting/tree/4635e36eabba)                                   | `.`              | 9, 10, 9b       | yes        | yes    | Robotics-competition scouting app (19 routes), translated, six prerendered routes.       |
| [aleapc/guia-guangzhou](https://github.com/aleapc/guia-guangzhou/tree/fcf2a1697912)                                   | `.`              | 6, 9, 10, 9b    | yes        | yes    | Multi-language offline travel guide (15 routes) under a `paths.base`, prerendered.       |
| [SigurdurVilhelmsson/namsbokasafn-vefur](https://github.com/SigurdurVilhelmsson/namsbokasafn-vefur/tree/3dbf50b22938) | `.`              | 9, 10, 9b       | yes        | yes    | Textbook reader (24 routes) on adapter-static with fifteen prerendered routes.           |
| [BjornKennethHolmstrom/website](https://github.com/BjornKennethHolmstrom/website/tree/d7c8fc9ce6f0)                   | `.`              | 5, 9, 10, 9b    | yes        | yes    | Personal and project site (158 routes) on adapter-static with markdown content.          |
| [rakharamadhana/halal-ima-taiwan](https://github.com/rakharamadhana/halal-ima-taiwan/tree/40c62a9f2810)               | `.`              | 3, 10           | no         | no     | Certification registry (15 routes): superforms, hooks and ten action files.              |
| [karaberke/my-kitchen](https://github.com/karaberke/my-kitchen/tree/a37ce2f8a8e3)                                     | `.`              | 1, 8, 9, 10     | no         | yes    | Self-hosted recipe and pantry app (20 routes) on adapter-node: JSON-LD, 20 action files. |
| [gofreeil/community](https://github.com/gofreeil/community/tree/efe177a26835)                                         | `my_new_project` | 1, 10           | no         | no     | Neighbourhood community board (74 routes): JSON-LD, hooks and 33 action files.           |
| [KK92-Inc/KKApp](https://github.com/KK92-Inc/KKApp/tree/7d9fe9ab8e67)                                                 | `App.Frontend`   | 9, 10           | no         | yes    | Peer-learning platform (35 routes) on adapter-node with hooks.                           |
| [vtes-biased/archon-vibe](https://github.com/vtes-biased/archon-vibe/tree/df77d4e51d66)                               | `frontend`       | 5, 7, 9, 10, 9b | yes        | yes    | Offline-first tournament app (20 routes) on adapter-static: markdown, `ssr = false`.     |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 3    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 2    |
| 6   | `kit.paths.base`                            | 1    |
| 7   | large SPA/dashboard, `ssr = false`          | 3    |
| 8   | adapter-node, hooks, form actions           | 2    |
| 9   | likely builds without services              | 12   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 7    |

Item 2 has no app: three picks are translated (adapto client's `[lang]` parameter, MagicScouting's
translation package, guia-guangzhou's multi-language guide), but none emits alternate-language links,
so hreflang stays untested. Item 4 has no app: none of the 140 read uses a meta-tag library, and the
workspace packages seen hold no components (item 11).

## How the first look runs

As in holdouts 5–23, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: banbot and cashier-sveltekit AGPL-3.0; sunburn and the Holmström website MIT; namsbokasafn-vefur and KKApp NOASSERTION; the other eight have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop halal-ima-taiwan and community without their env files.
- Runners-up, read and not picked: tacone/rssreader, mi-1000/LitteratIA, waitingonsunday/blento,
  xemu-cartographer/xemu-cartographer, Cattn/Maple, nfras4/nfras4arcade and oyvhov/world-cup-pool.
