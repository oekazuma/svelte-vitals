# architecture/reserved-name-placement — design

**Date:** 2026-08-06
**Status:** approved; field-measured 2026-08-06
**Charter mechanism:** M4 — "a reserved name may appear only in the places declared for it" (L3). The charter's
verdict rows and its mechanism labels are separate sequences; M4 has a mechanism row and no verdict row.

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
needs a predicate the glob language does not have.

**And one predicate is not enough, which a second measurement settled.** `isUnitDir` — the family's existing
definition, shared from `reserved-directory-names.ts` — requires the directory name to begin **A–Z** as well
as holding a same-named child file. Measured against the same tree:

| units by the convention's definition | entry        | count | seen by `isUnitDir` |
| ------------------------------------ | ------------ | ----- | ------------------- |
| capitalised                          | `.svelte`    | 170   | yes                 |
| lowercase                            | `.ts`        | 121   | **no**              |
| lowercase                            | `.svelte.ts` | 8     | **no**              |

**The tool recognises 170 of the convention's 299 units.** The correlation is exact — every capitalised unit
holds a `.svelte`, every lowercase one holds a `.ts` or `.svelte.ts` — because the convention requires it, so
`isUnitDir`'s letter test is in practice "component units only". That is a coherent definition and not a bug;
it is a mismatch only when a rule uses the word _unit_ to mean what the convention means.

For M4 that mismatch is a **false positive**, which the precision gate does not allow:

- `tests` is the most common reserved name at 250 instances, of which **109 sit under a lowercase unit**.
  Declared as unit-only against `isUnitDir`, the rule reports all 109 — every one a placement the convention
  permits. An earlier draft of this design excluded `tests` for a related but weaker reason and would have
  shipped that exclusion without knowing the number.
- `functions` has one lowercase-unit parent, and against `isUnitDir` alone it survives only because the same
  directory is also matched by a declared glob.

**So the rule takes two unit predicates, and declares which one each name wants:**

- **capitalised unit** — `isUnitDir` unchanged: name begins A–Z, holds a same-named child.
- **any-case unit** — the same test without the letter requirement.

The split is the letter test alone. It is deliberately **not** keyed on the entry file's extension: that
`.svelte` and capitalisation coincide is a property of this project's convention, not something the rule
should encode on one tree's evidence.

**Which map a name goes in is a claim about the convention, not about the tool.** The line is this: a name
that holds _parts of a component_ (`parts`, `styleGuide`) is permitted under a component unit and reads as a
violation elsewhere; a name that holds _code_ (`tests`, `functions`, `stores`, `types`) is permitted under a
unit of either case, because the convention's own definition of a unit does not distinguish them. That is the
rule a reader can hold, and it is why `functions` goes in the any-case map rather than relying on a glob to
rescue it — a design cannot brand its own encoding a coincidence and ship it anyway.

The measurement is **consistent with that line and does not determine it.** Only `tests` (109 lowercase
parents) and `functions` (one) positively support the code half; `types` was never measured under a unit at
all, and `stores`'s five unit instances have no recorded case. The unsupported halves all fall on the
over-permission side, which is the direction this design has already accepted as a missed regression rather
than a false positive.

`tests` is therefore **in scope**, where the earlier draft had removed it, and all 250 instances pass.

**One thing the measurement did not break down, and the encoding below depends on it.** The 28 `parts` and
109 `styleGuide` instances were counted as "directly under a unit" without recording the unit's case. If any
of them sits under a lowercase unit, declaring the name capitalised-only repeats the 109-instance failure
exactly. The safe direction is known and cheap — a name whose case split is unconfirmed goes in the any-case
map, which cannot produce a false positive the capitalised map would not — so this blocks the _example
encoding_, not the rule. Confirm before writing either name into a real config.

## The blocker does not exist

The charter recorded M4 as needing a **structured-list option kind**, and sequenced it behind a second
rule-options iteration. That judgement was written on 2026-07-28. On **2026-07-29** the directory-rule family
landed the convention that a `string-map` value carries a list split on `|` — introduced by
`architecture/directory-naming` for its casing sets and reused by `reserved-directory-names`:

```js
scopes: { 'src/lib': 'api|components|features|effect|db' }
```

