# v1 holdout 24 — result (2026-10-05)

Measured with `main` at 2fe6b3b0 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-05-v1-holdout-24-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 12 of 14 installed; community and archon-vibe were measured uninstalled (below).
Raw first look: `scripts/corpus/holdout-24-2026-10-05.json`; verdicts:
`scripts/corpus/holdout-24-2026-10-05-verdicts.json` (6,087 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: not ready.** One of the nine deciding criteria fails: C6, on headings in markdown a page
renders, which the analyzer cannot see, in two apps. It is the class `2026-10-04-markdown-html-headings.md`
measured and left open, and it fails C6 under either grouping: both apps render committed markdown
with `{@html}`. C3 passes with no false critical finding, C4 (99.2%) and C5 (98.5%) pass, no rule
falls under 90% under C7, and no key is `unclear`. C8, published without deciding the result, is
27.8%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 9 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.2% (2,442 / 2,461)                          | pass     | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 98.5% (2,322 / 2,357)                          | pass     | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1 class (below)                                | fail     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none below (2 by the earlier definition)       | pass     | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 27.8% (957 / 3,440)                            | reported | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 4,786, fp 54, design 1,247, unclear 0.

C7 judges one rule, above the threshold: `seo/single-h1` 98.2% (161 / 164, false positives from
sunburn, cashier-sveltekit and kali-afl-stats). By the earlier definition two rules fail, each on one
app: `seo/heading-level-skip` at 66.7% (68 / 102, all 34 false positives from the Holmström website)
and `a11y/id-duplication` at 60.0% (3 / 5, both false positives from banbot).

## Critical findings (C3)

22 critical findings, all `title-presence` and all tp: adapto client's 11 listing routes under
`[lang]`, the Holmström website's blog and six explorables, and community's three onboarding steps.
Each title was decided on its route's full render chain, including the npm components it renders and
`document.title` writes in the modules its scripts call.

## False-positive classes

| Class                                                                                                                           | Findings | Apps | Rules                                 |
| ------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------------------------- |
| **Headings in committed markdown a page renders** (with `{@html}` of `marked`, or as an mdsvex or `.md` module component)       | 35       | 2    | **heading-level-skip**, **single-h1** |
| A legacy `$: history = …` declaration read as `window.history`                                                                  | 6        | 1    | instance-browser-global               |
| `og:url` that nginx serves link-preview bots from a backend stub, outside SvelteKit                                             | 5        | 1    | og-url                                |
| An exported constant list its module aliases (`const dayNames = … ? opts.days : DAY_SHORT`), losing the constant-list exemption | 4        | 1    | each-key                              |
| A literal prop selecting an `{:else if}` arm of a component (a 37-arm icon chain)                                               | 2        | 1    | id-duplication                        |
| A component taken from a literal array of imported components (`{@const Section = s.component}`)                                | 1        | 1    | single-h1                             |
| A drawer `{#if}` on global `$state` an `$effect` sets from `page.route.id`                                                      | 1        | 1    | single-h1                             |

C6's class is the one `2026-10-04-markdown-html-headings.md` records as measured and not pursued:

- The Holmström website renders each essay's committed markdown (`##`/`###` headings) before a
  "Study Reference" `<h3>`: 27 essays through an mdsvex `<Content />`, one (`the-exit-problem`)
  through `{@html marked(rawMarkdown)}`, and six syntheses through `<svelte:component this={Content}>`.
  `heading-level-skip` reads the `<h3>` as following the page `<h1>`.
- cashier-sveltekit's `/help/[topic]` renders `{@html html}` of `doc/help/*.md`, every one of which
  opens with `# `; `single-h1` reports "Missing `<h1>`".

The `{@html}` mechanism reaches both apps, so split by mechanism the class still spans two. Holdout 21
failed C6 on the same class. The memo's revisit condition, a class that starts deciding results, has
now been met twice; the mdsvex component and `?raw` forms here are visible from the route's own
imports, which the memo's first row already called cheap.

The `{:else if}` class is the limit holdout 22 left open (DevelexTasks), met here in one app.

## C2 in detail

GitHub Actions run 37261287446 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 11 apps and crashed on none. Nine builds completed: banbot (69 prerendered routes analyzed),
guia-guangzhou (66), MagicScouting (15), cashier-sveltekit (its 86 prerendered routes are `ssr = false`
and were skipped), and KKApp, kali-afl-stats, adapto client, my-kitchen and sunburn with no prerendered
page. After the plugin ran, the Holmström website's build (260 prerendered routes analyzed) was stopped by
the plugin's own gate on its critical findings, and halal-ima-taiwan's on `PUBLIC_SUPABASE_URL` not set.
Before the plugin ran, namsbokasafn-vefur's build stopped in its content step, which needs content
synced from another repository. community and archon-vibe were not built: their install stopped at
`git submodule update`. community commits three gitlinks under `my_new_project/.claude/worktrees` with
no `.gitmodules` entry, and archon-vibe's `vekn-api` submodule is a private repository. The selection
checked for a `.gitmodules` file, which neither has; it did not check for gitlinks.

## Labelling notes

- The design share is concentrated in `each-key` (276), `raw-html` (169) and `description-presence`
  (165); community, the Holmström website, archon-vibe and KKApp together have 672 of the 957.
- Judgement calls the labellers flagged:
  - archon-vibe's five `og:url` findings are `fp` (the bots that read `og:url` receive it from the
    backend stub), while `canonical-url` on the same routes stays `tp`: the bot list leaves out search
    crawlers by design. Applebot, on that list, blurs the line.
  - banbot's `lib/Icon.svelte` `id-duplication` key is `fp` by finding count (about 70 of 89); by
    route it ties 10 `fp` to 10 `design` (the `/dash` routes), with 1 `tp`. sunburn's `single-h1`
    key is `fp` on 4 of its 5 routes.
  - namsbokasafn-vefur's section pages are `tp` for "Missing `<h1>`": the `<h1>` comes from content
    HTML a client `$effect` inserts, so the prerendered page has none. The content was read in its
    public sister repository.
  - cashier-sveltekit's 90 "Missing `<h1>`" keys are `tp`: the only `<h1>` is in the help markdown
    inside a closed `<dialog>`, the mirror of the ledger's "closed dialog extra" `design`.
  - Paraglide's `locales` lists (banbot) are `design` for `each-key`: the runtime module is generated
    and gitignored.
  - sunburn's chat markdown is `tp` for `raw-html`: `javascript:` link URLs pass through unsanitized.
- Conventions the labellers applied but questioned:
  - og and twitter rules are `tp` on gated, noindex and `robots.txt`-disallowed routes where
    `canonical-url` is `design`; `json-ld` is never `design` in the ledger.
  - The link rules are `tp` on apps never served as public sites (a bot UI embedded in a binary, a
    Capacitor app).
  - A sitemap generated into a gitignored `static/sitemap.xml` is `design` in some ledger entries and
    `fp` in one.
  - `<center>` is reported by both `deprecated-element` and `permitted-contents`.
- Seen while labelling, not false positives: KKApp's `server-module-state` finding on a `Handle`
  composed with `sequence()` carries the weaker "if it runs during a request" message; my-kitchen's
  `canonical-url` stays `warning` behind a `requireUser(event)` helper rather than an inline `locals`
  check; for `id-duplication` keys the first look's `routes` field counts findings, not routes.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria again needs a
twenty-fifth holdout.
