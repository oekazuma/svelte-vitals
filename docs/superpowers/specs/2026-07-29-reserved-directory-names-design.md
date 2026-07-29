# architecture/reserved-directory-names — design

**Date:** 2026-07-29
**Status:** approved
**Charter row:** M3 — closed vocabulary of reserved directory names (L3)
**Depends on:** the source-file inventory and the shared declaration module, both shipped with
`architecture/unit-entry-file` and `architecture/directory-naming`

## The problem

A project settles on a small set of directory names for recurring purposes — a place for child
components, a place for tests, a place for a style guide — and writes them down. The value of that
table is that it is **closed**: a purpose it cannot express is a signal to update the table, not to
invent a ninth name.

Nothing enforces the closing. The first `helpers/` costs nothing. It is correctly cased, it sits in a
plausible place, and no check in the toolchain has an opinion about it. What it costs is the table:
once one directory is outside it, the table stops describing the tree, and every reader has to open a
directory to learn whether it holds units, helpers, or something else.

## Where it sits

M3 is the charter's third L3 mechanism and the third rule to consume the source-file inventory.

**Mission fit.** Which names a project reserves is a project decision, which is what makes this L3.
Inert until declared, it asserts nothing about a project that has no such table.

**Precision.** The rule governs only the scopes a project declares, and within them only positions
where a closed set is genuinely closed. The unit definition below exists entirely to keep one
mis-named directory from cascading into a finding per child.

**Actionability.** Three remedies are always available and the finding names all three: rename the
directory to a declared name, move it under one of them, or add its name to the declaration. Which is
right is the author's call.

**Default stance.** Off. New rules land at `info`, and this one emits nothing until a scope is
declared.

## What this catches that the two shipped rules cannot

`architecture/directory-naming` checks a directory's **casing**; this rule checks its **name**. A
`helpers/` directory under a component unit is correctly camelCase, so a casing declaration of
`camelCase|PascalCase` passes it, and nothing else in the toolchain has an opinion. Only a closed
vocabulary can say that `helpers` is not one of the names this location admits.

`architecture/unit-entry-file` reports a directory that declares itself a unit and lacks its entry
file. That is a different claim about a different directory: M1 talks about the unit, M3 talks about
the unit's children.

## Design

### Identity

|               |                                         |
| ------------- | --------------------------------------- |
| id            | `architecture/reserved-directory-names` |
| category      | architecture                            |
| severity      | `info`                                  |
| scope         | `component`                             |
| fact consumed | `RuleContext.sourceFiles`               |

### Options

| Option       | Kind          | Default | Meaning                                                              |
| ------------ | ------------- | ------- | -------------------------------------------------------------------- |
| `scopes`     | `string-map`  | `{}`    | directory glob → the names its **immediate** subdirectories may take |
| `unitScopes` | `string-map`  | `{}`    | root glob → the names a **unit's** immediate subdirectories may take |
| `exclude`    | `string-list` | `[]`    | remove a directory and everything beneath it                         |

