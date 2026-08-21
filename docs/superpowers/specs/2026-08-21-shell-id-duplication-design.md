# Shell-id duplication (roadmap C-7) — design

## Problem and decision

`a11y/id-duplication` counts duplicates within a composed route, but source mode never sees
`src/app.html`: a route id colliding with a shell id is silent there, while rendered mode —
reading the prerendered document, shell included — fires. The divergence is documented (the
a11y rule-validity review's P3 row) and the roadmap queued the fix as C-7, flagging "the
findingKey-for-out-of-route-location decision" as the reason it must precede the freeze.

The decision this design makes is to never need an out-of-route location: the shell
occurrence is always the first, never-penalized representative, so every finding this
change adds sits in a route file and `findingKey` (`id::route::location`) keeps its
existing key space untouched. Nothing here blocks or constrains the freeze.

## Collection: shell ids gain lines

`Project.appHtmlIds` changes from `string[]` to `{ id: string; line: number }[]`
(`Project` is internal — not exported from core's `index.ts` — so this is a free type
change). `detectAppHtmlIds` (`packages/cli/src/providers/source/project.ts`) computes the
line from each match's offset — and because its stripping (comments, `<script>`,
`<style>`) currently deletes the newlines inside stripped regions, the stripping becomes
**newline-preserving** (each stripped region is replaced by its own newlines), so offsets
taken on the stripped string still yield correct lines for ids below multi-line comments.
The templating-placeholder rejection stays. First occurrence wins per id — the function
already dedupes, and shell-internal duplicates are out of scope (Non-goals). The one
existing consumer (`idCandidates` in `resolveRoute`) maps to `.id`.

## Merge: on collision only, post-fold, always first

In `resolveRoute` (`packages/cli/src/providers/source/routes.ts`), after the `ids` map is
built from the branch-aware fold:

- For each key of the **folded** map that matches a shell id, **prepend** a synthetic
  representative `{ file: 'src/app.html', line }` to that id's representative list. The
  match iterates the folded map's own keys against a `Set` of shell ids — never by
  indexing the record with shell ids, which for a shell `id="constructor"` would read
  `Object.prototype` and fabricate a shell-only entry.
- **Post-fold matching** inherits the existing counting semantics for free: an id that
  lives only in a `{#each}`/snippet body (repeatable — excluded from the map today) still
  collides with nothing, and branch folding has already picked the route-side
  representatives.
- **Prepend, not sort.** `representativeOrder` ranks non-chain files after every chain
  file, so whenever the colliding id sits in a chain file, sorting the shell
  representative in would place it after the route occurrence and penalize the shell —
  the inversion of this design. (In the component-only case the path tiebreak would
  happen to put `src/app.html` first, which is why the failure would be intermittent and
  worth pinning.) The shell renders outermost and always; it is first by construction,
  and the spec pins that as a statement, not an implementation accident.
- A shell id with no route collision never enters the map: no phantom entries, no PASS
  result anchored at `src/app.html` (a PASS is only emitted when no id has a surplus, and
  a merged shell representative implies a surplus).

Consequences: `surplusRule` penalizes every representative after the first, so a route id
colliding with the shell yields exactly one finding per route occurrence, located at the
route file and line. Suppressions, baselines, `--diff`, inline directives, and reporters
all see ordinary route-file findings. One recorded blind spot follows from the same
decision: `--diff`/`--staged` filter by `r.location`, so an edit that only adds a
colliding id to `src/app.html` never surfaces in a diff-scoped run — the finding exists
only on full runs. Inherent to "never an out-of-route location"; recorded so it is not
rediscovered as a bug.

## Message: name the shell

`surplusRule`'s `message` callback gains the entry's first representative as a fourth
argument — `message: (key, i, n, first: A11yOccurrenceInfo)` — existing callers ignore it.
`a11y/id-duplication` uses it: when `first.file === 'src/app.html'` the message reads

> Duplicate id "x" — also defined by the src/app.html shell (line N)

and stays `Duplicate id "x"` otherwise. Without this, a shell collision produces a finding
whose counterpart occurrence is invisible from inside the route, and the user hunts for a
duplicate that no route file contains.

## Mode parity and docs

Rendered mode already detects shell collisions (the prerendered document includes the
shell); this change closes that documented divergence rather than adding a new behavior
class. The `a11y/id-duplication` rule page's Mode differences section (en + ja) drops the
divergence and states the shared behavior — source mode names the shell in the message,
rendered mode anchors at the route as it always has. `translate:stamp` the pair.

## Tests and chores

- cli unit (`packages/cli/test/`): `detectAppHtmlIds` line capture (single, multiple,
  quoted/unquoted, after comment stripping — lines still count stripped regions'
  newlines); merge behavior in `source-provider.test.ts`: collision → shell rep first with
  its line, no collision → no shell entry in `ids`, repeatable-only route id → no
  collision, collision id also still present in `idCandidates`.
- core unit (`packages/core/test/a11y-route-rules.test.ts`): the `surplusRule` message
  extension — id-duplication emits the shell-naming message when the first representative
  is `src/app.html`, the plain message otherwise; existing rules unaffected.
- kitchen-sink: `src/app.html` already carries `id="shell-root"`; plant one route-side
  `id="shell-root"` on an **existing element** (so no other rule is brushed) in a
  prerendered route **outside `gallery/a11y/**` and outside `clean/**`** (the clean
  canaries are pinned defect-free). Bump `a11y/id-duplication` in
  `expected-findings.json`; rendered mode already counts this collision, so the rendered
  expectation moves by the same amount, which doubles as the mode-parity check.
  **One recorded test change comes with the plant:** `e2e-suppression.test.ts`'s
  route-scoped-directive test asserts absolute project-wide id-duplication counts
  (`1` before the dup-x directive, `0` after) on its full-run iteration, so any plant
  anywhere breaks it — no route choice avoids that, because `findings()` reads the
  project-wide `rules` map. Those two assertions become **relative**
  (`findings(after) === findings(before) − 1`, `passed(after) === passed(before) + 1`),
  which still pins exactly what the test exists for — the directive silences one finding
  and synthesizes one PASS — while surviving unrelated gallery growth. Keeping the plant
  outside `gallery/a11y/**` additionally preserves the scoped iteration's original
  1-before/0-after arithmetic under the relative form.
- Changeset (core + cli, minor), following AGENTS.md's new-arm convention: `findingKey`
  is `id::route::location` with **no line component**, so a project with an existing
  suppressed `a11y/id-duplication` entry at the same route and file has the new
  shell-collision finding **already pre-suppressed** — the changeset must say so.
  Projects without such entries see new findings; `--update-suppressions` adopts them in
  one run.
- No config lever is added, so the two-guard convention's warning half does not apply; the
  kitchen-sink sample is the observable-effect guard.

## Non-goals

- **Shell-internal duplication** (the same id twice inside `app.html`): reporting it
  per-route would emit one finding per analyzed route for a single defect, so it needs a
  project-scoped arm — a different finding class and its own design. `detectAppHtmlIds`'s
  dedupe keeps it invisible today; recorded here so the omission is a decision.
- Landmark or heading merging from the shell; only ids.
- Any change to rendered-mode collection.
