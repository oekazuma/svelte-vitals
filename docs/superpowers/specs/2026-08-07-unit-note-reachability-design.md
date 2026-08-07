# The unit note asks about usage where it should ask about reach — design

**Date:** 2026-08-07
**Status:** proposed
**Origin:** a field measurement of `architecture/reserved-name-placement` on a real project, 2026-08-06. The
rule reported a declaration as checking nothing when the project's convention document permits that position and
it is simply not used yet.

## The problem, measured in both directions

`architecture/reserved-name-placement` emits one aggregated project-scoped finding naming every declaration that
is not checking what it says. Three reasons: a glob that matched no directory, one whose matches were all
excluded, and — for the two unit maps — one that "matched directories but never a unit".

**That third reason asks the wrong question.** Measured on the shipped 0.41.x rule:

| case                                                               | config                                                                                                                           | what ships today                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **A** — the convention permits a position that is currently unused | `anyCaseUnitPlacements: { types: 'src/**' }`, the one `types/` in the tree sitting under `src/lib/db`, which `placements` covers | **reports** `matched directories but never a unit` |
| **B** — a real configuration mistake                               | `capitalisedUnitPlacements: { parts: 'src/lib' }`, a unit at `src/lib/Card` holding `parts/`                                     | **one violation, no diagnostic at all**            |

Both are backwards. In A the declaration is correct — the convention permits `types/` under a unit of either
case, no such directory exists yet, and the glob `src/**` reaches plenty of real units. In B the declaration is
wrong: a unit map's glob is matched against the unit itself, so `src/lib` permits `parts/` only under a unit
named exactly `src/lib`, which can never exist under the capitalised predicate. The user meant `src/lib/**`, and
the rule answers by reporting their correctly-placed `parts/` as misplaced while saying nothing about the glob
that caused it.

### Why: the note measures usage, and every other reason measures reach

`nonUnitParents` is filled inside `record()`, which runs only at the parent of a directory whose name the
project declared. So the note fires when _the name was seen somewhere the glob reached and that place was not a
unit_ — a statement about which declarations did work, not about which could.

The rule already settled this question the other way, one release ago. The reachability guard exists because an
earlier version reported a correct-but-unexercised declaration as "matched no directory"; its comment reads:

> Usage means "permitted a position", which a glob naming real directories the name never appeared in never
> does — and a declaration saying where a name MAY sit is not dead for going unused, so calling it unmatched
> would be a false claim.

**The unit note is the same false claim in the one place that guard does not reach.** A declaration is not dead
for going unused; it is dead for being unable to reach anything.

## The design

**Ask whether the glob reaches a unit of the kind its map requires, anywhere in the tree.**

```text
for each unused alternative from a unit map:
  the glob matches at least one directory that is a unit of that map's kind  → silent
  otherwise                                                                  → note
```

Nothing else about the rule changes. `placements` has no unit requirement and is untouched.

Verified against the real `isUnitDir`, `isAnyCaseUnitDir`, `childFiles`, `createKeyCompiler` and
`keysMatchingAny`, on the two measured trees plus a control:

| glob         | map         | units the glob reaches | note under the new predicate | today   |
| ------------ | ----------- | ---------------------- | ---------------------------- | ------- |
| `src/**`     | any-case    | `src/lib/Card`         | **silent**                   | reports |
| `src/lib`    | capitalised | none                   | **reports**                  | silent  |
| `src/lib/**` | capitalised | `src/lib/Card`         | silent                       | silent  |

Both measured cases invert, and the control — the corrected glob a reader should have written — stays silent.

### The message changes with the question

`matched directories but never a unit` describes what the traversal saw. The new note describes what the glob
can reach: it names no unit of the kind the map requires. The exact wording is an implementation choice, but it
must not say "matched" — that word is what makes the current message a usage claim.

### Ordering against the excluded reason

The classification is a hierarchy, most specific first. The shipped order runs the unit reason **before** the
excluded/unmatched split, and a test pins that. Under the new predicate the order must reverse:

```text
matches no directory at all                              → matched no directory
matches directories, all of them excluded                → matched only excluded directories
matches live directories, none a unit of the kind        → the new unit note
otherwise                                                → silent
```