A value lists names joined by `|`, the same encoding `architecture/directory-naming` uses for its
casing sets.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'architecture/reserved-directory-names': {
      options: {
        scopes: { 'src/lib': 'api|components|features|effect|db' },
        unitScopes: { 'src/**': 'parts|functions|stores|types|tests|styleGuide' }
      }
    }
  }
};
```

### The two options differ in what their key names

This is the distinction to get right before reading anything else.

**A `scopes` key names the parent directly.** `'src/lib'` matches `src/lib`, and the rule checks the
names of `src/lib`'s immediate subdirectories. Use it where a closed set sits at a position a glob can
reach.

**A `scopes` key is only writable where the children are _entirely_ drawn from the reserved names**,
and that is a stronger condition than it sounds. A route directory holds its reserved names beside its
route segments, and route segments are unbounded — one per page. Declaring a scope there would mean
listing every segment in the tree, so the vocabulary is not closed at that position and no declaration
belongs there. Writing one anyway reports every segment.

This is the same shape of trap `architecture/unit-entry-file` documents for a broad `units` glob
reaching a container: the fix is to not declare the position, not to `exclude` your way out of the
consequences. What it costs is recorded under "Deliberately not solved".

**A `unitScopes` key names a root.** `'src/**'` matches every directory beneath `src`, and among those
the rule takes the ones that are units and checks _their_ immediate subdirectories. Use it where the
closed set hangs off something a glob cannot find, because it nests to arbitrary depth.

The pairing mirrors `architecture/unit-entry-file`'s `units` and `pascalCaseUnits`: one identifies by
position, the other by a property of the directory itself.

### Which declaration governs, when both match

Both kinds of key match **the same directory** — the parent whose children are being governed — so
their specificity is directly comparable, and the rule compares it rather than preferring one kind:

1. Collect every matching key from both maps. A `unitScopes` key is eligible only if the directory is
   a unit.
2. Among the eligible, take the most specific by the shared four-step order — more path segments, then
   fewer `**` segments, then the longer key, then lexicographically first.
3. If a key from each map ties on all four, **`scopes` wins**, because it names one position while a
   `unitScopes` key sweeps every unit under a root.

Only the winner's name set applies. The alternative — applying every matching set — would mean a
subdirectory has to satisfy the intersection, which no author writing two declarations intends.

`architecture/unit-entry-file` settles the analogous case differently: there `units` beats
`pascalCaseUnits` outright, whatever the globs. That is defensible where the two maps declare different
_things_ (which extension a positionally-identified unit takes, versus a casing-identified one), but
here both declare the same thing about the same directory, so kind-precedence would let a broad
`scopes` key silently cancel a narrow `unitScopes` one. Comparing specificity first is what makes
narrowing work in both directions:

```js
// The narrow key wins in each case, whichever map it came from.
scopes:     { 'src/lib/components/*': 'parts|tests' }        // wins over 'src/**'
unitScopes: { 'src/**': 'parts|functions|stores|types|tests|styleGuide' }
```

**Bookkeeping follows the same line the sibling rules drew.** A key that matched an eligible directory
but lost the comparison has still identified it, so it counts as work — as a tie-break loser does in
`architecture/directory-naming`. A `unitScopes` key that matched a directory which is **not** a unit
has identified nothing and does not count, which is the third-gate rule below.

### A unit, for this rule, is a PascalCase directory holding its own file

`architecture/unit-entry-file` identifies a candidate unit by its first character alone and then
reports whether the entry file is there. **This rule cannot borrow that definition**, and the reason
is the whole justification for defining a second one.

A PascalCase directory with no same-named file is, under the conventions this rule serves, a grouping
wearing the wrong name — which M1 already reports, once. If M3 treated it as a unit, its children
would each be measured against the unit vocabulary, and a directory of PascalCase components would
produce a finding per component. One naming mistake would become N findings, none of which names the
actual problem.

So: **a directory is a unit here when its name begins A–Z and one of its _immediate_ children is a file
whose name up to the first dot equals the directory's name.** Immediate, not anywhere beneath: a
`Card/parts/Card.svelte` must not make `Card` a unit, since the file that gives a unit its identity
sits beside its subdirectories, never inside one. Extension-agnostic on purpose — `.svelte`, `.ts` and
`.svelte.ts` all satisfy it — so the rule needs no extension declaration and stays independent of
M1's configuration.

Taking the name up to the **first** dot is what makes `.svelte.ts` work, and it has one consequence
worth naming: `Card/Card.test.ts` also satisfies the test, so a directory holding nothing but a test
file counts as a unit. That is accepted rather than worked around. The alternative — matching the
directory name against the filename minus a single extension — would reject `Card.svelte.ts`, which is
a real entry-file shape, and the failure it prevents is milder than the one it would introduce: a
directory whose only file is a test has its children measured against the vocabulary, which is a
finding a reader can dismiss, not a missed check.

The division of labour that follows is worth stating plainly: **a mis-named grouping is M1's finding,
and M3 says nothing about its children.** A test pins this, because the cheap implementation is the
one that cascades.

### A subdirectory not in the set is reported, whatever its casing

Under a declared scope, every immediate subdirectory must carry a declared name. A PascalCase child is
no exception: declaring the set closed is declaring that child components live under one of the
declared names rather than beside them.

The finding therefore names all three remedies, because more than one is valid and the rule cannot
know which the author wants:

```text
src/lib/Card/helpers is not one of the names declared here: parts, functions, tests.
  fix: Rename it to a declared name, move it under one of them, or add its name to the declaration.
