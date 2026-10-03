# v1 holdout 21 — result (2026-10-04)

Measured with `main` at db81d4d4 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-04-v1-holdout-21-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-21-2026-10-04.json`;
verdicts: `scripts/corpus/holdout-21-2026-10-04-verdicts.json` (5,316 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: not ready.** One of the nine deciding criteria fails: C6, on an `<h1>` in committed markdown
that a page renders with `{@html}`, in two apps. C3 passes with no false critical finding, C4 (98.2%)
and C5 (99.1%) pass, no rule falls under 90% under C7, and one key is `unclear` (0.02%). C8, published
without deciding the result, is 28.4%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 8 of which built | pass     | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 98.2% (1,901 / 1,936)                          | pass     | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.1% (2,221 / 2,241)                          | pass     | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                | fail     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (1 by the earlier definition)       | pass     | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 28.4% (798 / 2,813)                            | reported | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.02%)                                  | pass     | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns are the earlier definition, as published; the same holdouts under the current
one are in `2026-10-03-c7-multi-app.md` (holdout 18: 1; holdout 19: 1; holdout 20: none).

Verdicts (distinct keys): tp 4,200, fp 55, design 1,060, unclear 1.

C7 judges four rules, all above the threshold: `seo/single-h1` 94.1% (160 / 170, false positives from
banklab and Codex), and `seo/og-description`, `seo/og-image` and `seo/og-url` at 98.7% each (from
hundavaent and onelight). By the earlier definition `seo/duplicate-title` fails at 0% (0 / 2, 13
findings, 11 of them design; hundavaent).

## Critical findings (C3)

79 critical findings: 78 `title-presence`, all tp (minmat 51, chv 23, veli 2, homevermeylen 2), each
decided on its route's full render chain including the npm components it renders; and one
`server-browser-global`, labelled `design`: umpteenth's `src/demo/director.svelte.ts` reads
`matchMedia` at module scope, which is the shape the rule reports, but the module belongs to a separately
built client-only demo and the app sets `ssr = false` throughout, so it is never evaluated on the
server. The ledger's two earlier entries of this rule, both modules never evaluated on the server in
`ssr = false` apps, are `design` too; read as `fp`, it would fail C3.

## False-positive classes

| Class                                                                                                                  | Findings | Apps | Rules                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| **An `<h1>` in committed markdown a load imports with `?raw` and a page renders with `{@html}`** (marked, markdown-it) | 10       | 2    | **single-h1**                                                                                                  |
| Routes a `hooks.server.ts` handle redirects before `resolve()` (`/translations/*`), read as rendering                  | 40       | 1    | json-ld, description-presence, indexability, title-length, duplicate-title, og-\*, twitter-card, canonical-url |
| og tags a separate HTTP server injects into the built HTML of `/s/[slug]`                                              | 3        | 1    | og-description, og-url, og-image                                                                               |
| A component `{#if props.withHeading}` on an undestructured `let props = $props()`, not read as prop-decided            | 1        | 1    | id-duplication                                                                                                 |
| A bits-ui `Dialog.Title` heading role not taken as the heading before                                                  | 1        | 1    | heading-level-skip                                                                                             |

C6's class: banklab's nine content pages and Codex's `/docs/[topic]` each import a `.md` file whose body
starts with `# `, convert it with marked or markdown-it in the load, and output it with `{@html}`. The
`{@html}` heading class recurs: holdouts 15–17 and 20 met it in one app each; reading every `{@html}` as a
possible heading was measured after holdout 15 and withdrawn, as it lost hundreds of tp.

The hooks class is one app, but it reaches eleven rules. Its 24 og, twitter and canonical keys were
labelled `tp` and `design` by their group and are `fp` here, matching the group that labelled the same
routes' other rules and the ledger's precedent for a route a hook answers before it renders. With the
group's labels, C4 would be 99.0% and C5 99.5%; no criterion changes.

Seen while labelling, inside a key labelled `tp` by majority: chv's root layout renders the page bare
under `{#if isPublicRoute}`, a `$derived` of `publicPaths.some((p) => page.url.pathname.startsWith(p))`,
which the request-path reading does not decide, so `AppShell`'s `<main>` is counted on `/login` and
`/change-password` too (2 of the key's 19 routes).

## C2 in detail

GitHub Actions run 37132589783 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Eight builds completed: haweb (296 prerendered routes analyzed),
banklab (14), and homevermeylen, devnook-web, veli, chv, Codex and hundavaent with no prerendered page.
After the plugin ran, umpteenth's build was stopped by the plugin's own gate on its critical finding,
discord-wh-manager-v2's and dyad's failed on `$env` variables not set, and onelight's on an unbuilt
workspace package. Before the plugin ran, minmat's build stopped on `DATABASE_URL` not set and uprox's on
`POSTGRES_HOST` not set.

## Labelling notes

- The one `unclear` key: haweb's `/inventory/[...path]` `single-h1`. The page embeds HTML proxied from a
  separate Flask app into a shadow root; whether an `<h1>` arrives depends on which of its paths are
  served there and whether a shadow-root heading counts.
- The design share is concentrated in `description-presence` (269), `canonical-url` (262), `each-key`
  (143) and `raw-html` (62); devnook-web, chv, umpteenth and onelight together have 406 of the 798.
- Conventions the labellers applied but questioned:
  - og/twitter and JSON-LD are never `design`, while canonical and description are `design` on routes
    that are not search targets.
  - A sign-in page excluded only by `robots.txt` is `tp` for canonical (one precedent each way).
  - Long prose pages are `tp` for `component-size`; copied-in shadcn-svelte components are `tp` for
    `prop-count`.
  - Route components a separate demo build renders with hand-fed data are `design` for
    `route-component-import`, though the message's "without the data Kit would give it" is false there.
  - `sequential-awaits` after a 404 or 403 check is split in the ledger; a plain existence 404 was read
    as `tp` and a per-user authorization check as `design`.
  - A writable store's `.set` on a prop is `design` for `prop-mutation`.
  - An authored list filtered by live search input is `tp` for `each-key` (no earlier precedent).
  - `responsive-image` is `tp` for a raster smaller than its display size.
  - An unbound `<select required>` whose options' `selected` comes from a default value is `design`
    for `placeholder-label-option`, where the ledger has `tp` for the unbound shape.
- Analyzer gaps that did not change a verdict: `<center>` is reported by both `deprecated-element` and
  `permitted-contents`; an unrouted leftover `_+page.svelte` file is scanned as a component.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria again needs a
twenty-second holdout.
