# v1 holdout 38 — result (2026-10-20)

Measured with `main` at e6d1d317 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-19-v1-holdout-38-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 installed; football-manager's `npm ci` failed on a peer-dependency conflict
(ERESOLVE) and it was measured uninstalled. Raw first look: `scripts/corpus/holdout-38-2026-10-20.json`;
verdicts: `scripts/corpus/holdout-38-2026-10-20-verdicts.json` (4,701 distinct keys from 14 apps, every
one labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.9% and C5 at 100.0%, no false-positive class reaches two apps, no rule is judged under C7, and one key
of 4,701 is `unclear`, well inside C9's 1%. C8, published without deciding the result, is 31.5%. The
release decision stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 11 apps, 7 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.9% (1,820 / 1,822)                          | pass     | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 100.0% (1,699 / 1,699)                         | pass     | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (1 below 90% by the earlier one)   | pass     | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 31.5% (862 / 2,735)                            | reported | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.02%)                                  | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                  | pass     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 3,570, fp 2, design 1,128, unclear 1.

C7 judges no rule: each false positive comes from one app. By the earlier definition, one rule with ten or
more findings falls under 90%: `sitemap-xml` at 80.0% (4 / 5, on 10 findings), from ygo.tools.

## Critical findings (C3)

58 critical findings, all `title-presence`: 51 tp (kepler-chat 15, locatra-ex 15, kidooz 11, TurnKeyOps
5, shared-gigwidget 4, football-manager 1) and 7 `design` (five client-side redirect stubs in
shared-gigwidget, locatra-ex's leftover `/sidebar-07` example page, and Kyro's unlinked `/health` status
page).

## False-positive classes

| Class                                                                                                                             | Findings | Apps | Rules              |
| --------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | ------------------ |
| A sitemap served by a `sitemap[[page]].xml` route (an optional parameter that also answers `/sitemap.xml`), not read as a sitemap | 1        | 1    | sitemap-xml        |
| An unlabelled `<aside>` the root layout renders inside `<section>` around the page's children, read as a `complementary` landmark | 1        | 1    | top-level-landmark |

Both are ygo.tools. Its `src/routes/sitemap[[page]].xml/+server.ts` answers `/sitemap.xml`, which
`static/robots.txt` names; the sitemap check recognises only a `sitemap.xml` route directory or
`static/sitemap.xml`. The landmark class is the one holdout 36 found in MiniERP through a component, here
through the root layout (`+layout.svelte:36-41` wraps `{@render children()}` in `<section>` inside
`<main>`); the rule's docs say an unlabelled `<aside>` in sectioning content is not a landmark.

## C2 in detail

GitHub Actions run 39277432794 (harness in `scripts/holdout-build/`, with the per-stage limits it gained
in holdout 37; no job ran into one). 13 apps installed; football-manager's `npm ci` stopped on ERESOLVE, so
it has no build. The plugin ran on 11 apps and crashed on none. Seven builds completed: polotto.dev (12
prerendered routes analyzed), and ygo.tools, shortener, TurnKeyOps, toads, Kyro and SmartBrain_3000 with no
prerendered page. After the plugin ran, IglesiaRestauracion's build stopped on `$env/static` variables
not set, kidooz's and locatra-ex's on environment variables a module reads at import, and
shared-gigwidget's on a workspace package not built before the app. Before the plugin ran, kepler-chat's
build stopped on its own environment validation and bardbase's on `TURSO_URL` not set.

## Labelling notes

- No route a route-level finding is on never renders. The routes that always redirect (TurnKeyOps's
  `/bdr/admin`, `/thinkpink/admin`, `/bdr/admin/content`, `/carlzipf/admin` and `/turnkeyops/admin`;
  shortener's `/dashboard`, `/landing`, `/dashboard/project`, `/dashboard/account/settings` and
  `/dashboard/billing/plan`; kepler-chat's `/`, `/settings` and `/customize`) carry none.
- toads' `/login`, `/members-only` and `/raids/[id]` throw `error()` unless the build-time `__PREVIEW__`
  flag is set, and that preview build is published. The labellers split on them: `description-presence`
  and `title-length` there are `design` under the ledger's "errors unless dev or a test flag" convention,
  while `canonical-url` is `tp` because the published preview renders them. No verdict on them is `fp`.
- The one `unclear` is kepler-chat's `InlineVisual.svelte:143`, an `iframe-loading` finding on a
  `srcdoc` iframe in chat history; it turns on whether browsers honour `loading="lazy"` on a `srcdoc`
  iframe, like the ledger's three earlier `unclear` entries of that shape.
- The design share is concentrated in `canonical-url` (304), `description-presence` (261) and
  `title-length` (123); TurnKeyOps, football-manager, kidooz and SmartBrain_3000 together have 603 of the 862.
- ygo.tools sets its head through `sk-seo` (checklist items 4 and 12). The installed run followed
  `sk-seo@0.5.4`; its findings differ from an uninstalled run (`title-length` on 1 route against 7), and the
  labellers took the installed run's.
- Conventions the labellers applied but questioned:
  - `og:*`, `twitter:*` and `json-ld` presence stay `tp` on routes behind a sign-in, where
    `canonical-url` and `description-presence` are `design`.
  - An app-wide description labelled by its routes' majority hides real duplicates on public pages
    (football-manager's 161-character description, shortener's shared description).
  - `route-component-import` on an import of a `+page.svelte` that no longer exists (shortener's orphaned
    `ShortenerCard`) is `tp`; the import is a defect, though "renders without the data" does not describe it.
  - A `<select>`'s option list the user can edit in settings is `tp` for `each-key`; a fixed enum or a
    reference table is `design`.

## Next

Fix the classes above where they are fixable and add these 14 apps to the tuning corpus.
