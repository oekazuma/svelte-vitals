# v1 holdout 14 — result (2026-10-01)

Measured with `main` at 057acffc on the 14 apps pinned in `scripts/corpus/holdout.json` (chosen in
`2026-10-01-v1-holdout-14-selection.md` before any run), and judged against
`2026-09-24-v1-release-criteria.md`. Measured on installed checkouts: all 14 installed. Raw first look:
`scripts/corpus/holdout-14-2026-10-01.json`; verdicts: `scripts/corpus/holdout-14-2026-10-01-verdicts.json`
(9,987 distinct keys from 14 apps, every one labelled by checks over the source at the pinned commit).

**Result: not ready.** Four of the nine deciding criteria fail: C3, C4, C6 and C7. Two false critical
findings, one from each of two classes, fail C3; C5 (99.2%) passes. C8, published without deciding the
result, is 26.6%.

| #   | Criterion                          | Threshold      | Measured                                       | Result   | H13   | H12   | H11   | H10   | H9    | H8    | H7    | H6    | H5    | H4    | H3    | H2    | H1    |
| --- | ---------------------------------- | -------------- | ---------------------------------------------- | -------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| C1  | CLI crashes                        | 0              | 0                                              | pass     | pass  | pass  | pass  | pass  | pass  | fail  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C2  | Build-mode crashes                 | 0, on ≥ 3 apps | 0; the plugin ran on 12 apps, 7 of which built | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C3  | `fp` from critical rules           | 0              | 2                                              | fail     | 0     | 0     | 62    | 13    | 0     | 1     | 0     | 29    | 31    | 147   | 19    | 0     | 95    |
| C4  | Warning precision                  | ≥ 98%          | 97.7% (2,959 / 3,029)                          | fail     | 99.2% | 98.7% | 99.7% | 99.6% | 99.0% | 99.6% | 97.0% | 90.7% | 99.7% | 82.9% | 97.5% | 92.1% | 71.3% |
| C5  | Info precision                     | ≥ 95%          | 99.2% (4,903 / 4,942)                          | pass     | 99.9% | 99.0% | 99.8% | 99.7% | 98.5% | 98.5% | 97.1% | 97.3% | 93.5% | 92.8% | 97.8% | 96.2% | 90.2% |
| C6  | fp class shared by ≥ 2 apps        | none           | 2 classes (below)                              | fail     | none  | 2     | 1     | 2     | 2     | 1     | 1     | 2     | none  | 2     | 2     | 1     | 5     |
| C7  | Per-rule precision (≥ 10 findings) | ≥ 90%          | 4 rules below                                  | fail     | 1     | 3     | 3     | 1     | 4     | 4     | 2     | 5     | 4     | 11    | 2     | 9     | 12    |
| C8  | Design share of critical + warning | reported       | 26.6% (1,154 / 4,344)                          | reported | 35.0% | 30.1% | 35.1% | 33.6% | 42.7% | 37.8% | 34.4% | 33.4% | 35.6% | 23.3% | 22.7% | 33.0% | 25.3% |
| C9  | Unlabelled / unclear               | 0 / ≤ 1%       | 0 / 1 (0.01%)                                  | pass     | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  | pass  |
| C10 | Rules with real-app evidence       | ≥ 70 of 105    | 79 (none new)                                  | pass     | 79    | 79    | 79    | 79    | 77    | 77    | 75    | 75    | 75    | 73    | 73    | 67    | 63    |

Verdicts (distinct keys): tp 8,021, fp 111, design 1,854, unclear 1.

C7's rules: `a11y/id-duplication` 41.7% (10 / 24, 38 findings, 14 of them design),
`correctness/prop-mutation` 76.0% (38 / 50, 60 findings), `a11y/duplicate-landmark` 88.7% (47 / 53) and
`a11y/top-level-landmark` 89.8% (53 / 59).

## Critical findings (C3)

170 critical findings. 169 `title-presence`: 159 tp (threadline 70, ubumaths 65, syr 18, maal 2,
otterscale 2, Optikt 1, SoME 1), 9 design (ubumaths' admin diagnostics and test pages under
`/dashboard/admin/debug` and `/dashboard/admin/errors/test`) and 1 fp. One `security/handler-state-write`,
fp. The two fps:

- ubumaths `/dashboard/student/classroom`: its load starts with
  `if (!GOOGLE_CLASSROOM_ENABLED) throw redirect(302, '/dashboard')`, and the flag is the literal `false`
  exported from `src/lib/config/google-classroom.ts`, so the page never renders.
- syr `api/instance-config/[key]/+server.ts:139`: `kvService.set(…)` writes through a SurrealDB
  repository, not module state; `kvService` is imported from `$lib/services`, outside the `$lib/server`
  root where a persistence client is told apart. In build mode the same finding stopped syr's build at
  the plugin's critical gate.

