---
title: architecture/unit-entry-file · Unit entry file
description: A directory declared to be a unit should contain a file named after it.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a directory you have declared to be a "unit" that contains no file named after it: `Card/`
without `Card.svelte`, `getFoo/` without `getFoo.ts`.

This rule is **off until you configure it**. It has no default idea of what a unit is, because that
is your project's convention, not ours.

## Why it matters

A directory named after a unit but missing that unit's entry file is either an incomplete unit or a
grouping wearing the wrong name. Either way the tree stops saying what it means, and anyone, or
anything, resolving by convention starts guessing.

A filename-pattern check cannot catch this. Given a path it can ask whether that filename matches its
parent directory, but a file that does not exist has no path to check.

## How to fix

Add the entry file, or stop declaring the directory a unit. Rename it to camelCase if it is really a
grouping, or narrow the declaration that swept it in.

## Configuration

| Option            | Type                              | Default |
| ----------------- | --------------------------------- | ------- |
| `units`           | map of directory glob → extension | `{}`    |
| `pascalCaseUnits` | map of root glob → extension      | `{}`    |
| `exclude`         | list of directory globs           | `[]`    |

In the two map options, `units` and `pascalCaseUnits`, each value is the entry file's extension
**with its leading dot**: `'.ts'`, not `'ts'`. Validation accepts any non-empty string, so a missing dot
passes config validation and then misfires: the rule looks for `getFoots` instead of `getFoo.ts`,
never finds it, and reports a missing entry file for a directory that has one.

`exclude` is a list, not a map, and its values are directory globs rather than extensions.

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/unit-entry-file': {
      options: {
        units: {
          'src/lib/api/**/*': '.ts',
          'src/**/functions/*': '.ts',
          'src/**/functions/*/*': '.ts',
          'src/**/stores/*': '.svelte.ts'
        },
        pascalCaseUnits: { 'src/**': '.svelte' },
        exclude: ['**/tests', '**/styleGuide', '**/types', '**/e2e']
      }
    }
  }
};
```

`pascalCaseUnits`'s root glob covers **every** capitalized directory beneath it, not only the ones
that are component units. A route segment or an asset tree mirrored inside `src/` can be
PascalCase too, and neither is a unit. Narrow the root, or add those trees to `exclude`, rather than
letting the sweep catch them. This matters most for a route directory: renaming it to satisfy this
rule changes the site's URL, so for a route segment the fix is to narrow the declaration, never to
rename the directory.

**`units`** identifies a unit by where it sits. **`pascalCaseUnits`** identifies one by its name: every
directory under a matching root whose name begins with an uppercase letter. Both are needed, because a
camelCase directory may legitimately be a unit _or_ a grouping, and only its position can tell them
apart, while a PascalCase unit nests to arbitrary depth, where no path glob can find it.

A directory matched by `units` takes that declaration; `pascalCaseUnits` applies only to the rest.
When several globs match one directory, the most specific wins, in this order:

1. more path segments;
2. fewer `**` segments;
3. the longer key;
4. the alphabetically first.

Segment count includes wildcards, so a key made only of wildcards can outrank one naming a real
directory if it is deeper, so write the depth you mean.

### `exclude`

**`exclude` removes a directory and everything beneath it.** So it is only for directories that are
neither units themselves nor hold units:

| Directory                            | In `exclude`?                                |
| ------------------------------------ | -------------------------------------------- |
| test, style-guide, e2e, type folders | Yes                                          |
| a folder whose children _are_ units  | **No**, excluding it removes those units too |

If a broad `units` glob sweeps in a folder that holds units, narrow the glob instead of excluding it.

### Glob depth

`*` matches within one path segment and `**` across segments, but the two star forms are not
symmetric: **a `**` between two segments matches one segment or more, never zero.** So
`src/lib/api/**/*` requires at least two levels below `api/`, which is what keeps an intermediate
grouping level from being treated as a unit. A **trailing** `/**` is safe to write: it means
"everything under this directory," and the rule will not treat the directory itself as a unit.

## Limitations

Only files under `src/` are considered, so a directory outside it is never checked and does not need
excluding.

A `units` or `pascalCaseUnits` declaration that checks no directory is reported, so a glob typo
cannot leave the rule silently checking nothing. "Checks no directory" is stricter than "matches no
path": a `pascalCaseUnits` key that matched only lowercase directories has identified no unit, so it
is reported too. That is what surfaces a key missing the trailing `/**` it was meant to have.

A declaration whose every match is removed by `exclude` is reported the same way, and says so:
`matched only excluded directories` rather than `matched no directory`. The two have different
remedies: one is a typo in the glob, the other a contradiction between two options you can both see.

Two things are deliberately left out:

- A declaration written **only** inside an `overrides` entry, since whether it matched anything depends
  on which paths the override applies to.
- An `exclude` glob, which is never checked at all, since an exclusion matching nothing changes no
  report. A mistyped `exclude` is therefore silent when the subtree it meant to remove had no
  findings anyway.

When more than one declaration checks no directory, they are all reported together as a single
finding rather than one each, so suppressing that finding suppresses the check for every inert
declaration at once.

A declared unit missing its entry file that is also named in the wrong casing draws a finding from
`architecture/directory-naming` as well, when that rule is configured for the same location. Neither
suppresses the other. They are different claims and both are true.

## Mode differences

None. This rule reads the project's source-file inventory, the `src/**` paths rather than file contents, and everywhere it runs that inventory is built the same way. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: no inventory is built, and a file finding has no route to attribute it to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/unit-entry-file -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/unit-entry-file': 'off'
  }
};
```
