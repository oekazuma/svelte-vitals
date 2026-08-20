# no-missing-id-ref skip visibility — design

## Problem

`a11y/no-missing-id-ref` runs only on routes whose composition is fully resolved
(`ResolvedA11y.fullyResolved`, decided in `2026-08-14-a11y-category-design.md`). Issue #533
measured the consequence on real apps: 0/41 routes run on kener, 0/54 on svelte-commerce,
3/25 on CMSaasStarter — and a skipped route produces no result, so a report where the rule
never ran is indistinguishable from one where it passed everywhere. Real defects (dangling
`<label for>` in svelte-commerce's checkout) go unreported with no trace that anything was
skipped.

Two separable problems: the silence (observability) and the narrow applicability (widening
the closed world). This design fixes the silence and turns the report into the measurement
harness for the widening decision. **The widening mechanism itself is out of scope** — issue
#533 records that several shapes each hit a different wall, and roadmap item C-6 (pretender
mapping) is one input, not the conclusion: svelte-commerce carries spreads and
expression-valued ids on 54/54 routes, so component mapping alone recovers roughly zero
there. A follow-up design picks the mechanism from the numbers this design produces.

## Collection (packages/cli, source mode)

Everywhere the composition clears `fullyResolved`, record a cause instead of only flipping
the boolean:

- `ParsedA11y.unknowableContent: boolean` becomes
  `unknowable: { kind: 'spread' | 'html'; line: number }[]` (the boolean is
  `length > 0`). Parses are cached per file, so locations are recorded once per file.
- The unresolved-component branch in `composeA11y` records
  `{ kind: 'component', detail: <component name>, file, line }`. Depth truncation and
  cycle cuts share the kind — they are rare and the user action is the same.
- An expression-valued id records `{ kind: 'dynamic-id', file, line }` per node.

`ResolvedA11y` gains an optional
`unresolvedCauses?: { kind: string; file: string; line: number; detail?: string }[]`,
present exactly when `fullyResolved` is false. Causes are deduplicated by
`(kind, file, detail)` keeping the first line: this bounds the list on spread-heavy files
while keeping every distinct unresolvable component name per route — the datum the C-6
measurement needs. Rendered mode (vite) sets `fullyResolved: true` unconditionally (the
prerendered document is its own closed world) and is unchanged.

## Reporting (JSON + CLI warning)

- `JsonReport` gains an optional field, keyed by rule id:

  ```ts
  skipped?: Record<string, Array<{
    route: string;
    refs: number; // the route's literal id-reference count (idRefs.length)
    causes: Array<{ kind: string; file: string; line: number; detail?: string }>;
  }>>;
  ```

  `refs` is what makes the report a sufficient measurement input: a route the rule would
  still say nothing about once unlocked (`idRefs.length === 0`) must be excludable from
  "remedy S unlocks N routes" without re-instrumenting. Only `a11y/no-missing-id-ref`
  populates the field today; the shape is rule-keyed so the same-silence `elementsClosed`
  gate (`a11y/required-element`'s "missing" claim) can join later without a schema change.
  The shape stays inline in `JsonReport` — no new named export from `index.ts`, keeping the
  public surface type-closed. `2026-08-16-v1-public-surface.md` explicitly allows new
  optional `JsonReport` fields in a minor, and requires the reporters guide to document the
  shape field-for-field.

- `buildJsonReport` gains one optional parameter (the `examined` pattern); the CLI
  assembles the entries from `ResolvedA11y` for routes the run analyzed, and only when the
  rule is selected — a run that deselected the rule must not report skips for a rule that
  was never going to run. Like `examined`, the field describes the analysis, not the
  report: `--diff`, `--baseline`, and suppressions do not narrow it. Scores, findings,
  summary, and examined counts are untouched — the a11y design's "a skipped route emits
  nothing" stays true for results.

- The CLI pushes one line onto the existing `warnings` channel when the rule is selected
  and at least one analyzed route was skipped:
  `a11y/no-missing-id-ref skipped 22 of 25 analyzed route(s) (unresolved component 20, spread 15, {@html} 4, dynamic id 5 — per-route detail in the JSON report's "skipped").`
  Analyzed routes split three ways — skipped (`!fullyResolved`), ran (`fullyResolved` with
  id references), and nothing-to-check (`fullyResolved`, zero references, no result) — so
  the warning states only the skipped/analyzed ratio and never implies ran = analyzed −
  skipped. Each per-kind count is the number of skipped routes carrying that kind; a route
  usually carries several kinds, so the counts overlap and do not sum to the skipped total.
  On real apps this prints on nearly every run until a widening lands; that is the point —
  the silent state was the lie. The markdown reporter and the vite dashboard are out of
  scope (the dashboard is rendered-mode and never skips).

## Measurement (input to the widening design)

With causes in the report, issue #533's hand instrumentation becomes "run the built CLI,
read the JSON". One-off, against the ecosystem corpus (kener, svelte-commerce,
CMSaasStarter, and the rest of `scripts/ecosystem-smoke.js`): for each route take its set
of cause kinds (and distinct component names), then compute how many routes each candidate
remedy set unlocks — C-6 mapping alone, plus spread handling, plus dynamic-id handling, and
combinations. A route is unlocked by remedy set S iff its causes ⊆ S **and** `refs > 0` —
an unlocked route with no literal id references still produces nothing, and counting it
would inflate every remedy. Results go in a
`*-widening-measured.md` spec; the aggregation script is throwaway and is not committed.
The widening design consumes that table.

## Tests and docs

- cli unit tests: one fixture per cause kind asserting kind, location, and detail; a dedupe
  fixture (same component used twice in one file → one cause).
- kitchen-sink e2e: plant a route carrying a `<label for>` with no matching id next to a
  spread attribute and a dynamic id, and assert the report's `skipped` entry lists both
  causes and the CLI warning line appears. This is the observable-effect guard for the new
  surface. The svelte-commerce shape (a package component) is covered by the cli unit tests
  instead: the kitchen-sink prerenders every route (`adapter-static`), so a package
  component sample would add a real dependency for one line. Rendered mode still runs the
  rule on the new route, so the dangling `for` becomes a rendered finding — the static/
  rendered contrast the docs describe, pinned in `expected-findings.rendered.json`.
- reporter tests: `skipped` field shape (including `refs`); absent when no route skipped;
  absent in rendered mode.
- Rule page (en + ja) documents the skip surfacing and how to read it, and the reporters
  guide documents the `skipped` field field-for-field (the freeze doc's condition for
  additive `JsonReport` fields); `translate:stamp` after. Changeset required (user-facing). No new flag, rule, or docs topic — no generated
  artifacts to refresh.

## Non-goals

- Choosing or implementing the widening mechanism (C-6 pretender mapping, reduced-confidence
  open-world reporting, or anything else).
- Skip surfacing for `elementsClosed`-gated claims (`a11y/required-element`); the report
  shape accommodates it, nothing more.
- Markdown reporter / dashboard rendering of skip data.
