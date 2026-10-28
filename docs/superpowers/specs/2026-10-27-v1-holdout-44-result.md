# v1 holdout 44 — result (2026-10-27)

Measured with `main` at aaf57497 on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-27-v1-holdout-44-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`, with C7 as `2026-10-03-c7-multi-app.md` defines it. Measured on
installed checkouts: all 14 installed. Raw first look: `scripts/corpus/holdout-44-2026-10-27.json`;
verdicts: `scripts/corpus/holdout-44-2026-10-27-verdicts.json` (6,690 distinct keys from 14 apps, every one
labelled by checks over the source at the pinned commit).

**Result: every deciding criterion passes.** No crash in either mode, no false critical finding, C4 at
99.09% and C5 at 99.77%, no false-positive class reaches two apps, no rule is judged under C7, and no key is
`unclear`. C8, published without deciding the result, is 38.1%. The release decision stays with the owner,
as the criteria say.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H43    | H42    | H41   | H40    | H39   | H38    | H37   | H36   | H35   | H34   | H33   | H32   | H31    | H30    | H29   | H28   | H27   | H26   | H25   | H24   | H23   | H22   | H21   | H20   | H19   | H18   | H17   | H16    | H15   | H14   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ------ | ------ | ----- | ------ | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 10 apps, 8 of which built | pass     | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 0                                              | pass     | 0      | 0      | 0     | 0      | 0     | 0      | 0     | 0     | 0     | 0     | 1     | 0     | 0      | 0      | 0     | 0     | 0     | 1     | 8     | 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 5      | 0     | 2     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 99.09% (2,388 / 2,410)                         | pass     | 99.69% | 99.95% | 99.9% | 100.0% | 99.6% | 99.9%  | 99.6% | 99.6% | 92.8% | 99.9% | 99.5% | 99.7% | 99.4%  | 100.0% | 99.8% | 99.8% | 98.0% | 99.2% | 93.9% | 99.2% | 99.7% | 99.8% | 98.2% | 99.8% | 98.7% | 98.4% | 99.3% | 99.95% | 99.0% | 97.7% | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.77% (2,622 / 2,628)                         | pass     | 99.4%  | 99.9%  | 99.8% | 100.0% | 99.9% | 100.0% | 99.6% | 99.9% | 97.0% | 99.9% | 99.7% | 99.9% | 100.0% | 99.6%  | 99.8% | 99.9% | 98.9% | 99.6% | 95.6% | 98.5% | 99.8% | 99.9% | 99.1% | 99.8% | 98.9% | 99.8% | 99.6% | 99.9%  | 99.2% | 99.2% | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | none                                           | pass     | none   | none   | none  | none   | none  | none   | none  | none  | none  | none  | none  | none  | none   | none   | none  | none  | 1     | none  | 1     | 1     | 1     | 1     | 1     | none  | 2     | none  | 1     | none   | 2     | 2     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision                 | ≥ 90%          | none judged (2 below 90% by the earlier one)   | pass     | none   | none   | none  | none   | none  | none   | none  | 1     | none  | none  | none  | none  | none   | none   | none  | none  | none  | none  | 2     | none  | none  | none  | none  | none  | 1     | 1     | 2     | 1      | 5     | 4     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 38.1% (1,513 / 3,968)                          | reported | 35.0%  | 26.2%  | 36.8% | 38.7%  | 32.6% | 31.5%  | 33.5% | 34.0% | 26.6% | 30.4% | 27.3% | 26.8% | 31.5%  | 30.5%  | 36.9% | 36.5% | 30.8% | 26.7% | 30.9% | 27.8% | 26.6% | 31.4% | 28.4% | 32.8% | 29.6% | 36.3% | 20.1% | 27.3%  | 28.2% | 26.6% | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 0                                          | pass     | pass   | pass   | pass  | pass   | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass   | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 80 (none new)                                  | pass     | 80     | 80     | 80    | 80     | 80    | 80     | 80    | 80    | 79    | 79    | 79    | 79    | 79     | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79    | 79     | 79    | 79    | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

The C7 history columns from holdout 18 on are the current definition, which applies from holdout 18;
earlier ones are the earlier definition, as published (`2026-10-03-c7-multi-app.md` has those holdouts
under the current one).

Verdicts (distinct keys): tp 5,055, fp 28, design 1,607, unclear 0.

C7 judges no rule: every rule's false positives come from one app. By the earlier definition two rules fall
under 90%: `a11y/id-duplication`, whose 23 findings are 16 `fp` (all restless-core) and 7 `design`, and
`a11y/no-autofocus`, whose 10 findings are 1 `fp` (Monsipan-Intern) and 9 `design`; neither has a `tp`.

## Critical findings (C3)

47 critical findings, all `title-presence`: 45 `tp` (cons-system 39, online-therapy 4, qmanga 1 and
restless-core 1) and 2 `design`, restless-core's `/gallery/home` and `/gallery/transcript`, whose layout
throws `error(404)` unless `dev`.

## False-positive classes

| Class                                                                                                                                               | Findings | Apps | Rules                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------------------------- |
| A component's arms tested by a literal prop joined with `&&` to a value the component holds itself, left undecided, so each use counts the same arm | 16       | 1    | id-duplication                                           |
| JSON-LD from `{@html}` of a concatenation of bindings, one of which holds the opening `<script type="application/ld+json">` tag                     | 4        | 1    | json-ld                                                  |
| A page whose `load` redirects on every request through a condition on a config constant                                                             | 5        | 1    | og-title, og-description, og-image, og-url, twitter-card |
| A layout passes the page as children of a component that renders them in one `{#if}` arm, and another arm's `<main>` is counted beside the page's   | 2        | 1    | duplicate-landmark                                       |
| `autofocus` in content passed to a component that renders it inside a native `<dialog>`                                                             | 1        | 1    | no-autofocus                                             |

The first is restless-core's `/[companyId]/company/resources`, which renders `<CompanyLimits>` with a
different literal `section` each time (`spend`, `authority`, `computer`). CompanyLimits chooses its section
in one `{#if}` chain whose arms test `section === 'authority' && view`, where `view` is the component's own
state: the literal prop alone makes the other uses' tests false, but the analyzer decides only a test made
of prop reads, so each id is counted once per use. The second is minewolf's `JsonLd.svelte`, which writes
`{@html open + json + close}` with `const open = '<script type="application/ld+json">'`; the analyzer reads
`{@html NAME}` when `NAME` holds such a tag, but not a concatenation written inside the `{@html}`. The third is the ICOM blog's `/auteurs`, whose `+page.ts` redirects when the Zotero profiles in `$lib/config.ts` give exactly one author with a site-relative link; the one profile there has no `href`, so its link is the `/auteurs/[slug]` route and the redirect always fires. Reading it means evaluating the constant. The
fourth is skillplane's `AppShell.svelte` and `WorkspaceRequired.svelte`, each rendering `<main>` in one arm
and `{@render children()}` in another; it is the callfs class of holdout 43, now in a second app across
holdouts, though one app in each. The fifth is Monsipan-Intern's settings page: its `Dialog.svelte`
renders a native `<dialog>` opened with `showModal()`, the case the rule's docs list as a known false
positive.

One misreading hides in keys not labelled `fp`: qmanga's `/offline-reader` renders its `Reader` or `Saved`
component, the only source of its `<title>`, inside `{#if ready}`, and `ready` turns true only in
`onMount`, so the prerendered page has no `<title>`. The first look does not report `title-presence` there;
the plugin's build-mode check, reading the prerendered HTML, does (C2 below). It is the shape of
bigmarket-mr's `ready` gate in holdout 43, in a second app.

## C2 in detail

GitHub Actions run 40519292836 (harness in `scripts/holdout-build/`; no stage ran into its limit). All 14
apps installed. The plugin ran on 10 apps and crashed on none. Eight builds completed: lithium-niobate (157
prerendered routes analyzed), popgenesjs (41) and the ICOM blog (35), and restless-core, online-therapy,
Monsipan-Intern, harpia and wynd with no prerendered page. qmanga's build stopped on the plugin's critical
gate: `title-presence` on the prerendered `/offline-reader`, which is true (above). minewolf's stopped after
the plugin ran, on a `$env/static/private` variable not set. Before the plugin ran, skillplane's build
stopped on its workspace package `@skillplane/api`, whose `dist` is not built; cons-system's on a Prisma
client its build does not generate; owlgraph's on `DATABASE_URL` not set; and cf-blog's build script runs
`svelte-check` first, which rejects the harness's wrapper `vite.config.ts`, as in holdout 36.

## Labelling notes

- Routes that never render: cons-system's and skillplane's `/`, Monsipan-Intern's `/lager`, `/verwaltung`
  and `/auftraege/[id]/arbeitsauftrag/folie`, and qmanga's `/studio` always redirect, as do the paths
  Monsipan-Intern's and harpia's `hooks.server.ts` answer before `resolve`. None carries a finding; only the
  ICOM blog's `/auteurs` (above) does.
- The design share is concentrated in `raw-html` (546), `canonical-url` (355) and `description-presence`
  (271); lithium-niobate, wynd, Monsipan-Intern and restless-core together have 1,086 of the 1,513.
- online-therapy's `/[category]` reports a second `<h1>` from the dashboard sidebar, which the root layout
  renders only when the path starts with `/dashboard`; a slug could, as the rule's docs describe, so it is
  `design`, though no real category does.
- Conventions the labellers applied but questioned:
  - `og:*` claims stay `tp` on a dev-only route that 404s in production, while its canonical, title and
    description claims are `design`.
  - A client-side `goto` redirect stub's missing title is `tp` by the ledger's majority, which also has
    `design` cases.
  - `no-autofocus` inside a user-opened dialog component is `design`, but the ledger's bases do not record
    whether the component renders a native `<dialog>`, which the docs treat as a false positive.
  - For `each-key`, a nested list of one fetched record is `tp` when its items are runtime records and
    `design` when the record is fixed while mounted; the line is a judgement call.
  - restless-core's canonical claims are `design` on the strength of a gate in its Rust gateway, outside
    SvelteKit.
  - `performance/state-raw` still accepts a candidate with a `{@const}` alias whose only use is a function
    argument (wynd), as in holdout 43.

## Next

Add these 14 apps to the tuning corpus. All five false-positive classes are single-app. The children-arm
class has now appeared in two holdouts (callfs, skillplane), and the `{@html}` concatenation is the
cheapest to measure.
