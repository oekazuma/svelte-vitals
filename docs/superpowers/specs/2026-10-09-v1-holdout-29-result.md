# v1 holdout 29 — result (2026-10-09)

Measured with `main` at bc8a1978 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-09-v1-holdout-29-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: 13 installed; BizForge's install failed (a dependency is arm64-only, and npm
refuses it on the x64 runner), so it was measured uninstalled. Raw first look:
`scripts/corpus/holdout-29-2026-10-09.json`; verdicts: `scripts/corpus/holdout-29-2026-10-09-verdicts.json`
(3,920 distinct keys from 13 apps, every one labelled by checks over the source at the pinned commit).

**Result: C1 and C6 fail.** The CLI exits 2 on BizForge, so that app has no findings to label. One
false-positive class reaches two apps: a layout `{#if}` decided by the route, in a test shape the
route reading does not take. Every other deciding criterion passes: no build-mode crash, no false
critical finding, C4 and C5 at 99.8%, no rule judged under C7, and no key `unclear`. Six keys are
false positives in all. C8, published without deciding the result, is 36.9%. The release decision
stays with the owner, as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                        | Result   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ----------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 1 (BizForge, exit 2)                            | fail     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 13 apps, 11 of which built | pass     | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                               | pass     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.8% (1,287 / 1,290)                           | pass     | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.8% (1,713 / 1,716)                           | pass     | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 1                                               | fail     | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (2 by the earlier definition)       | pass     | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 2     | 3     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 36.9% (791 / 2,141)                             | reported | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                           | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                   | pass     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 20 on are the current definition; earlier ones are the earlier
definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts under the current one).

Verdicts (distinct keys): tp 3,060, fp 6, design 854, unclear 0.

No rule has false positives from two apps, so C7 judges none. By the earlier definition, two rules
with ten or more findings fall under 90%: `id-duplication` at 50.0% (1 / 2; 131 of its 133 findings
are `design`) and `prop-mutation` at 33.3% (1 / 3; 63 of 66 are `design`), each from one app.

## C1 in detail

BizForge's `src/lib/components/tasks/TaskCard.svelte` has two `role` attributes on one element
(`role="button"` and `role="listitem"`), and the Svelte compiler rejects it ("Attributes need to be
unique"); the app's own `svelte` 5.55.5 rejects it too. The component pass skips a file that does not
parse. The route walk does not: it reaches the component from a route, and the read that parses it
(`readPackageAware` in `packages/cli/src/providers/source/resolve.ts`) tolerates a parse error only
under `node_modules`, so the error ends the whole run with exit 2. A malformed `+page.svelte` exiting 2
is pinned on purpose (`packages/cli/test/malformed-svelte.test.ts`); a malformed component the route
imports is not.

## What the result rests on

- **C6: the two route-decided classes are counted as one.** saffron-hive's layout renders the page
  bare under `{:else if PUBLIC_ROUTES.some((r) => $page.url.pathname.startsWith(r))}`, an array
  constant searched with `.some`. Hoop-Rush's root layout renders its `BottomNav` under
  `{#if showBottomNav}`, with `showBottomNav = $derived(routeId === '/' || routeId === '/roster' || …)`
  and `routeId = $derived(page.route.id)`. Both are tests the rule docs' route reading does not list
  (a string literal, an array literal's `.includes`, a regex, or one `$derived` of the path), so both
  reach the same documented limit by different syntax, which holdouts 25 and 27 counted as one class.
  Split by syntax, each is a single-app class and C6 passes; C1 fails either way.
- **saffron-hive's `duplicate-landmark` on `sidebar-inset.svelte:13` is `tp`.** It covers 29 routes; on
  26 the signed-in arm puts the page's `<main>` inside the layout's, and on `/login`, `/setup` and
  `/change-password-required` the claim is false for the reason above. The key is labelled by its
  majority; it is the same app and class, so no count above changes.
- **shareviz's three `style.delete()` keys under `prop-mutation` are `design`.** The prop holds a
  `LineStyleStore`, a class with a `$state` field whose `delete()` submits a ShareDB op that is applied
  to the document locally, which is the class-instance case the rule docs say stays reported. Under
  `fp`, `prop-mutation` has five false positives from one app and C4 is 99.5%; no result changes.
- **shareviz's `/view/chart/[[id]]` `title-presence` is `tp`.** It is an embed viewer that the app also
  opens on its own in a new tab. The ledger labels embed routes `tp` (atmo-events) and `design`
  (commons); under `design` only C8 moves.

## Critical findings (C3)

63 critical findings, all `title-presence`: 60 tp (relicblade-companion 20, ranking-forge 19,
shareviz 13, taijobi 8) and 3 `design`, all shareviz: `/brand`, an unlinked brand-mark playground;
`/editor/vizzu`, an unlinked experimental editor; and `/example/[id]`, which only shows a message while
`onMount` copies a sample and navigates away.

## False-positive classes

| Class                                                                                                                                                        | Findings | Apps | Rules                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---- | ------------------------- |
| A layout `{#if}` decided by the route in a test the route reading does not take (`ARRAY.some(… startsWith …)`, `\|\|` of `route.id` through two `$derived`s) | 4        | 2    | single-h1, id-duplication |
| A prop holding an object of functions, called to submit a ShareDB op, read as a mutation of the prop                                                         | 2        | 1    | prop-mutation             |

The second class has ledger precedents of the same shape (wordplay, mankunku): the object the prop
holds does not change.

## C2 in detail

GitHub Actions run 37881565518 (harness in `scripts/holdout-build/`). The plugin ran on 13 apps and
crashed on none. Eleven builds completed: Hoop-Rush (28 prerendered routes analyzed), buscabase (3
analyzed), relicblade-companion (13 skipped as `ssr = false`), taijobi (22 skipped as `ssr = false`),
and shareviz, program, ranking-forge, spoty-stalk, quizare, saffron-hive and tracepad with no
prerendered page. After the plugin ran, saiku's build step was stopped by a later `npm ls` failing on
extraneous packages, and data-forge's by an import of a file the repository does not contain. BizForge
was not built, since its install failed.

## Labelling notes

- No flagged route never renders. The routes whose `load` redirects or fails on every path (in quizare,
  data-forge, Hoop-Rush, ranking-forge, spoty-stalk, program and tracepad) were already left out.
- The design share is concentrated in `description-presence` (183), `canonical-url` (145),
  `each-index-key` (141) and `id-duplication` (131); saiku, data-forge, saffron-hive and tracepad
  together have 485 of the 791.
- 122 of the `id-duplication` `design` keys are one data-forge page that renders a step editor in two
  separate `{#if}` blocks on one setting, which never both hold; the rule's docs count separate blocks
  as both rendering.
- Judgement calls the labellers flagged:
  - Image keys on a layout image that a pathname test hides on some routes (saiku's topbar logo,
    Hoop-Rush's header) are labelled by the majority of their routes; the image rules do not decide
    arms by route.
  - buscabase's JSON-LD built from its own API without escaping `<` is `tp`, as the ledger labels
    non-literal JSON-LD whatever its source.
  - robots.txt and sitemap on an app served from a GitHub Pages project path are `tp`, as the ledger
    has them.
- Seen while labelling, not false positives: shareviz's `canonical-url` on `/me/*` and `/org*` stays a
  warning, because the info downgrade for routes behind a sign-in redirect does not recognise its
  `session == null || typeof user.id != "string"` gate; its `/reset-password`, gated by
  `!locals.session`, is downgraded.

## Next

Make the route walk skip a component that does not parse, as the component pass does; extend the
route reading to the two test shapes above; and add these 14 apps to the tuning corpus.