`splitNames` is the shared helper. So a map from a name to several positions is expressible with the kinds
that exist, and the whole measured convention table was written out in them to check it rather than assumed:

```js
'architecture/reserved-name-placement': {
  options: {
    // directly under a unit whose name begins A–Z — `isUnitDir` unchanged
    capitalisedUnitPlacements: { parts: 'src/**', styleGuide: 'src/**' },
    // directly under a unit of either case
    anyCaseUnitPlacements: {
      tests: 'src/**', functions: 'src/**', stores: 'src/**', types: 'src/**'
    },
    // the parent directory itself, by glob
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

Every measured **kind** of position is covered — with the one reservation recorded above, that `parts` and
`styleGuide` sit in the capitalised map on an unconfirmed case split — and no kind beyond `string-map` and
`string-list` appears. The blocker refutation does not depend on that reservation: the worst case moves two
names between two maps of the same option kind. **The charter is
corrected on this branch** — both its mechanism row and its sequencing step, since correcting one and leaving
the other makes the charter contradict itself. The two sibling designs that repeat "M4 waits on a
structured-list option kind" (`2026-07-29-reserved-directory-names-design.md` and
`2026-07-29-directory-naming-design.md`) gain a pointer to this one.

## Design

Four options. Three are `string-map`s from a reserved name to a `|`-separated list; the fourth mirrors M3's
`exclude`.

- **`placements`** — name → globs matching the **parent directory** the name may sit in.
- **`capitalisedUnitPlacements`** — name → globs matching the **capitalised unit directory** the name may sit
  directly under. "Capitalised unit" is `isUnitDir` unchanged: a directory whose name begins A–Z and one of
  whose immediate children is a file whose stem equals the directory's name.
- **`anyCaseUnitPlacements`** — the same, without the letter requirement.
- **`exclude`** — `string-list` of directory globs the rule ignores entirely.

**Neither unit option is named `unitPlacements`, deliberately.** In this family the bare word has meant
`isUnitDir` since M3, whose option is `unitScopes` — so an unmarked `unitPlacements` would be read as the
capitalised predicate by anyone translating from M3, and as the wider one by anyone reading M4 alone. That
misreading fails **silently**: a name meant for `capitalisedUnitPlacements` and declared in the wider map
stops reporting the violation it exists for, and a missed regression looks exactly like a clean run. Marking
both names removes the default. It also refuses the bare word the same way the measurement did — `isUnitDir`
sees 170 of the convention's 299 units, so "unit" unqualified is precisely the term that does not survive
contact with this tree.

**A name's permitted positions are the union of its entries across all three maps.** A name absent from all
three is not governed — a name nobody declared a place for has no place to violate. The union is not a
convenience: `functions` is permitted under a unit, under a concern directory **and** under a route
directory, and `stores` and `types` likewise span kinds, so a design where each name belongs to exactly one map
cannot express any of the three. An earlier draft had them exclusive.

**An empty value ungoverns the whole name, across every map, and says so.** `placements: { e2e: '|' }` must
leave `e2e` ungoverned rather than forbidding it everywhere, which is what "the parent satisfies none of its
declared positions" would otherwise do to a typo.

**The scope of that drop is the name, not the value, and the difference is not cosmetic.** M3's maps compete
to _allow child names_, so dropping one empty value there leaves a position ungoverned — under-reporting, the
safe direction. M4's maps **union to permit positions**, so dropping only the empty value would _shrink_ a
governed name's permitted set: `anyCaseUnitPlacements: { functions: 'src/**' }` beside a typo'd
`placements: { functions: '|' }` would report every `functions/` under a concern or route directory. Those are
false positives, produced by a typo, in the direction the precision gate forbids — and the example encoding
puts three names in two maps each, so the case is as reachable as the single-map one. The rule inherits M3's
fix but not its scoping: **any empty value anywhere ungoverns that name everywhere.**

**And the drop is reported, in the shape M3 reports it.** `reserved-directory-names` shipped the silent
version and closed it in review; silence alone leaves a typo indistinguishable from a project that complies,
which is what the charter's inverse-precision gate exists for. Three constraints come with the shape, all
load-bearing:

- **One aggregated, project-scoped finding**, never one per key. `findingKey` is `id::route::location` and a
  project-scoped result leaves both unset, so N findings collapse to one baseline entry and suppressing one
  silently suppresses the rest. M3 records this reasoning at the code; M4 has the same key space.
- **It carries a glob that matched no directory too, counted per alternative.** `placements: { e2e:
'src/route/**' }` reports every `e2e/` in the tree with no diagnostic otherwise. The unit M3's
  `classifyUnusedKeys` counts is a whole map key; M4's must be **one `|`-separated alternative**, because a
  typo among good alternatives — `'src/route/**|src/lib/features/*'` — shrinks the permitted set by exactly
  the same mechanism while "some glob in this name's union matched something" stays true. Per-name counting
  would miss every multi-glob case, which is five of the eight names in the example encoding.
- **A unit-map glob that matched directories but never a unit is its own note**, as M3 tri-states its unit
  keys. `capitalisedUnitPlacements: { parts: 'src/lib/features/*' }` matches real directories that are
  concern directories, not units — the declaration is live and checks nothing, which is the failure the
  charter's inverse-precision gate names, and it is invisible under a "matched no directory" test.

This is a different question from a declared name that never appears, which stays unsolved below: there the
position is real and legitimately empty, here the position does not exist or holds nothing the predicate
accepts.

**Two boundaries on those diagnostics, both inherited rather than invented.** `UnusedReason` is already
two-state — `'no-match'` and `'only-excluded'` — because "matched no directory" is a lie for an alternative
whose every match sat under `exclude`; M4 keeps both states for the same reason, so its per-alternative
classification is three-way with the unit tri-state. And **only globally resolved values are classified.** An
alternative that exists solely inside an `overrides` layer is not diagnosed, matching M3: a layer that
governs a subtree cannot be judged dead against the whole tree, and judging it against its own subtree is a
second mechanism this rule does not need.

The note wording is M3's adapted, not M3's copied: an empty value there names no _child directory name_,
here it names no _position_.

**A glob matches the parent directory, and a bare prefix matches itself.** `src/routes/**` matches
`src/routes/about` and, on its own, not `src/routes` — which is why the example encoding lists
`src/routes|src/routes/**` for names permitted directly in the route root. The family's compiler already
decides this; the rule takes its behaviour rather than a second one.

**All three maps match the same directory — the reserved-name directory's parent — and differ only in what
else they require of it.** A unit the name sits _directly under_ is that parent, so there is no second match
subject anywhere in this rule: `placements` requires nothing more of the parent, `capitalisedUnitPlacements`
requires `isUnitDir`, `anyCaseUnitPlacements` requires the same without the letter test. An earlier draft of
this paragraph claimed the subject differed by map, which was wrong and made the unit maps look like a
separate mechanism.

**The unit maps' globs therefore match the unit itself, as `unitScopes` does**, and not an ancestor it sits
beneath. Those two readings diverge observably, so the compiler decides it — run against the family's key
compiler with the bare guard (`createKeyCompiler()` returns the memoising `compile`; `compile(globs, true)`
then `matchKeys`. `routeGlobToRegExp` alone has no guard: its raw regex for `src/lib/**` does match
`src/lib`, and the guard is `matchKeys`'s `barePrefixRe` skip):

| glob         | `src/lib` | `src/lib/Card` | `src/lib/features/x/Card` |
| ------------ | --------- | -------------- | ------------------------- |
| `src/lib`    | match     | **no**         | no                        |
| `src/lib/**` | **no**    | match          | match                     |

So `parts: 'src/lib'` permits `parts/` only under a unit at exactly `src/lib` — which in the capitalised map
is unreachable, since `lib` is lowercase — while `parts: 'src/lib/**'` permits it under any unit below
`src/lib`. **A bare glob in a unit map is almost always a mistake**, and the tri-state note above is what
catches it. Under the ancestor reading the `src/lib` column would read "match" throughout, which is why the
direction is pinned by a test rather than left to a word.

**No pass results.** `computeScore` seeds every distinct `route` at 100 and averages, and a directory has no
pre-existing score key — so a pass per directory would add hundreds of 100s from one broad declaration and
dilute every real finding. M3 declines them for this reason; M4's subject is the same.

**Options resolve at the reserved-name directory, and `overrides` layers apply as the family applies them.**
The subject of the finding, of `exclude`, and of option resolution is the same directory — the `parts/`
itself, not the parent its globs are matched against. Resolving at the parent instead would let an override
naming a directory govern findings reported outside it, and M3 already re-resolves `exclude` at the child for
the same reason. So "any empty value ungoverns that name everywhere" is scoped to **one resolved option
set**: a name emptied in an override is ungoverned under that override's paths and governed elsewhere.

**Inert until declared.** All three maps default to `{}`.

## Identity and deliverables

|                  |                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| id               | `architecture/reserved-name-placement`                                                             |
| category / scope | `architecture` / `component` — it reports directories, and the family's rules are component-scoped |
| severity         | `info`, matching every other Architecture rule                                                     |
| default          | off in effect: all three maps default to `{}`                                                      |

Registration touches **four** places (`AGENTS.md`): the import, the `allRules` array and the re-export block
in `packages/core/src/rules/index.ts`, plus the duplicate re-export list in `packages/core/src/index.ts`,
which TypeScript does not check. Rule docs go in `docs/src/content/docs/rules/architecture/` and its `ja/`
counterpart — `packages/cli/test/docs-links.test.ts` fails without both — then
`pnpm --filter svelte-vitals run gen:rules-index && pnpm format`, and a changeset.

## Testing

1. **A name declared capitalised-unit-only is reported under a lowercase unit.** This is the 109-instance
   case inverted, and the one the wider predicate would miss; assert it alongside the same name being silent
   under a capitalised unit.
2. **A name declared for any-case units is silent under both kinds.** `tests` under `Card/` and under
   `formatDate/` in one run. A test using only a capitalised parent passes on an implementation that ignores
   the split.
3. **A name declared in more than one map is silent in every declared position, in one run.** `functions`
   under a capitalised unit and under a declared glob. Asserting only one passes on an exclusive
   implementation, which is the shape this design rejected.
4. **A name in no map is never reported**, however it is placed — on a fixture where **another** name is
   declared and reporting, so the run is not silent for the reason item 13 covers.
5. **A declared name in an undeclared position is reported.** The finding's `location` must be a **file
   inside the offending directory** — M3's `reportAt` — because `filterToChangedFiles` keeps only results
   whose `location` git listed, so a directory there vanishes from every `--diff` run. The directory itself
   belongs in `route`. Assert the shape, not just the count.
6. **Both unit maps honour their globs.** Declare `parts: 'src/lib/**'` in `capitalisedUnitPlacements` and
   `tests: 'src/lib/**'` in `anyCaseUnitPlacements`, and place each under a unit the glob does **not** match:
   both must report, and the `tests` case must use a lowercase unit. Without the
   second half, an implementation that honours the capitalised map's globs and treats the any-case map as
   "permitted under any unit anywhere" passes every other test here. Assert the match target too, in the
   direction the compiler actually gives: a unit at `src/lib/Card` is **reported** against a glob of
   `src/lib` and **permitted** against `src/lib/**`. Under the ancestor reading — the unit merely sits
   beneath the glob — both are permitted, so this is the assertion that separates them.
7. **Both unit predicates need the entry file, not just the letter.** Place a declared name directly under a
   **same-case non-unit** directory — `parts/` under an `Icons/` holding no `Icons.svelte`, and `tests/` under
   a `helpers/` holding no `helpers.ts` — and assert both report. Without this, an implementation that reduces
   "capitalised unit" to "name begins A–Z" and "any-case unit" to "any directory" passes every other test
   here, because items 1, 2 and 6 contrast case between two real units and never contrast unit against
   non-unit. This is the distinction the family's cascade turns on.
8. **An empty value ungoverns the name in every map, and is reported.** Two halves, both required.
   `placements: { e2e: '|' }` reports no `e2e/` anywhere **and** produces a finding — asserting only the
   silence passes on an implementation that drops the key without a word, the shape M3 shipped and had to
   fix. Then the case that distinguishes name-level from value-level dropping: `functions` declared in
   `anyCaseUnitPlacements` **and** empty in `placements` must report no `functions/` anywhere, including
   under a concern directory. A value-level implementation reports those and passes the `e2e` half.
9. **Bad declarations produce one project-scoped finding, not one each.** Two empty values and a glob
   matching no directory, in one run: assert a single result, with `route` and `location` unset. Per-key
   findings pass every count-only assertion and collapse to one baseline entry, which is the bug this shape
   avoids.
10. **A dead glob is reported at the alternative, not the name.** Declare
    `placements: { e2e: 'src/route/**|src/routes/**' }` on a tree with a real `src/routes` and no
    `src/route`: the good alternative works and the dead one is still reported. A per-name implementation
    passes a single-glob test and reports nothing here, which is the five-of-eight case in the example
    encoding.
11. **A unit-map glob matching only non-units is reported.** `capitalisedUnitPlacements: { parts:
'src/lib/features/*' }` where those directories are concern directories: the declaration is live,
    governs nothing, and must say so. Item 10 does not catch it — the glob matched directories.
12. **`exclude` removes a subtree**, asserted on a tree where the same misplacement reports without it.
13. **Nothing is reported when no map is declared**, on a tree that would otherwise produce findings — the L3
    guarantee, and the half a reader assumes rather than checks.
14. **An `overrides` layer scopes the whole rule, including the empty-value drop.** Empty a governed name
    inside an override; assert it is silent under that override's paths **and still reporting outside them**,
    in one run. Then the clause that makes this item catch what it claims to: **the override's glob must
    match the reserved-name directory and not its parent** — `'src/**/parts'` does, an ordinary
    `'src/lib/**'` does not. Without it the two resolution subjects agree on every assertion, and an
    implementation resolving at the parent passes; every other item uses global config, where the subjects
    are indistinguishable, so this is the only guard against that.