```

`route` is the offending subdirectory and `location` a file inside it. The two differ for the reason
`architecture/directory-naming` establishes: `location` must be a path git lists as changed or
`filterToChangedFiles` drops the finding from every `--diff` run, while `findingKey`
(`id::route::location`) needs `route` to separate two findings that resolve to the same file.

**There are no pass results**, for the reason the sibling rule records: `computeScore` seeds every
distinct `route` at 100 and averages, and the subject here is a directory with no pre-existing score
key, so a pass per directory would add hundreds of 100s from one broad declaration.

### Declarations that do not check what they say

One finding carrying every such key, as both sibling rules do, and for the same reason — every
project-scoped result leaves `route` and `location` unset, so N findings would collapse to one
baseline entry.

| Failure                                                 | Applies to        |
| ------------------------------------------------------- | ----------------- |
| the glob matched no directory                           | both              |
| every directory it matched is excluded                  | both              |
| it matched directories, but **none of them was a unit** | `unitScopes` only |
| the value lists no name at all (`'\|'`, whitespace)     | both              |

**The third is designed in rather than discovered.** For `unitScopes` the unit test _is_ the
identification criterion, so a key matching only non-units has identified nothing and must stay inert
— while for `scopes` there is no such gate and every surviving match counts as work. That is the same
distinction `architecture/unit-entry-file` draws between `units` and `pascalCaseUnits`, and its
implementation got it wrong twice, in opposite directions, before it settled. Third time, it goes in
the spec.

The fourth is the gap the sibling rule shipped with and closed in review: a value that passes option
validation because it is a non-empty string, yet yields no names, would otherwise be dropped from
matching and never reported.

**A declared name that no directory ever uses is _not_ reported**, and the asymmetry with
`architecture/directory-naming` is deliberate. There, the value comes from a vocabulary the rule owns,
so an unrecognised casing name is a typo by definition. Here the names are the project's own, and a
reserved name that is allowed but currently unused is a legitimate state — the table says what may
appear, not what must. Reporting it would turn every deliberately-held-open slot into noise.

Bookkeeping follows the shared rule: a key is recorded on a match to a directory that **survives
`exclude`**, before every other gate, and only keys that matched nothing surviving are candidates for
the "only excluded" label. Without that, a `unitScopes` key disqualified by the unit test would be
blamed on an exclusion whose removal changes nothing.

### Shared machinery

Everything about which declaration governs a directory comes from
`packages/core/src/rules/architecture/declarations.ts` — the ancestor derivation, the memoised
compiler with its trailing-`/**` guard, the four-step specificity order, `isExcluded`,
`classifyUnusedKeys` and `reportAt`.

One helper is added there, because both of this rule's traversals need it and neither sibling did:
**a parent → immediate-children map**, derived once from the inventory's ancestor prefixes.

### One premise all three rules rest on, currently undocumented

The directory set comes from the ancestor prefixes of `sourceFiles`, so **a directory containing no
file at any depth does not exist as far as these rules are concerned**, and **dot directories do not
appear at all**: both shipped adapters glob with `dot: false` (`packages/cli/src/runtime/node.ts`,
`packages/vite/src/providers/source/components.ts`).

That matters here more than for the siblings, because a `scopes` declaration enumerates a parent's
children exhaustively: were `src/.server/` in the inventory, `scopes: { 'src/lib': … }`'s neighbour
declaration on `src` would report `.server` as an undeclared name. It does not happen today, but
nothing states the guarantee — `Runtime.glob`'s signature says nothing about dotfiles, so a third
adapter could differ and change three rules' behaviour at once. This spec's deliverables therefore
include writing the premise onto `Runtime.glob` and `collectSourceFiles`, where it belongs.

## Interaction with the two shipped rules

| Tree                                                 | M1                | M2                        | M3                      |
| ---------------------------------------------------- | ----------------- | ------------------------- | ----------------------- |
| `Card/` with `Card.svelte` and a `helpers/`          | silent            | silent (camelCase is ok)  | **reports `helpers`**   |
| `Card/` with `Card.svelte` and a `Helpers/`          | reports `Helpers` | silent under `PascalCase` | **reports `Helpers`**   |
| `Icons/` with no `Icons.svelte`, PascalCase children | reports `Icons`   | silent                    | **silent** (not a unit) |

Row 2 draws two findings on one directory and neither suppresses the other: "this PascalCase directory
has no entry file" and "this name is not in the set" are different claims, both true. Row 3 is the
cascade the unit definition exists to prevent.

## Deliberately not solved

- **Where a reserved name may appear.** The rule says "here, only these names"; it cannot say "this
  name, only here". A `parts/` under a grouping is invisible unless that grouping's position is itself
  declared. That is M4, which waits on a structured-list option kind.
- **Positions whose children are unbounded, which puts some reserved names out of reach entirely.**
  Measured against a real tree, the example above governs every PascalCase component unit's children —
  and nothing else. The reserved names that live under a **route directory**, and the ones under a
  camelCase function or store unit, are never checked: those parents are not units, so `unitScopes`
  does not reach them, and their children include route segments or arbitrarily-named nested helpers,
  so `scopes` cannot be declared there either.

  So for a convention of this shape, **the closed vocabulary is enforceable only under PascalCase
  component units.** That is a real limit on coverage, not a configuration mistake to work around, and
  it is worth stating rather than leaving a reader to discover it by writing a declaration that reports
  every route segment. Closing it needs the ability to say "these names, plus anything" at a position —
  a per-scope escape the option kinds cannot express today, and a candidate for the second
  rule-options iteration alongside M4.

- **A project that nests units directly inside units** should not declare `unitScopes`: the nested unit
  is a child not in the set, and would be reported. The rule page says so.
- **File names.** Directory names only.
- **Anything outside `src/`**, and **`--route` runs**, where no inventory is built and the rule is
  silent — including its project-scoped finding, since a single route says nothing about which
  declarations did work.

## Testing

1. **Precedence across the two maps**, since nothing else in the rule family compares specificity
   across option kinds. A narrow `scopes` key must beat a broad `unitScopes` key **and** a narrow
   `unitScopes` key must beat a broad `scopes` key — one direction alone is satisfied by plain
   kind-precedence, so both are needed to pin that specificity is what decides. Then an exact tie on
   all four steps, asserted to fall to `scopes`. Each is checked through its consequence: the two
   declarations name **different** sets, so which one governed is visible in the message.
2. **Mechanism** — both traversals with their different key meanings; the unit test and its negative
   (PascalCase with a same-named `.ts`, with a same-named `.svelte.ts`, a same-named file one level
   **down** which must _not_ qualify, and **without** any
   same-named file); `exclude` subtree pruning; the trailing-`/**` guard; the specificity order.
3. **Bookkeeping on both sides of the line** — a `unitScopes` key matching only non-units lands **in**
   the finding; a key whose unit's children are all declared stays **out**; a key that matched an
   eligible directory but **lost** the specificity comparison also stays out; a key whose every match
   is excluded lands in, labelled as excluded rather than as unmatched. Each of the four reasons is
   asserted by its message, not merely by the key's presence, in a run containing more than one.
4. **A declared-but-unused name draws nothing** — a vocabulary listing a name the tree never uses
   produces no finding of any kind, pinning the asymmetry with the sibling rule's unknown-casing case.
5. **The cascade regression** — a PascalCase directory with no same-named file, holding several
   PascalCase children, produces **zero** findings from this rule. This is the design decision most
   likely to be lost to a simplifying edit.
6. **A documented-example test** — the rule page's example is run against a fixture tree and asserted
   to report nothing on a conforming tree, to report the deviations a non-conforming one contains, and
   to leave no declaration reported. Plus a differential test for the `exclude` example, present and
   absent, since an unmatched `exclude` glob is never reported and a no-op exclusion is otherwise
   invisible.
7. **Wiring** — the rule is reached from both the CLI and the vite plugin, following the end-to-end
   tests the inventory itself carries.

## Validation

The example configuration was run against a real tree in both directions before this spec was
approved.

- On the branch already complying with the convention it reported **nothing**, and left no declaration
  unused.
- On the branch predating the convention it reported a substantial set of undeclared names under
  component units — **and that set matches what a human review of the same reorganisation had already
  identified and fixed.** The rule reached the same conclusion as the review, from the file inventory
  alone.

Two design decisions were checked against the same tree rather than reasoned about. The unit
definition's accepted imprecision — a directory whose only same-named file is a test — **occurs
nowhere** in it, so the simplification costs nothing in practice. And the coverage limit recorded under
"Deliberately not solved" is a measurement, not a prediction: the example governs component units'
children and nothing else, which is what put the route-directory and camelCase-unit positions out of
reach.

## Deliverables

- `packages/core/src/rules/architecture/reserved-directory-names.ts`.
- The parent → children helper in the shared declaration module.
- The dotfile-and-empty-directory premise documented on `Runtime.glob` (`packages/core/src/runtime.ts`)
  and on `collectSourceFiles` (`packages/core/src/source-files.ts`), since all three directory rules
  depend on it and none of them says so.
- Registration in all four places, and the regenerated rule-index pages.
- `docs/src/content/docs/rules/architecture/reserved-directory-names.md` and its Japanese counterpart.
- `configuration.mdx`, English and Japanese.
- A changeset for the new rule.
