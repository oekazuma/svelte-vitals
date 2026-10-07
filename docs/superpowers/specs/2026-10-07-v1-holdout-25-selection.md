# v1 holdout 25 — selection (2026-10-07)

The twenty-fifth holdout for `2026-09-24-v1-release-criteria.md`. Holdouts 1–24 have each been judged
and their apps joined the tuning corpus; holdout 20 passed every deciding criterion and holdouts 21–24
did not. These 14 apps are pinned in `scripts/corpus/holdout.json` and recorded here **before
svelte-vitals has run on any of them**. The criteria are judged on the first look only. C8 is published
but does not decide the result (`2026-10-01-c8-design-share.md`), and C7 judges only rules whose false
positives come from two or more apps (`2026-10-03-c7-multi-app.md`); the result also reports C7 under
its earlier definition.

## How they were chosen

Search: one new round of code search (14 queries), none repeated from holdouts 23 and 24 except two of
holdout 24's broadest, restricted by a larger file size: `svelte-i18n`, `svelte-seo`,
`@tanstack/svelte-query`, `lucia` and `firebase` with `@sveltejs/kit` in `package.json`;
`@sveltejs/adapter-netlify` in `package.json`; `hreflang` with `alternate` in components;
`handleFetch` in `hooks.server.ts`; `export const csr = false` in route modules; `<svelte:window` in
route files; `svelte/transition` in `src/lib/components`; `deserialize` with `$app/forms` in components;
and `use:enhance` and `error(404` with `export const load` in route files, restricted by file size. The
last page of the Netlify query timed out, so that query contributed 900 of its first 1,000 results. As
in holdouts 16–24, the pool is this round's searches only.

7,798 repositories came back, one of which no longer exists; 2,894 remained after dropping 226 excluded repositories (the corpus
repositories and every candidate and runner-up of earlier holdouts) and 4,677 with no push in six
months; 1,172 had at least 10 routes and a lockfile; 1,041 were on Svelte 5 and Kit 2; 990 remained
after dropping 4 app directories named `docs`, `site`, `examples`, `templates`, `tests`, `demo` or
similar, and 47 copies or mirrors of an excluded app. 619 of the 990 had been read in an earlier round,
as far as the kept read list records (holdouts 9–24); none of those was read again or taken. Of the 371
others, 15 belong to owners of excluded apps and were dropped; 140 were taken round-robin across the
queries, highest-starred first, shallow-cloned and read. The 21 finalists (picks and runners-up) were
re-fetched at pin time, and every pinned SHA equals the clone that was read. Nothing was installed,
built or run.

The filters are unchanged: a real application (not a docs site, component library, template, starter
or demo), SvelteKit 2 and Svelte 5 with runes in most components, a committed lockfile, at least 10
routes, and a push within six months. 28 of the 140 were rejected because more of their components use
`export let` than runes. Three otherwise fitting candidates were dropped because their lockfile
disagrees with `package.json` (one also commits a submodule), one because it installs `file:`
dependencies outside its checkout, and one because it commits a submodule. Each pick's lockfile was
compared with its `package.json` on each declared range: all 14 agree. No pick has a `.gitmodules`
file, a committed submodule (gitlink), an `.npmrc` pointing at a private registry or a `file:`/`link:`
dependency outside its checkout.

## The 14 apps

"Prerenders" and "Builds" are readings of the source, not builds; the build-mode check (C2) finds
out.

