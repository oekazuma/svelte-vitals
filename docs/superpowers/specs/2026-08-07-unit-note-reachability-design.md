# The unit note asks about usage where it should ask about reach — design

**Date:** 2026-08-07
**Status:** approved; reviewed 2026-08-07
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

`placements` has no unit requirement and is untouched. Two things do go with the change: `nonUnitParents` and
the push that fills it inside `record()` become dead and are deleted, and `classifyUnusedKeys` stops being this
rule's classifier — see below.

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

### The excluded reason has the same defect, inherited the same way

A first draft of this design proposed only reordering the two passes. Review found that the excluded reason is
**also** usage-derived, and for the same structural reason.

`classifyUnusedKeys` marks a key `only-excluded` when it matches **at least one** recorded excluded directory.
In `reserved-directory-names` that is exactly right, because there a key that matches any live directory is
recorded as used — so "unused and matches an excluded directory" really does mean the excluded ones were its
only matches. **This rule does not have that property.** `usedAlternatives` is recorded only where an
alternative _permitted a position_, so an alternative can reach live directories, be entirely correct, and
still be unused.

Executed: `capitalisedUnitPlacements: { parts: 'src/lib/*' }` on a tree with a live unit at `src/lib/Panel` and
an excluded `src/lib/legacy/parts/`. The glob reaches a live capitalised unit — the declaration is correct and
live — and the rule reports `matched only excluded directories`. Reordering alone does not fix it, because the
label is wrong regardless of when it is claimed.

`excludedDirs` is also incomplete: it holds only the parents of reserved-name directories the traversal
actually visited and found excluded. So a glob whose only units are excluded, where none of those units happens
to hold a declared name, is in `excludedDirs` nowhere — and under a whole-tree unit set it would go silent
entirely, which is worse than today's wrong label.

**So all three reasons become reach questions, against the same two sets.** Compute the live directories once —
every directory the rule saw, minus the ones the globally resolved `exclude` prunes — and the live units of each
kind from that:

```text
reaches no directory at all                          → matched no directory
reaches directories, none of them live               → matched only excluded directories
reaches live directories, none a live unit of the kind → the new unit note   (unit maps only)
otherwise                                             → silent
```

This is one pass over the directory list with `isExcluded`, which the rule already imports; it replaces
`classifyUnusedKeys` for this rule and removes both false-positive classes above. **Only the globally resolved
`exclude` is used**, matching the rule's existing decision that only globally resolved declarations are
diagnosed at all.

### The ordering test does not pin the order, and finding out why matters more than the test

The spec's first draft claimed this test was load-bearing because the branch that added it verified it fails
under inversion. **That verification was real and the claim is now false**, and the reason is worth recording.

Executed: with the two passes genuinely swapped, all 28 tests pass. Then, restoring `excludedDirs.push(dir)` —
the semantics in force when the test was written — **and** keeping the inversion, the test fails as originally
observed.

So a later fix on that same branch hollowed it out. `5c27abfb` changed `excludedDirs` to record the excluded
**parent** rather than the reserved-name directory, which was correct and has its own test. Its fixture no
longer reaches the excluded path at all: `exclude: ['src/lib/parts/**']` does not exclude `src/lib`, so nothing
is pushed, and the test passes under either order. Nothing signalled this, because the test kept passing.

**A test verified load-bearing stays load-bearing only against the code it was verified against.** That is the
argument for re-running mutation checks after any change to shared bookkeeping, not just after changes to the
code under test.

The replacement fixture is `['src/lib/legacy/parts/a.svelte']` with `exclude: ['src/lib/legacy/**']`, where the
excluded directory is the reserved name's _parent_.

**Corrected after execution.** This paragraph originally required that fixture to populate `excludedDirs` and
claimed it "reports `matched only excluded directories` today, so it discriminates". Replayed against the
shipped rule, it emits **no note at all**: a glob using a single `*` matches at the reserved-name directory's
level rather than at the recorded excluded parent, so nothing is ever shadowed and the excluded reason
under-fires. The `excludedDirs` requirement is also moot — that bookkeeping is what this design deletes, so
there is nothing left for a fixture to populate. The fixture is still the right one, for the opposite reason to
the one given: it fails beforehand rather than passing, and under this design it must report the excluded reason
while a unit-reachable glob does not.

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
3. **The control stays silent.** The same tree as case B with the glob corrected to `src/lib/**`.
   **Corrected after execution:** this item claimed that "an implementation that kept asking about usage would
   report both B and the control". It would not, and the table two dozen lines above already says so — with
   `parts/` sitting under the one unit the corrected glob reaches, the alternative is _used_, and a usage-based
   implementation never classifies it at all. As written this fixture passes before and after and separates
   nothing. The fixture that does tell reach from usage puts the reserved name somewhere that is not a unit, so
   the alternative is genuinely unused while the corrected glob still reaches a real unit; that is the shape to
   test, and it is what distinguishes the fix a reader is being pushed towards from the mistake.
4. **The two maps do not borrow each other's units.** A glob reaching only a lowercase unit, declared in
   `capitalisedUnitPlacements`, must report; the same glob in `anyCaseUnitPlacements` must not. The predicate is
   per map and nothing else in the suite pins that.
5. **The excluded reason, on a fixture that reaches it.** `['src/lib/legacy/parts/a.svelte']` with
   `exclude: ['src/lib/legacy/**']` — the excluded directory is the _parent_, so `excludedDirs` is populated
   and the excluded path is actually exercised. The old fixture could not do this and therefore pinned nothing.
6. **A live-unit-reaching glob is not called excluded.** The false positive review found: a glob reaching a live
   unit **and** an excluded directory must be silent. This fails today, and it is the case reordering alone
   would not have fixed.
7. **The unit set is the live one.** A glob whose only unit of the required kind is excluded, where that unit
   holds no declared name, must report the unit note. Under a whole-tree unit set it goes silent instead — and
   nothing else here distinguishes the two, so an implementation that skips the exclusion filter passes
   everything above.
8. **The bare-prefix guard holds inside the new predicate.** A glob `x/**` whose only unit of the kind is `x`
   itself must still report: the guard means `x/**` does not reach `x`. Without this a compiler call missing
   `bareGuard` is invisible.
9. **`placements` is untouched.** A `placements` declaration reaching only non-units stays silent — it has no
   unit requirement, and a predicate applied to the wrong map would be invisible otherwise.
10. **The aggregation still holds.** One project-scoped finding carrying every bad declaration, `route` and
    `location` unset. Changing a reason must not change the shape.

Items 1, 2, 5, 6 and 7 must be verified to fail before the change — they are the behaviours this design alters.
**Corrected after execution:** item 5 was listed here as passing today and guarding the excluded path against
the rewrite. It fails today too, by the measurement recorded above — the shipped rule emits no note at all for
its fixture. A test that passes beforehand and is not named here as a guard is not pinning anything.

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
- **A glob scoped to a subtree whose units do not exist yet.** `capitalisedUnitPlacements: { parts:
'src/lib/newarea/**' }`, with units elsewhere but none under `newarea`, is silent today and reports under this
  design. Review found it and it is a real behaviour change, not covered by the bullet above. It is kept, for
  consistency: `matched no directory` already reports a glob naming a directory that does not exist yet, and a
  glob naming no unit yet is the same claim one level down. The message says what is missing rather than telling
  the reader to delete the declaration, which is the part of the current wording that made case A harmful.
- **`placements` globs that reach no plausible parent.** A `placements` glob matching real directories that
  could never hold the name is undiagnosable without knowing the convention, and the rule does not know it.
