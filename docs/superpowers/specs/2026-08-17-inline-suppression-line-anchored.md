# Inline suppression for line-anchored findings — design

Phase C-3 of `2026-08-16-v1-roadmap.md`. The a11y category design recorded this as a follow-up
rather than half-implementing it (`2026-08-14-a11y-category-design.md`, "Inline suppressions"):
`svelte-vitals-disable-next-line` is consumed by `fileRule` only, so a directive above a
route-scoped finding does nothing — **silently**, with no warning.

The directive syntax is frozen surface at 1.0 (`2026-08-16-v1-public-surface.md`), so extending
what it covers has to land before the freeze.

## The class of defect this belongs to

A user-facing lever that silently does nothing while the run reports success. Verified instances in
the last few days: this directive; `--route "/blog/**"` matching zero routes and exiting 0 (`#510`);
descriptor exhaustion dropping 40% of a project with an unchanged score (`#525`); `a11y/doctype`
never running in build mode (`#517`); uppercase `ARIA-LABEL` invisible to the collector (`#524`).

That framing decides the shape of this design, because the obvious implementation reproduces the
class. See "Why not per-family wiring".

## Decisions

### 1. Suppression is central, over `Result`s, keyed by `(location, line)`

After `runRules`, every penalized result carrying a source `location` and a `line ≥ 1` is checked
against a directive index and flipped to PASS if a directive on that file and line names its rule
(or names nothing).

That makes the criterion and the implementation the same sentence, which is the whole point:
**any rule that emits a line-anchored finding is covered by construction.** No per-rule list, no
wiring step a new rule family can forget.

The stage is the output of `applyOverrides(applyRuleSeverities(rawResults, config), config)`, in
`analyzeProject` and in the plugin's `analyze` — not "after `runRules`", which is ambiguous with
three transforms in between. A directive therefore silences what survived config, and every consumer
downstream (scoring, `--fail-on`, the suppressions file, the reporters) sees one suppressed set.

The PASS a suppressed rule+route gains is labelled from the rule's own `passLabel` when it declares
one — `componentRule` passes its `label`, the a11y route factory its `passMessage` — and from the
rule's `title` otherwise. Most of the rules that emit PASSes build the text inline rather than
declaring it, so "identical to the PASS the rule itself emits" would have meant touching every one
of them; the fallback keeps the message a name for the check rather than a duplicate of the defect
message.

`fileRule` keeps its own early filter — it must, because it decides PASS versus finding before
emitting, and a file whose only finding is suppressed has to report a pass rather than nothing. The
central pass is idempotent with respect to it: a result `fileRule` already suppressed never reaches
it.

### Why not per-family wiring

The first draft of this design carried directives on `ResolvedA11y` and had route rules consult
them. It stated the criterion as "any finding with a source location and a line" while shipping
"the four a11y route rules", and the gap is not academic: `seo/single-h1`, `seo/heading-level-skip`
and the `performance` image rules are route-scoped and emit static-mode findings with a file and a
line that satisfy the stated criterion verbatim. A user would put a directive above a
`performance/image-dimensions` finding — indistinguishable from an a11y finding in the report — and
be silently ignored.

A design for removing silent no-ops must not ship one.

### 2. Where the directive index comes from

The union of every file this run parsed and collected directives from: component and Kit-module
facts when they were collected, and the route composition's chain files and resolved local
components always — the composition's parse cache, which already holds exactly that set.

The index is not narrowed to the routes `--route` selected, because narrowing it would change
nothing: a directive can only silence a result whose `location` is its file, and a route the run
filtered out produces no results at all. The extra entries are unreachable, not permissive.

The union matters because the two sources are not the same set under every invocation. `--route`
skips component-fact collection while route-scoped rules still run — measured, all four a11y route
rules fire under `--route "gallery/a11y/**"` — so an index built only from component facts would
work in a full run and silently stop working in a scoped one. That is the same failure this change
exists to remove, one level down.

### 3. A suppressed finding becomes a PASS, not a silence

Matching `fileRule`. A suppressed finding **was checked**; making it vanish would put the route in
the same bucket as one the rule skipped, and the category average deliberately excludes skipped
routes so an unchecked route cannot report a false 100.

**This diverges from the suppressions file, and the divergence is now on the record.** An inline
suppression keeps the key in the score as a PASS; the suppressions file drops the result after
scoring, so a route whose only result it was leaves the average entirely. Two mechanisms, two score
effects, for the identical finding. The inline behaviour is the defensible one and `fileRule` has
worked this way since it shipped, so the file-based mechanism is what would have to move — that is
a separate decision, recorded here rather than silently inherited.

### 4. A directive in a shared component silences that finding on every route