| App                                                                                                           | Path                         | Checklist          | Prerenders | Builds | Why                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| [infosave2007/aivpn](https://github.com/infosave2007/aivpn/tree/3553767443e5)                                 | `platforms/aivpn-web/client` | 7, 9, 10           | no         | yes    | Web client of a VPN product (10 routes) on adapter-static, `ssr = false`.                   |
| [bsv-blockchain/teranode](https://github.com/bsv-blockchain/teranode/tree/581b600dd791)                       | `ui/dashboard`               | 7, 9, 10, 9b       | yes        | yes    | Blockchain node dashboard (13 routes) on adapter-static with hooks, two prerendered routes. |
| [openstate/jodal](https://github.com/openstate/jodal/tree/917918a2702a)                                       | `frontend`                   | 5, 8, 9, 10        | no         | yes    | Government-document search for journalists (15 routes) on adapter-node: markdown, actions.  |
| [nikolat/nos-haiku](https://github.com/nikolat/nos-haiku/tree/4a284c2027bc)                                   | `.`                          | 9, 10              | no         | yes    | Nostr web client (17 routes) with hooks and prop-decided headings.                          |
| [kmc7468/arkvault](https://github.com/kmc7468/arkvault/tree/b35585c7bb55)                                     | `.`                          | 9, 10              | no         | yes    | Encrypted media vault (17 routes) on adapter-node with hooks.                               |
| [nagringa-dev/matilha-builders](https://github.com/nagringa-dev/matilha-builders/tree/ebb3aa4db019)           | `apps/web`                   | 9, 10              | no         | yes    | Founders' weekly check-in tool (12 routes) on Vercel with workspace packages and hooks.     |
| [datasektionen/cashflow](https://github.com/datasektionen/cashflow/tree/f5d2731dec02)                         | `frontend`                   | 9, 10              | no         | yes    | Receipt and reimbursement manager (29 routes) with hooks and form actions.                  |
| [chloepriceless/proxmox-gui](https://github.com/chloepriceless/proxmox-gui/tree/e485bc4371e5)                 | `frontend`                   | 3, 5, 7, 9, 10     | no         | yes    | Self-hosted virtualisation portal (24 routes) on adapter-node: superforms, markdown.        |
| [vibeunion/supauth](https://github.com/vibeunion/supauth/tree/3b41d09dc50d)                                   | `packages/admin-console`     | 6, 7, 9, 10, 9b    | yes        | yes    | Auth-service admin console (43 routes) under `paths.base`, `ssr = false`, prerendered.      |
| [w3c-cg/sstim](https://github.com/w3c-cg/sstim/tree/6421fe84843f)                                             | `.`                          | 1, 5, 6, 9, 10, 9b | yes        | yes    | Community-group standard site (16 routes) under a `paths.base`: JSON-LD, markdown.          |
| [kasra-org/ieum](https://github.com/kasra-org/ieum/tree/052d9014d0c7)                                         | `frontend`                   | 8, 9, 10           | no         | yes    | Conference management system (27 routes) on adapter-node with 16 action files.              |
| [n9d0g/fcc](https://github.com/n9d0g/fcc/tree/a277f14c2d6a)                                                   | `.`                          | 1, 10              | no         | no     | Church website (35 routes) on Cloudflare with a CMS: JSON-LD, hooks.                        |
| [hayhaydz/offline-finance-dashboard](https://github.com/hayhaydz/offline-finance-dashboard/tree/b7ce3e453c2f) | `.`                          | 8, 9, 10           | no         | yes    | Local-only finance dashboard (46 routes) on adapter-node with 26 action files.              |
| [henryj-dev/lodestar](https://github.com/henryj-dev/lodestar/tree/eb15f010a445)                               | `.`                          | 9, 10              | no         | yes    | Identity provider (39 routes) on Cloudflare with hooks and 35 action files.                 |

## Checklist coverage

| #   | Item                                        | Apps |
| --- | ------------------------------------------- | ---- |
| 1   | JSON-LD                                     | 2    |
| 2   | i18n + hreflang                             | 0    |
| 3   | superforms                                  | 1    |
| 4   | meta-tag library                            | 0    |
| 5   | markdown/mdsvex                             | 3    |
| 6   | `kit.paths.base`                            | 2    |
| 7   | large SPA/dashboard, `ssr = false`          | 4    |
| 8   | adapter-node, hooks, form actions           | 3    |
| 9   | likely builds without services              | 13   |
| 10  | component-resolution shapes                 | 14   |
| 11  | UI from a workspace package                 | 0    |
| 12  | head from an npm package without an adapter | 0    |
| 9b  | prerenders pages and likely builds          | 3    |

Items 2 and 4 have no app: the `hreflang` and `svelte-seo` queries left no unread application that
passed the filters, and the one read app with alternate-language links commits a submodule. The
workspace packages seen (matilha-builders, supauth) hold no components (item 11).

## How the first look runs

As in holdouts 5–24, the first look is measured installed, with the harness in `scripts/holdout-build/`
on GitHub-hosted runners with no token scopes and no secrets. An app whose install fails is measured
uninstalled, and the result records which apps were.

## Notes

- License: jodal and proxmox-gui MIT; sstim and lodestar Apache-2.0; arkvault and ieum AGPL-3.0; cashflow GPL-3.0; nos-haiku CC0-1.0; aivpn and teranode NOASSERTION; the other four have no license GitHub classifies. The measurement reads the source and redistributes nothing.
- Builds: `$env/static` imports stop fcc without its env files.
- Runners-up, read and not picked: codebude/librislog, TheRomanXpl0it/TRXd, jonkristian/artistack,
  ApolloFiles/Apollo, jnnsyah/nesagalearning, connorcam302/whos-playing-too and Twijn/krawlet.
