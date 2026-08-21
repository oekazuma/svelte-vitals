# a11y/unverified-id-ref — opt-in open-world arm — design

## Problem and decision

`a11y/no-missing-id-ref` needs a fully resolved route composition and, on real apps, almost
never gets one. The measurement (`2026-08-20-no-missing-id-ref-widening-measured.md`)
closed the question of which widening family can matter: every sound, single-cause remedy
tops out near 8 of the 286 unlockable routes, because nearly every skipped route carries
several cause kinds at once. Only a mechanism that runs despite unknowns — reporting an
unmatched reference as _unverifiable_ rather than _missing_ — reaches the mass.

That trades away the zero-false-positive stance the closed-world gate exists for, so it
ships **opt-in**: a sibling rule, `a11y/unverified-id-ref`, off by default. A different
claim gets a different rule id — suppressions keys, baseline comparisons, `report.rules`
evidence, severity control, the docs page, and `explain` all separate the two claims
through machinery that already exists. The sound rule, its skip reporting, and every
non-opted-in user's score are untouched.

## Rule semantics

`a11y/unverified-id-ref` — category `a11y`, scope `route`, declared severity `info`,
`defaultOff: true` (below). Mirror of the sibling on the routes the sibling skips:

- Runs only on routes where `fullyResolved` is false **and** `idRefs.length > 0`. Fully
  resolved routes stay the sibling's domain — the two rules never report the same route.
  A route with no literal references produces nothing, as in the sibling.
