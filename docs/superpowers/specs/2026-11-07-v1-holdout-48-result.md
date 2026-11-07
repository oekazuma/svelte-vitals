# v1 holdout 48 — result (2026-11-07)

Measured with `main` at e8978e91 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-11-07-v1-holdout-48-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-48-2026-11-07.json`; verdicts:
`scripts/corpus/holdout-48-2026-11-07-verdicts.json` (5,128 distinct keys from 14 apps, every one labelled by
checks over the source at the pinned commit).

**Result: C6 and C7 fail, both on `seo/single-h1`.** The rule is at 77.4% (24 / 31), with false positives from
six apps in five classes. One class is shared by two apps: volleyball and buddy-wallet each render a markdown
module their `load` returns as `<data.….component />`, and the `<h1>` that module renders is not seen. Every
other deciding criterion passes: no crash in either mode, no false critical finding, C4 at 99.60%, C5 at 99.87%,
and no key is `unclear`. C8, published without deciding the result, is 43.0%. The release decision stays with
the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H47    | H46    | H45    | H44    | H43    | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ------ | ------ | ------ | ------ | ------ | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                               | pass     | pass   | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 14 apps, 11 of which built | pass     | pass   | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0      | 0      | 0      | 0      | 0      | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.60% (1,494 / 1,500)                          | pass     | 99.55% | 99.38% | 99.85% | 99.09% | 99.69% | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.87% (2,301 / 2,304)                          | pass     | 99.87% | 99.73% | 99.78% | 99.73% | 99.4%  | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 (2 apps)                                      | fail     | none   | none   | none   | none   | none   | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | 1 below 90% (2 by the earlier one)              | fail     | none   | 1      | none   | none   | none   | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 43.0% (1,136 / 2,641)                           | reported | 32.6%  | 35.5%  | 36.5%  | 38.1%  | 35.0%  | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass   | pass   | pass   | pass   | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                   | pass     | 80     | 80     | 80     | 80     | 80     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,800, fp 9, design 1,319, unclear 0.

C7 judges one rule, `seo/single-h1`, the only rule with false positives from two or more apps. By the earlier
definition `a11y/id-duplication` also falls under 90%: its 26 findings are 3 `tp`, 22 `design` and 1 `fp`
(BrainDog), 75.0%.

## What the result rests on

- **The shared class is one mechanism in both apps.** volleyball's `[lang]/blog/[slug]/+page.svelte` renders
  `<data.post.component />`; its `load` gets the post from `blogLoader.js`, which imports the `.md`/`.svx` file
  with `import.meta.glob` or `import()`, and the mdsvex layout in `mdsvex.config.js` wraps every post in
  `BlogLayout.svelte`'s `<h1>{title}</h1>`. buddy-wallet's `/about`, `/privacy` and `/terms` render
  `<data.component />` from `getContent()`, an eager `import.meta.glob` over `src/contents/marketing/*.md`, and
  each file opens with `# ` (line 5). "Missing `<h1>`" is false on both. buddy-wallet's key covers four routes and
  is labelled by its majority: `/faq` renders no markdown and really has no `<h1>`.
- **C7 would fail without the shared class.** The other `single-h1` false positives come from four more apps,
  so the rule stays under 90% with either app's key removed.

## Critical findings (C3)

5 critical findings, all `title-presence` on archinex's `/kb/*` pages, all `tp`: no page, layout or `app.html`
renders a `<title>`, and the only title write is a `document.title` from a root-layout `$effect`, which the
server-rendered pages never ship.

## False-positive classes

| Class                                                                                                       | Findings | Apps | Rules          |
| ----------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------- |
| An `<h1>` in a markdown module a page renders as `<data.….component />` from its `load`                     | 2        | 2    | single-h1      |
| `<h1>`s in arms that never render together, counted together                                                | 2        | 1    | single-h1      |
| A component picked from a lookup table (`dashboardFor()`) whose every candidate renders an `<h1>`           | 1        | 1    | single-h1      |
| `{#if step !== 'success'}` and `{#if step === 'success'}`, with other blocks between them, counted together | 1        | 1    | single-h1      |
| `{@html}` of a post rendered with `svelte/server` whose mdsvex layout opens with an `<h1>`                  | 1        | 1    | single-h1      |
| An `{#if}` on a prop test wrapped in a local helper (`{#if drawn('others')}`)                               | 1        | 1    | id-duplication |
| `autofocus` in content a component renders into a `<dialog>`                                                | 1        | 1    | no-autofocus   |

The second is BrainDog's: `Empty.svelte:166` (8 routes, 5 of them `fp`) and `PageHead.svelte:402` (`/` and
`/p/[slug]`), where a `headless` PageHead, a hub head shown only on two routes, and a `doors` value that is null
in every arm with its own `<h1>` keep the two `<h1>`s apart. The third is lit-crm's `/`, the fourth meabeclick's
`/booking`, the fifth voidprojects-site's `/blog/[slug]`; the last two are BrainDog's `settings` pages. The
`{@html}` shape is the markdown class the corpus has declined to follow since holdout 21; the `<dialog>` shape is a
limitation the rule's docs name, last seen in holdout 46.

## C2 in detail

GitHub Actions run 42334899060 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14 apps
installed. The plugin ran on all 14 and crashed on none. Eleven builds completed: volleyball (278 prerendered
routes analyzed), swarvex (60), voidprojects-site (14), wasm.fyi (11), buddy-wallet (4) and beacon-studio-ihm
(0, one skipped with `ssr = false`), and NetTap, BrainDog, kurious, meabeclick and mike with no prerendered page.
lit-crm's and archinex's stopped after the plugin ran, on a Prisma client their `build` scripts do not generate,
and jinrudals.github.io's on a mermaid preprocessor that needs a Playwright browser the runner does not have.

## Labelling notes

- Routes that never render: BrainDog's `/add`, `/addons/[...rest]`, `/packs/[...rest]`, `/vault`,
  `/automations/runs` and `/decide/[id]/thread`, mike's `/judges/*`, `/steerers`, `/steerers/[id]` and
  `/settings/workers/evals/*`, and beacon-studio-ihm's `/queries` always redirect or error. None carries a
  route-level finding.
- The design share is concentrated in `each-key` (346), `each-index-key` (237), `canonical-url` (207) and
  `description-presence` (195); BrainDog, mike, NetTap and archinex together have 697 of the 1,136.
- mike serves its SPA on `127.0.0.1` by default behind a loopback host check, so its 56 `canonical-url` keys are
  `design`, following the ledger's localhost tools; the ledger also has localhost tools labelled `tp`.
- beacon-studio-ihm is a Tauri app with a documented public web build; its keys follow the ledger's Tauri apps
  (`canonical-url` and `og:*` `tp`, `description-presence`, `robots-txt` and `sitemap-xml` `design`).
- jinrudals.github.io's `/notes/[slug]` and `/study/[slug]` 404 for every slug at this commit only because their
  content folders do not exist yet, so they are read as rendering, under the 404-in-production convention.
- Conventions the labellers applied but questioned:
  - `og:*` and `twitter:card` stay `tp` on signed-in, noindex and dev-only routes, while `canonical-url` on the same
    route is `design`.
  - archinex's 8 `sequential-awaits` pair a synchronous SQLite query with an HTTP call and are `design` under the
    synchronous-SQLite convention, though the network wait could overlap the local read.
  - `load-waterfall` on an `ssr = false` SPA is `design` when the app's own backend serves it (mike) and `tp` when
    it calls a separate API; the ledger has both.
  - `state-raw` reports a binding a `{@const}` aliases, which its docs say disqualifies it; the findings are `tp`
    as the ledger has them.
  - The `each-key` exemption for a constant inline array is silent on spreads (`[...ATTACK_ZONES, ZONE_FINTE]`);
    such lists are `design`.
  - `responsive-image` on a vector behind an expression is `fp` in some ledger entries and `design` in most;
    swarvex's template-literal `badge.svg` URL is `design`.
  - Ids repeated in a closed native `<dialog>`, which keeps its children in the DOM, are `tp` for
    `id-duplication`, unlike a component dialog that unmounts its content.

## Next

Add these 14 apps to the tuning corpus. Measure the shared `single-h1` class on the corpus: a page rendering
`<data.….component />` where its `load` returns a module from `import.meta.glob` or `import()` of mdsvex files.
The sibling `{#if}` arms on `!==`/`===` of one value with blocks between them, and the lookup-table component,
are single-app candidates. The `<dialog>` autofocus shape is the second holdout to show it.