A glob whose every match was pruned should say so — "remove or narrow the exclusion" is the action — and only a
glob with live reach should be judged on whether that reach includes a unit.

**The unit set is built from the whole tree, not from the unexcluded part.** Being exact would mean resolving
`exclude` for every directory rather than only for the reserved-name directories the traversal visits, which is
a second traversal for a case the excluded reason already reports. The consequence: a glob reaching only
excluded units is reported as `matched only excluded directories`, which is true and actionable, rather than as
a unit-reach failure. Recorded as a deliberate simplification, not an oversight.

**The existing ordering test must be rewritten, not deleted.** `claims the unit reason for a glob that also
matched an excluded directory` was added specifically to pin the shipped order, and it is load-bearing — the
previous branch verified it fails under inversion. Its fixture declares `capitalisedUnitPlacements: { parts:
'src/lib/*' }` with `exclude: ['src/lib/parts/**']`, and under the new order it must assert the excluded reason
instead. Deleting it would leave the new ordering unpinned, which is the failure mode this repository keeps
finding.

## What this does to the rule's documentation, which has now said three things

The rule page currently reads:

> This catches the bare-glob mistake above **only** where the reserved name sits directly in the glob's own
> directory.

That sentence is itself a correction. The page originally claimed the note catches the bare-glob mistake; a
review proved by execution that it does not, in the common shape, and the claim was narrowed. **This design
makes the original claim true**, so the narrowing comes back out.

Worth stating plainly rather than quietly re-reversing: the page needed two corrections because the predicate
was answering a question nobody wanted answered. A doc that will not sit still is evidence about the code under
it. Both language pages change together.

## Testing

1. **Case A stays silent.** A declaration whose glob reaches a real unit, where the name currently appears only
   somewhere else that another map covers. This is the field's report, and it fails today.
2. **Case B reports.** A bare glob in a unit map, with a real unit below it that the glob cannot reach. This
   also fails today — in the other direction, by reporting nothing.
3. **The control stays silent.** The same tree as case B with the glob corrected to `src/lib/**`. This is what
   separates reach from usage: in case B the name is not seen under any unit **and** the glob reaches none, so
   an implementation that kept asking about usage would report both B and the control. Only the control tells
   the two questions apart, and only it distinguishes the fix a reader is being pushed towards from the mistake.
4. **The two maps do not borrow each other's units.** A glob reaching only a lowercase unit, declared in
   `capitalisedUnitPlacements`, must report; the same glob in `anyCaseUnitPlacements` must not. The predicate is
   per map and nothing else in the suite pins that.
5. **The new ordering.** The rewritten fixture above: a glob whose matches are all excluded reports the excluded
   reason, not the unit reason. Verify it fails if the order is put back.
6. **`placements` is untouched.** A `placements` declaration reaching only non-units stays silent — it has no
   unit requirement, and a predicate applied to the wrong map would be invisible otherwise.
7. **The aggregation still holds.** One project-scoped finding carrying every bad declaration, `route` and
   `location` unset. Changing a reason must not change the shape.

Each of 1, 2 and 5 must be verified to fail before the change — 1 and 2 are the measured cases and 5 is the
ordering reversal. A test that passes beforehand is not pinning this design.

## Release

`@svelte-vitals/core` **patch**, plus `svelte-vitals` and `@svelte-vitals/vite` as the packages that ship the
rule. The rule's findings do not change; only which declarations the aggregated diagnostic names. A project
that was being told to fix a correct declaration stops being told that, and one with a dead glob starts.

## Deliberately not solved

- **Reporting a declared position that is legitimately unused.** The field's convention document declares every
  permitted position, including ones no directory occupies yet, and after this change they are silent. That is
  the intent: the current message tells a reader to "correct the glob or the name, or remove the declaration",
  which for a future-facing position is advice to delete a check they will want. Whether an opt-in "declared but
  unoccupied" report is worth having is a separate question, and the existing "declared name that never appears"
  entry already records the undecidable half of it.
- **Excluded units.** Above: the unit set spans the whole tree, so a glob reaching only excluded units reports
  the excluded reason.
- **`placements` globs that reach no plausible parent.** A `placements` glob matching real directories that
  could never hold the name is undiagnosable without knowing the convention, and the rule does not know it.