- Each literal id reference is matched against the same optimistic candidate set the
  sibling uses (`idCandidates`: every literal id in any branch, `{#each}`/snippet bodies,
  resolved components, and `app.html`). A matched reference is sound to accept for the
  same reason the sibling's candidates are optimistic; an unmatched reference is a
  PENALIZED result, and a route whose references all match yields one PASS result — the
  `resultFactory` convention the sibling uses. One shared-helper change is required:
  `resultFactory` (`route-rule.ts`) hard-codes `severity: 'warning'` into every Result,
  which was benign while every a11y route rule declared `warning`. It gains a severity
  parameter; existing callers pass `'warning'`, this rule passes `'info'`. Without that,
  an options-object enablement (legal, keeps the rule's built-in severity) would deduct
  as `warning` in the summary while weighing the inventory as `info`, and `explain`
  would disagree with the report.
- The message names what blocks verification, reusing `ResolvedA11y.unresolvedCauses`
  verbatim (present exactly when `fullyResolved` is false):

  > `for="email"` references an id not found in any analyzed source — the route is not
  > fully resolved (unresolved component `<Textbox>` at
  > `src/routes/checkout/+page.svelte:12`, spread at `src/lib/Header.svelte:4`, +2 more);
  > verify the id exists at runtime.

  Causes are listed first-three-plus-`+N more`, in `unresolvedCauses` order, so messages
  stay bounded on routes with many causes. The recommendation states the claim honestly:
  the reference could not be verified, not that it is broken.

- `href="#…"` fragments keep the sibling's exemptions (`#top`, text directives) — the
  collector already applies them before `idRefs` is built, so this needs no new code, only
  a doc statement.

## The `defaultOff` mechanism

New optional field `Rule.defaultOff?: true` — internal surface only (`Rule` is not part of
the `index.ts` public promise; the public-surface doc's `ScoreModel` note records that
deliberately). Honored in exactly three places:

- `selectRules` (core): a `defaultOff` rule with no entry in `config.rules` is not
  selected. An explicit entry — any severity, or an options object — is the only
  enablement path.
- `severityOf` (core, inventory side): same condition returns `undefined`, so a disabled
  `defaultOff` rule contributes nothing to any Health denominator. A user who never opts
  in sees identical scores before and after this rule ships — the score-semantics freeze
  is not disturbed. When enabled, the rule's severity weight joins the `a11y::route` pair
  like any other rule.
- `resolveRuleSelection` (cli): `--rules` force-enables by _deleting_ `'off'` entries and
  never materializes one, which under the two rules above would make
  `--rules a11y/unverified-id-ref` a silent no-op — exactly the lever-that-does-nothing
  class this repo guards against. The materialization is defined on the **post-delete**
  state: after the existing allow-loop has processed an allowed id (deleting a bare
  `'off'`, stripping `severity: 'off'` from an object), an allowed `defaultOff` rule whose
  map entry ends up absent gets one materialized with the rule's declared severity
  (`info`). This covers both the config-absent case and the config-`'off'`-then-deleted
  case — a team config disabling the rule must not turn a dev's explicit
  `--rules a11y/unverified-id-ref` into a no-op. (A surviving options-only object already
  counts as an explicit entry and needs nothing.)

`selectRules` and `severityOf` must share the absent-means-off decision through one
helper, not two copies of the condition.

Enablement is the ordinary rules map — `rules: { 'a11y/unverified-id-ref': 'info' }` (or
`'warning'`; the severity is the user's) — in the config file or `--rules` on the CLI.
An `overrides` entry is **not** an enablement path and the docs must say so: overrides
apply to results after analysis (issue #385's recorded semantics), so an unselected rule
produces nothing for them to touch, and per-route selection could not be scored anyway —
the inventory has no route axis. Overrides work normally once the rule is enabled
globally (e.g. scoping it `'off'` for a route subtree). Unknown-id validation, `explain`,
docs links, and the rules index treat the rule as fully ordinary.

## Lever guards and the `skipped` surface

- **Guard 1 (observable effect, no exceptions):** the kitchen-sink's
  `/gallery/a11y/skipped` route already carries the exact defect this rule exists for — a
  dangling `<label for="phantom-input">` on a spread-and-dynamic-id-poisoned route. The
  static e2e gains one scoped invocation with `--rules a11y/unverified-id-ref` asserting
  (a) the PENALIZED finding on that route and (b) the message names at least one concrete
  cause with file and line. That `--rules` run turns the sibling off by construction, so
  "the sibling is unchanged" is not assertable there — it is already pinned by the
  default run's `expected-findings.json` counts, which this feature must not move. The
  meta-test's `expected-findings.json` entry uses the `inert` class with the reason
  "default-off; exercised by the scoped e2e invocation" — the default run must show zero
  findings _and_ zero passes for it. `expected-findings.rendered.json` gains the same-key
  `0` entry the build e2e's key-set pin requires.
- **Guard 2 (empty selection warning):** two distinct cases, two judgments.
  In **source mode**, enabling the rule on a project where every route is fully resolved
  means it examines nothing — a _legitimate_ state (the healthy-project case, the same
  judgment recorded for leftover inline directives), so no warning fires.
  In **rendered mode** (`vite build`), the prerendered document is always fully resolved,
  so the enabled rule is _structurally_ inert — never a legitimate selection. The vite
  plugin's build path logs one notice when its resolved config selects this rule:
  "`a11y/unverified-id-ref` has no effect in rendered mode — the prerendered document is
  always fully resolved." The dev dashboard needs no notice: its whole-project static
  layer runs `analyzeProject` (source mode), where the rule works; only the per-request
  live layer shares rendered mode's inertness, and the static layer covers the gap.
- **The `skipped` map and CLI warning are unchanged.** `a11y/no-missing-id-ref` really did
  skip those routes; that record stays true whether or not the sibling ran. The report's
  `rules` evidence shows the sibling's findings/passes alongside, which is the signal that
  the routes were covered open-world.

## Precision gate (before release)

Reach is measured; precision is not. After implementation, run the built CLI with
`--rules a11y/unverified-id-ref` across the measurement corpus (the ecosystem apps plus
svelte-commerce, same clones/SHAs where possible), collect every PENALIZED finding, and
classify a sample of ~30 across apps by hand: true dangling reference vs. id that in fact
exists inside an unresolved component / `{@html}` payload. Record counts, the sample
classification, and the per-app finding volume in
`docs/superpowers/specs/2026-08-21-unverified-id-ref-precision-measured.md`.

The gate's outcome is wording, not shipping: the rule is opt-in, so a poor precision
number does not block release — it goes verbatim into the rule's docs page and the
changeset ("in a nine-app measurement, X of Y sampled findings were real"), so an opting-in
user knows what they are buying. A catastrophic result (near-zero real findings) would
instead be grounds to stop and rethink in a follow-up design — record it and stop rather
than shipping noise.

## Tests

- core unit (`packages/core/test/`): route selection (fully resolved route excluded,
  `refs: 0` route excluded, non-resolved route with refs included); matching against
  branch/each/app.html candidates; message cause-listing including the `+N more` cap and
  the zero-cause impossibility (causes are present whenever `fullyResolved` is false —
  asserted, not assumed); PASS emission; `defaultOff` honored by `selectRules` and by
  `buildInventory` (absent → not selected, zero weight; present → selected, weighted).
- cli (`packages/cli/test/`): `--rules a11y/unverified-id-ref` force-enable materializes
  the entry in both the config-absent case and the config-file-explicit-`'off'` case (the
  post-delete resolveRuleSelection fix); config-file enablement end-to-end on a fixture
  with a skipped route (`basic-project`'s `/smt-spread` works); disabled by default —
  `analyzeProject` with default config selects the rule nowhere and reports no evidence
  row for it.
- vite (`packages/vite/test/`): the build-path notice fires when the resolved config
  selects the rule, and does not fire otherwise.
- kitchen-sink e2e: the scoped invocation under Guard 1.

## Docs and chores

- New rule page en/ja (`docs/src/content/docs/rules/a11y/unverified-id-ref.md` + ja): what
  the claim is (_unverifiable_, not _missing_), that it is **opt-in and why** (the
  zero-false-positive default), how to enable it (rules map or `--rules`; overrides
  cannot enable it), that it is **source-mode only** (rendered mode never produces a
  non-resolved route), the division of labor with `a11y/no-missing-id-ref` (closed routes
  vs. open routes, never both on one route), and — after the precision gate — the
  measured precision. The page's `description` frontmatter (which the generated rules
  index echoes) leads with "Opt-in:", and the rule's `rationale` (what `explain` prints)
  states the opt-in status too, so both first-scanned surfaces carry the marker.
  Cross-link both sibling pages; `translate:stamp` both pairs.
- Registration chores per AGENTS.md: `rules/index.ts` three places, `gen:rules-index`,
  `gen:skills`, kitchen-sink meta-test entry.
- Changeset: minor for `@svelte-vitals/core` and `svelte-vitals`, stating the rule is
  opt-in and scores are unchanged for everyone who does not enable it.

## Non-goals

- Widening the sibling's closed world itself (C-6 pretender mapping, resolving into
  `node_modules` sources): every such remedy is bounded near 8 of 286 routes by the
  measurement; none ships here, and C-6 should not proceed without a design that engages
  that number.
- Changing the `skipped` surface, the CLI warning, or any default-run behavior.
- A generic default-off framework beyond the one field (`defaultOff` has one consumer; a
  second default-off rule can generalize when it exists).