A component composed into twenty routes yields the same finding twenty times at the same file and
line; one directive silences all of them. The suppressions file, keyed `id::route::location`, is
per route.

That is the right default — the author is annotating one piece of markup, not twenty routes — but
it is a real difference and goes in the docs rather than being discovered.

### 5. A directive naming an unknown rule id warns

`collectSuppressions` accepts any token matching the rule-id shape, and `isSuppressed` compares by
string, so `a11y/id-duplicaton` suppresses nothing and says nothing. That is an instance of the
class this design is about, inside the mechanism it is extending, so it is fixed here: an id that
matches no registered rule is reported the way an unknown `--rules` id already is.

Note the asymmetry with the next item: an unknown id is **never** a legitimate state, while a
directive that matches no finding often is.

### 6. A directive that matches no finding stays silent by default

The author fixed the code and left the comment; a rule is turned off in config; a `--route` run
does not reach that file. All legitimate. Reporting them by default is how a warning gets muted.

Unused-directive reporting is therefore opt-in — `--report-unused-directives`, following eslint's
precedent — and for a line-anchored directive "used" is aggregated across every route before it is
judged, since one directive can serve many routes.

### 7. `--update-suppressions` interaction, pinned

An inline-suppressed finding is not penalized, so `writeSuppressions` does not record it, and an
existing entry for it becomes stale and is reported by the stale-entry warning that already ships.
This falls out of the ordering rather than needing new code — but the parent design fixed
key/suppression semantics deliberately rather than leaving them to the implementer, so it is pinned
by a test here rather than inherited by accident.

## Not in scope

- **Rendered mode.** Build-mode findings anchor to the prerendered HTML file with `line: 0`, so the
  `line ≥ 1` criterion excludes them and there is no source line for a directive to sit above. (The
  first draft said they anchor "to the route", which is wrong — they carry the HTML file path.)
- **A directive that names a route.** The syntax stays whole-line and rule-scoped; per-route scoping
  is what the suppressions file and `overrides` are for.

## Testing

1. A directive above a route-scoped finding silences it, and the rule reports a PASS for that route
   rather than nothing.
2. The same under `--route` — the case the per-family wiring would have broken.
3. A directive above a **non-a11y** route-scoped finding (`seo/single-h1`) silences it too, which is
   what makes decision 1's criterion true rather than aspirational.
4. A bare directive with no rule ids silences a route-scoped finding.
5. Partial suppression: one of two surplus representatives suppressed leaves the other firing and
   emits no PASS.
6. A directive at the unpenalized first occurrence does nothing — the documented no-op, pinned.
7. A directive in a component composed into two routes silences both.
8. A directive naming a different rule id does not silence it; one naming an unknown id warns.
9. `--update-suppressions` does not record an inline-suppressed finding, and a pre-existing entry
   for it is reported stale.
10. Rendered mode is unchanged.
11. Component-scoped behaviour is untouched.

## Recurrence prevention

Two guards, because the class has two failure modes: a lever that never worked, and a lever that
stops working.

**A meta-test that no lever ships untested.** `examples/kitchen-sink/test/e2e-suppression.test.ts`
already pins nine disable surfaces against the real gallery, each asserting an observable effect.
Route-scoped directives join it. To make "every lever has a case" enforceable rather than
aspirational, a meta-test enumerates the CLI flags from the gunshi arg declarations — already
machine-readable, since they generate the docs tables — and fails when a flag appears in no e2e test
and in no exemption list with a recorded reason. This is the same forcing function as the `allRules`
kitchen-sink coverage meta-test.

**A runtime warning when an input selects nothing**, for the cases where selecting nothing is never
legitimate:

| input                                                               | warn?                   | condition                                                                                                        |
| ------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--route` matches no route                                          | **yes**                 | only when the unfiltered route set is non-empty                                                                  |
| a directive names an unknown rule id                                | **yes**                 | always — decision 5                                                                                              |
| a `--rules`-selected rule whose fact source the run's scope skipped | **yes**                 | e.g. a component-scoped rule under `--route`, silent today                                                       |
| `--rules`/`--ignore` unknown id                                     | already fatal           | no change                                                                                                        |
| stale suppressions entry                                            | already ships           | no change                                                                                                        |
| `overrides` glob matches nothing                                    | **yes, full runs only** | gated like stale-suppression reporting, since under `--route`/`--diff` most overrides legitimately match nothing |
| a directive matches no finding                                      | **opt-in only**         | decision 6                                                                                                       |

**And the rule that outlives this document**, recorded in AGENTS.md so it is read every session: a
user-facing lever ships with (1) a kitchen-sink e2e case asserting an observable effect and (2) a
runtime warning when it selects nothing on a full run.