15. **A bare prefix and a `/**` suffix differ as the family's compiler defines.** Assert `src/routes` against a
    `src/routes` parent and `src/routes/**` against the same one, so the choice is pinned rather than
    inherited silently.

## Deliberately not solved

- **Over-permission at a reserved-name directory.** A glob cannot tell a concern directory from a
  reserved-name directory at the same depth, so `src/lib/features/*/*` permits a `stores/` inside a
  `functions/`, and `src/routes/**` permits a `functions/` inside an `e2e/`. These are missed regressions,
  not false positives. The recorded asymmetry — no name is permitted under a concern directory but forbidden
  under a unit — covers over-permission at units and does **not** cover this; an earlier draft claimed the
  glob side over-permitting "costs nothing today", which is narrower than it sounded.
- **The inventory both predicates depend on.** `isUnitDir` takes the directory's file list, so this rule
  reads the same project inventory the sibling rules do: it sees nothing outside `src/`, and on a `--route`
  run, where no inventory is built, it is silent. Both siblings record this; M4 inherits it unchanged and had
  not said so.
- **Seeding a declaration from the tree.** Both failure directions are measured above; a `--suggest` mode
  would produce a wrong table with an authoritative shape.
- **Reporting a declared name that never appears.** M3 answers the sibling question with
  `classifyUnusedKeys`; here it is undecidable — `functions` under a route directory is a real, permitted,
  currently-empty position.
- **`tests` as its convention actually states it.** The convention is "beside the file it tests"; "under a
  unit of either case" matches every measured instance but is not the same predicate. A directory holding a
  `.ts` and no same-named child is not a unit, and a `tests/` beside that file would report. None exists in
  the measured tree, and this design does not claim the convention makes one impossible.

  The first draft excluded `tests` on this same argument, so the reversal needs its reason stated rather than
  left as a change of mind. The two cases are not the same size: draft 1 was choosing between a predicate
  that reports **109 existing placements** and no rule at all, while draft 2 chooses between a predicate that
  reports **zero existing placements** and no rule at all. The precision gate is about false positives
  shipped, and 109 against 0 is the whole distinction. The residual class stays open, with two escapes that
  need no code — `exclude`, or simply not declaring `tests` — which is what makes it a recorded limit rather
  than a blocker.

- **The `isUnitDir` mismatch in the sibling rules.** `reserved-directory-names` records that names under a
  lowercase unit "are never checked" as a coverage limit. The same split would close it there. Out of scope
  here, and now cross-referenced rather than left as two independent notes.
- **The initial finding count.** Zero on the measured tree. The value is regression detection during the next
  reorganisation, not a backlog to clear.
