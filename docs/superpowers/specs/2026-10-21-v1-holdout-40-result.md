# v1 holdout 40 — result (2026-10-21)

Measured with `main` at 23fa7755 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-21-v1-holdout-40-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-40-2026-10-21.json`;
verdicts: `scripts/corpus/holdout-40-2026-10-21-verdicts.json` (3,823 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 and C5
at 100.0%, no false-positive class, no rule judged under C7, and one key `unclear`. It is the first
holdout with no false positive. C8, published without deciding the result, is 38.7%. The release decision
stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 14 apps, 10 of which built | pass     | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 100.0% (1,323 / 1,323)                          | pass     | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 100.0% (1,504 / 1,504)                          | pass     | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                            | pass     | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (none below 90% by the earlier one) | pass     | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 38.7% (838 / 2,163)                             | reported | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.03%)                                   | pass     | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 2,829, fp 0, design 993, unclear 1.

C7 judges no rule: no rule has a false positive. By the earlier definition no rule with ten or more
findings falls under 90%.

## Critical findings (C3)

Nine critical findings. Widgetry's seven `title-presence`: 2 tp (`/sign-in` and `/sign-up`, which render
for signed-out visitors and set no title) and 5 `design` (the `/dev` routes, which return 404 unless
`dev`). mangrove's two `server-browser-global` (`theme.svelte.ts` reads `document` and `matchMedia` at
module scope) are `design`: the rule checks runes modules whatever the routes' `ssr`, as documented, and
mangrove is an adapter-static SPA with a root `ssr = false`, so the read never runs on a server.

## The one unclear key

flow-weaver's `admin/artifacts/[id]/+page.svelte:281` (`performance/iframe-loading`) is an
`<iframe srcdoc sandbox>` preview that fetches no document. Whether `loading="lazy"` changes anything for
a `srcdoc` frame is a question of browser behaviour, not of the source; the ledger's four earlier
`srcdoc` keys are `unclear` too.

## C2 in detail

GitHub Actions run 39613578533 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14
apps installed. The plugin ran on all 14 and crashed on none. Ten builds completed: matchup (22 prerendered
routes skipped as `ssr = false`), repose (29 skipped), swing-dance-moves (10 skipped), and rforum,
flow-weaver, lab-ztp-provisioner, maroid, controle-financeiro, concord and gofin-full with
no prerendered page. mangrove's build stopped on the plugin's own gate, as configured: its two critical
`server-browser-global` findings are at the `critical` threshold. After the plugin ran, vmb's build
stopped on a `tsconfig.json` that extends a `.svelte-kit/tsconfig.json` its build never generates (it
builds into `SVELTE_KIT_OUT_DIR=.svelte-kit/build`), SB-Reg-svelte5's on `/static` variables not set,
and Widgetry's on a workspace package not built before the app.

Two plugin limits the run shows, neither a false positive:

- repose's root layout sets `ssr = false` and its landing, `/privacy`, `/terms`, `/refunds` and `/docs`
  subtree set `ssr = true` with `prerender = true`. The plugin skips a route under a disabled layout
  without reading a child's `ssr = true` (a ceiling `ssrDisabledRouteMatcher` documents), so those
  server-rendered pages were skipped as app shells and their HTML was not checked.
- The plugin reads prerendered pages from `.svelte-kit/output/prerendered/pages` whatever `kit.outDir`
  says. vmb sets `outDir` from `SVELTE_KIT_OUT_DIR`; it prerenders nothing, so nothing was missed here.

## Labelling notes

- No route a route-level finding is on never renders. The routes that always redirect (gofin-full's
  `/savings`, SB-Reg-svelte5's `(app)` index and vmb's `/master`) have no `+page.svelte` and carry none.
- The design share is concentrated in `canonical-url` (289), `description-presence` (248) and
  `each-key` (119); flow-weaver, matchup, SB-Reg-svelte5 and gofin-full together have 473 of the 838.
- Conventions the labellers applied but questioned:
  - `server-browser-global` on a runes module of an app whose routes never render on a server is
    `design` (12 earlier entries); the finding fails mangrove's build for a read that never runs there.
  - repose's `seo/ssr-disabled` says SSR is off for the whole app, though its public pages turn it back on.
  - `og:*`, `twitter:*` and `json-ld` presence stay `tp` on routes behind a sign-in and on dev-only
    routes, where `canonical-url` and `description-presence` are `design`.
  - An await reached only after an earlier early return is `fp` in one ledger entry and `design` in five;
    maroid's `canTurnOn` follows the five.

## Next

Add these 14 apps to the tuning corpus. With no false positive to fix, the plugin's two limits above and
the `ssr-disabled` wording are the candidates.
