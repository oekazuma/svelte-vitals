# architecture/reserved-name-placement — design

**Date:** 2026-08-06
**Status:** approved; field-measured 2026-08-06
**Charter row:** verdict #4 — M4, "a reserved name may appear only in the places declared for it" (L3)

## The problem

`architecture/reserved-directory-names` (M3) says **"at this position, only these names."** It cannot say
**"this name, only at these positions."** A `parts/` directory sitting where the convention does not allow it
is invisible unless that position is itself declared, which for a name that may appear in several kinds of
place it never is.

The regression this catches is specific and was measured: a convention-driven reorganisation moved a large
number of directories into `parts/`. **A misplaced one compiles, type-checks and passes its tests** — the
directory is still a directory and its contents still import. Nothing in the toolchain has an opinion about
where it sits. That is the same shape as the dangling references M9 was built for, and it was found the same
way, by human review.

## What the field measured

The convention this rule serves already exists as a table in the project's own convention document — name
against permitted places. So the rule's semantics are not invented here; they are the table, made checkable.

Eight reserved names, measured across a real tree:

| name         | positions found                           | count  |
| ------------ | ----------------------------------------- | ------ |
| `tests`      | directly under a unit                     | 250    |
| `styleGuide` | directly under a unit                     | 109    |
| `parts`      | directly under a unit                     | 28     |
| `functions`  | under a unit / under a concern directory  | 9 / 13 |
| `e2e`        | under a route directory                   | 13     |
| `stores`     | under a unit / under a concern directory  | 5 / 2  |
| `components` | under a route directory / under `src/lib` | 4 / 1  |
| `types`      | under `src/lib/db`                        | 1      |

**Zero violations.** The tree matches the convention document exactly.

Four things the measurement settled that reading the charter would not have.

**The positions of one name mix kinds, so the two option maps cannot be exclusive.** `functions` is permitted
directly under a unit, under a concern directory, _and_ under a route directory. A design where each name
belongs to either the structural map or the glob map cannot express it — nor `stores`, nor `types`. **A name
must be able to appear in both, and the union of its declared positions is what is allowed.** A first sketch
of this design had them exclusive.

**The structural predicate cannot be approximated by a glob.** Units and concern directories both live under
`src/lib/features/**`, so no glob separates them, and `parts`'s "directly under a unit, and nowhere else"
needs a predicate the glob language does not have. There is one saving asymmetry, worth recording because it
keeps the design small: **no name is permitted under a concern directory but forbidden under a unit.** So the
glob side over-permitting costs nothing today, and only the three unit-only names (`parts`, `styleGuide`,
`tests`) need the structural side to be exact.

**The declaration cannot be derived from the distribution, in either direction.** This is the finding that
most shapes the rule, and it refutes the obvious shortcut of seeding a project's declaration from what its
tree already does:

- **A minority position can be correct.** `stores` appears twice under concern directories against five under
  units; `types` appears exactly once. Both are positions the convention explicitly permits.
- **A permitted position can have zero instances.** The convention allows `functions` directly under a route
  directory, and there are none — the rule is "one function unit sits in the route directory, two or more move
  into `{route}/functions/`", and no route has reached two yet.

So a declaration inferred from observation would report the minority positions as violations and forbid the
empty-but-legal one. **M4 has to start from the declaration.** That is the strongest argument yet for the L3
tier this rule sits in — inert until declared is not caution, it is the only correct behaviour when the tree
cannot tell you the convention.

**`tests` is out of scope, and this is why.** The convention places `tests/` **beside the file it tests**, not
under a unit. All 250 instances happen to be under units because that is where the tested files are; the
predicate is different. Declaring `tests` as unit-only would be **narrower than the convention** and would
report a legitimate future placement — a `tests/` beside a `.ts` in a directory that is not a unit. A name
whose position is "wherever its subject is" has no placement constraint to check, so seven of the eight names
are in scope and `tests` is not.

## The blocker does not exist

The charter records M4 as needing a **structured-list option kind**, and sequenced it behind a second
rule-options iteration. That judgement was written on 2026-07-28. The `reserved-directory-names` design
landed on **2026-07-29** and established the convention that a `string-map` value carries a list, split on
`|`:

```js
scopes: { 'src/lib': 'api|components|features|effect|db' }
```

`splitNames` is the shared helper. So a map from a name to several positions is expressible with the kinds
that exist, and the whole measured convention table was written out in them to check it rather than assumed:

```js
'architecture/reserved-name-placement': {
  options: {
    unitPlacements: { parts: 'src/**', styleGuide: 'src/**', functions: 'src/**', stores: 'src/**', types: 'src/**' },
    placements: {
      functions: 'src/lib/features/*|src/lib/features/*/*|src/routes/**',
      stores: 'src/lib/features/*|src/lib/features/*/*',
      types: 'src/lib/features/*|src/lib/features/*/*|src/lib/db',
      e2e: 'src/routes|src/routes/**',
      components: 'src/routes|src/routes/**|src/lib'
    },
    exclude: ['src/lib/api/**']
  }
}
```

Every measured position is covered and no kind beyond `string-map` and `string-list` appears. **The charter's
M4 row should be corrected rather than left to block a future reader**, and this design does that.

## Design

Three options, mirroring `architecture/reserved-directory-names` exactly — the same shapes, inverted.

- **`placements`** — `string-map`, reserved name → `|`-separated globs matching the **parent directory** the
  name may sit in.
- **`unitPlacements`** — `string-map`, reserved name → `|`-separated **root** globs; the name may sit directly
  under any unit beneath those roots. A unit is what M3 already calls one: a directory whose name begins A–Z
  and one of whose immediate children is a file whose stem equals the directory's name.
- **`exclude`** — `string-list` of directory globs the rule ignores entirely, as M3 has.

**A name's permitted positions are the union of its entries in both maps.** A name absent from both is not
governed — the rule reports nothing about it, because a name nobody declared a place for has no place to
violate.

The rule reports a directory whose name appears in either map and whose parent satisfies none of that name's
declared positions.

**Inert until declared.** Both maps default to `{}`, so an unconfigured project sees nothing — the same
default the rest of the L3 family takes, and here the measurement above is the argument for it rather than
convention.

## Testing

1. **A name declared unit-only is reported under a non-unit parent, and silent under a unit.** This is
   `parts`'s whole case and the one a glob cannot express; assert both halves on one tree so the structural
   predicate is what decides.
2. **A name declared in both maps is silent in either kind of position.** `functions` under a unit and
   `functions` under a declared glob must both pass **in the same run**. A test asserting only one would pass
   on an implementation that treats the maps as exclusive, which is the shape this design rejected.
3. **A name in neither map is never reported**, however it is placed. The rule governs declared names only.
4. **A declared name in an undeclared position is reported**, with the directory as the finding's location.
5. **`exclude` removes a subtree from consideration**, asserted on a tree where the same misplacement is
   reported without it and silent with it.
6. **Nothing is reported when neither map is declared**, on a tree that would otherwise produce findings —
   the L3 guarantee, and the half a reader is most likely to assume rather than check.
7. **A unit is recognised the way M3 recognises one.** Assert against a directory whose same-named entry file
   is `.svelte`, one whose entry is `.ts`, and one with no matching entry — the third is not a unit and a
   unit-only name under it is a violation.

## Deliberately not solved

- **`tests`.** Its convention is positional relative to its subject, not to a unit. See above.
- **Seeding a declaration from the tree.** The measurement shows both failure directions; a `--suggest` mode
  would produce a wrong table with an authoritative shape.
- **Names permitted under a concern directory but forbidden under a unit.** No such name exists in the
  measured convention, so the glob side may over-permit relative to the structural side. If one ever appears,
  the union semantics above are what would need revisiting, and this is the sentence that says so.
- **Reporting a name that is declared but never appears.** M3 has the same question about unused keys and
  answers it with `classifyUnusedKeys`; whether an unused `placements` key is a typo or a not-yet-used
  position is undecidable here — `functions` under a route directory is a real, permitted, currently-empty
  position.
- **The initial finding count.** Zero on the measured tree. The value is regression detection during the next
  reorganisation, not a backlog to clear.
