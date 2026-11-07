---
title: architecture/reserved-name-placement · Reserved name placement
description: A reserved directory name may appear only in the places declared for it.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a reserved directory name sitting somewhere none of its declared positions matches: a
`parts/` that turns up outside every place you declared for `parts`.

This rule is **off until you configure it**. All three placement maps default to `{}`.

## Why it matters

`architecture/reserved-directory-names` says **"at this position, only these names."** It cannot
say **"this name, only at these positions"**. For a name permitted in several kinds of place at
once (directly under a unit, under a grouping directory, under a route directory), the sibling rule
has nothing to say about a copy that turns up somewhere else. A name reserved for one kind of place
stops carrying that meaning the moment it appears somewhere else: a reader who has met one
exception has to open the directory to learn what it holds.

## How to fix

Move the directory to one of the places declared for its name, rename it, or declare this place for
the name.

## Configuration

| Option                      | Type                                                                                                | Default |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| `placements`                | map of reserved name → `\|`-separated globs matching its **parent directory**                       | `{}`    |
| `capitalisedUnitPlacements` | map of reserved name → globs matching the **capitalised unit** directory it may sit directly under  | `{}`    |
| `anyCaseUnitPlacements`     | map of reserved name → globs matching a **unit directory of either case** it may sit directly under | `{}`    |
| `exclude`                   | list of directory globs                                                                             | `[]`    |

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/reserved-name-placement': {
      options: {
        // directly under a unit whose name begins A–Z and holds a same-named child file
        capitalisedUnitPlacements: { parts: 'src/**', styleGuide: 'src/**' },
        // directly under a unit of either case
        anyCaseUnitPlacements: {
          tests: 'src/**',
          functions: 'src/**',
          stores: 'src/**',
          types: 'src/**'
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
  }
};
```

### The three maps match the same directory

All three match the reserved name's **parent** directory, and differ only in what else they require
of it: `placements` requires nothing more, `capitalisedUnitPlacements` requires it to be a unit
whose name begins A–Z and holds a same-named child file (`architecture/reserved-directory-names`'s
`isUnitDir`), `anyCaseUnitPlacements` requires the same without the letter test.

### Positions union across the maps

A name's permitted positions are the **union** of its entries across all three maps. A name absent
from all three is not governed. This is why `functions` above appears in both
`anyCaseUnitPlacements` and `placements`: a real convention permits one name under a unit, under a
grouping directory, and under a route directory at once, and a design where each name belongs to
exactly one map cannot express that.

### `|` separates alternatives, and an empty value drops the whole name

A value is a `|`-separated list of globs; any one of them permitting the position is enough. A
value that splits to nothing, such as `placements: { e2e: '|' }`, **ungoverns that name in every map**,
not just the one holding it, and is reported. Dropping only the empty value would shrink the union
instead, turning a typo into false positives at every position the emptied entry still covered.

### A bare glob in a unit map matches the unit itself

`capitalisedUnitPlacements` and `anyCaseUnitPlacements` match the **unit directory** the name sits
under, not an ancestor it happens to sit beneath. `parts: 'src/lib'` therefore permits `parts/` only
under a unit at exactly `src/lib`, which is unreachable in the capitalised map since `lib` is lowercase,
while `parts: 'src/lib/**'` permits it under any unit below `src/lib`. A bare glob reaches only the
directory it names, so it is a mistake exactly when the reader meant "any unit below this path":
`src/lib` can never be a capitalised unit, so it is reported. It is correct, and silent, when the
reader named one real unit on purpose: `parts: 'src/lib/Card'` permits `parts/` under the unit at
exactly `src/lib/Card`, and produces no finding when `parts/` sits there. Write `src/lib/**`, not
`src/lib`, only in the first case.

### `exclude`

`exclude` removes a directory and everything beneath it from consideration, the same as the sibling
rule. The declaration diagnostic below is judged against the `exclude` the config file itself
declares, not one an `overrides` layer adds; the misplaced-directory findings honour either. Since
an `overrides` layer can only add exclusions, this can only make that diagnostic quieter, never
louder.

## Limitations

Only directories under `src/` are considered.

A declaration that is not checking what it says is reported, so a typo cannot leave the rule
silently doing nothing. The finding names the reason:

- the value **names no position at all**, which ungoverns the name in every map;
- a glob **matched no directory**, judged against the source inventory rather than the filesystem. A glob
  pointing outside `src/`, or a typo like `src/route/**` where the tree has `src/routes`, reports
  "matched no directory" even when the directory in question exists, because the rule never sees
  anything outside `src/`;
- a glob reaches no directory that `exclude` leaves live, reported as "matched only excluded
  directories". A glob that also reaches a live directory is not reported here, even if some of its
  matches are excluded;
- a unit-map glob reaches no unit of the map's required case anywhere in the tree that `exclude`
  leaves live, reported as "reaches no unit". This **does** catch the bare-glob mistake above:
  `parts: 'src/lib'` reaches no capitalised unit at all (a unit at exactly `src/lib` is unreachable,
  since `lib` is lowercase), so it is reported. Write `src/lib/**`, not `src/lib`.

A declaration saying where a name **may** sit is not dead for going unused. A currently-empty but
legitimate position, such as a declared alternative that no directory happens to use yet, is silent by
design, and is not one of the cases above. The rule the reader can rely on: a declaration is judged
by what its glob can **reach**, not by what it happened to exercise, so a correct declaration for a
position nothing occupies yet stays silent, while a glob scoped to a subtree whose units do not
exist yet is reported all the same, on the same footing as a glob naming a directory that does not
exist yet.

Two things this rule does not attempt: over-permission at a reserved-name directory (a glob cannot
tell a concern directory from a reserved-name directory at the same depth), and seeding a
declaration from the tree.

## Mode differences

None. This rule reads the project's source-file inventory, the `src/**` paths rather than file contents, and everywhere it runs that inventory is built the same way. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: no inventory is built, and a file finding has no route to attribute it to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/reserved-name-placement -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/reserved-name-placement': 'off'
  }
};
```