## False-positive classes

| Class                                                                                                                         | Findings | Apps | Rules                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | -------- | ---- | --------------------------------------------------------------------------------------------- |
| A load that always redirects behind an imported literal-`false` flag is not read as never rendering                           | 41       | 1    | **title-presence**, 13 other route-level SEO and a11y rules                                   |
| **A layout choosing its arm by the URL renders the page in every arm (bare in one, inside `<main>` or a heading in another)** | 19       | 4    | **duplicate-landmark**, **top-level-landmark**, single-h1, id-duplication, heading-level-skip |
| `$bindable() as T` is not read as a bindable default                                                                          | 12       | 1    | **prop-mutation**                                                                             |
| A prop-decided `{#if}` / `{:else if}` chain whose first test is compound (`a === 'x' \|\| a === 'y'`) is not resolved         | 12       | 1    | **id-duplication**                                                                            |
| A `hooks.server.ts` redirect of one exact pathname is not read as the route never rendering                                   | 11       | 1    | 11 route-level SEO rules                                                                      |
| **`role="heading"` with `aria-level` (bits-ui `Dialog.Title`, shadcn `CardTitle`) is not read as a heading**                  | 5        | 2    | heading-level-skip                                                                            |
| A customizable `<select>` (`appearance: base-select`) holding `<button><selectedcontent>`                                     | 4        | 1    | permitted-contents                                                                            |
| A `<script>` in the head of a `ssr = false` route reported as render-blocking                                                 | 2        | 1    | render-blocking-script                                                                        |
| A KV/database client's `.set()` outside `$lib/server` read as a module-state write                                            | 1        | 1    | **handler-state-write**                                                                       |
| A library's browser guard (`isBrowser()` from `@supabase/ssr`) not read as browser-only                                       | 1        | 1    | server-module-state                                                                           |
| A `$state` handed to a call inside an object literal (`onSave({ …, x })`) not read as escaping                                | 1        | 1    | unmutated-state                                                                               |
| A bare boolean attribute (`nested`) and a prop forwarded unset (`{actions}`) not resolved                                     | 1        | 1    | id-duplication                                                                                |
| Headings a component renders from literal markdown it is handed                                                               | 1        | 1    | heading-level-skip                                                                            |

C6's two classes are the URL-decided layout arms (threadline, akmmp-porto, s2if and diversif; holdout 13
had it in medora) and the ARIA headings (radio4000 and ubumaths). The flag class recurs from holdout 12
and the tuning corpus (communisaas), and the object-literal `$state` class from holdout 12.

## C2 in detail

GitHub Actions run 36852669926 (harness in `scripts/holdout-build/`). The plugin ran and wrote its
report on 12 apps and crashed on none. Seven builds completed: s2if (88 prerendered routes analyzed),
nah-tools (145), diversif (2), r4atproto (5 `ssr = false` shells skipped), and maal, ontoplano and
otterscale with no prerendered page. syr stopped at the plugin's own critical gate on the false
`handler-state-write` finding above. The others failed on their own: `$env/static` variables not set
(ubumaths, threadline, JobPilot, SoME), and, before the plugin ran, an unset `DATABASE_URL` (Optikt,
akmmp-porto).

## Labelling notes

- The design share is concentrated in `canonical-url` (485), `description-presence` (485),
  `each-index-key` (177), `each-key` (162) and `raw-html` (119); ubumaths, threadline, ontoplano and
  nah-tools together have 840 of the 1,154.
- The info demotion for login-gated routes moved none of ubumaths' gated canonicals: its `(protected)`
  layout gates through a helper call (`requireAuth(user)`), which the detector does not read.
- Conventions the labellers applied but questioned: og/twitter as `tp` on routes behind a login where
  canonical and description are `design`; a robots.txt `Disallow` alone making canonical `design`; a
  persistence client's `.set()` outside `$lib/server`, which the rule's docs say is flagged and the
  ledger labels `fp` (the C3 verdict above follows the ledger); `sequential-awaits` as `design` behind an
  auth gate and `tp` behind a 404 existence check; `role="heading"` counted as a level for
  `heading-level-skip` but not as an `<h1>` for `single-h1`; and `json-ld` as `tp` on routes that only
  serve in development.
- Analyzer gaps that did not change a verdict: `new Set(LIST)` in a component keeps an imported constant
  list reported; `Array(n).fill(0).map(…)` and `[literal].filter(…)` are not read as constant;
  `render-blocking-script`'s docs say nothing about `ssr = false`.
- One `unclear`: ontoplano's billing page awaits two calls into a billing provider the repository leaves
  out by design, so whether they are network calls cannot be read.

## Next

Fix the classes above and add these 14 apps to the tuning corpus. Claiming the criteria needs a
fifteenth holdout.
