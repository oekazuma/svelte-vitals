---
title: architecture/directory-naming · Directory naming
description: A directory should be named in the casing its location declares.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a directory whose name does not match the casing you have declared for its location —
`UserProfile/` where the features root is camelCase, `setCookie/` where endpoint segments are
kebab-case.

This rule is **off until you configure it**. It has no default idea of what your directory names
should look like, because that is your project's convention, not ours.

## Why it matters

A directory name is the cheapest signal a tree has. When the convention holds, `parts/` and `Card/`
tell a reader — human or agent — what they are without opening anything. One directory that breaks it
costs nothing today and makes the signal unreliable forever after, because a reader who has met one
exception has to check every case from then on.

## How to fix

Rename the directory, or narrow the declaration that swept it in.

## Configuration

| Option        | Type                               | Default |
| ------------- | ---------------------------------- | ------- |
| `directories` | map of directory glob → casing set | `{}`    |
| `exclude`     | list of directory globs            | `[]`    |

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/directory-naming': {
      options: {
        directories: {
          'src/routes/**': 'camelCase|PascalCase',
          'src/routes/internalApi/*': 'kebab-case',
          'src/lib/features/*': 'camelCase',
          'src/lib/api/*': 'camelCase'
        }
      }
    }
  }
};
```

### The casing names

Four are recognised, and each tests the **whole** name rather than its first character:

| Name         | Accepts                    | Example       |
| ------------ | -------------------------- | ------------- |
| `camelCase`  | `^[a-z][a-zA-Z0-9]*$`      | `itemList`    |
| `PascalCase` | `^[A-Z][a-zA-Z0-9]*$`      | `PageHeader`  |
| `kebab-case` | `^[a-z0-9]+(-[a-z0-9]+)*$` | `clear-cache` |
| `snake_case` | `^[a-z0-9]+(_[a-z0-9]+)*$` | `price_table` |

A value may name several, joined by `|`, for a location that legitimately holds more than one kind of
directory — a route's `components/` holds PascalCase component units and camelCase groupings side by
side.

These rules mean different things by "PascalCase", on purpose:

- **This rule** checks that the whole name conforms.
- **`architecture/unit-entry-file`** asks only whether the first character is A–Z — it is asking
  whether a directory _looks like_ a unit, not whether its name conforms.
- **`architecture/reserved-directory-names`** uses that same first-character test, but also requires
  a same-named file.

So a directory can pass one rule's PascalCase gate and fail another's.

**One lowercase word satisfies `camelCase`, `kebab-case` and `snake_case` at once.** `dialog` matches
all three, because there is nothing in the name to disagree with. This rule only fires on a name that
carries the evidence of a casing it fails: a capital, a hyphen, an underscore, a leading digit, or a
character none of the four admits.

**A name with no letter in it is never reported.** `2024` and `404` carry no casing, and a
year-archive route cannot be renamed without changing its URL.

### Route directories

A directory whose name is SvelteKit route syntax is decoded before the casing test, so a declaration
reaching into `src/routes/` is usable:

| Directory          | Checked as |
| ------------------ | ---------- |
| `[itemId]`         | `itemId`   |
| `[itemId=integer]` | `itemId`   |
| `[...rest]`        | `rest`     |
| `[[optional]]`     | `optional` |
| `(app)`            | `app`      |

A compound segment such as `[foo]-[bar]` names no single identifier and is skipped.

One consequence: a declaration covering `src/routes/` governs parameter and group names under the
same casing as static segments. A project wanting kebab-case URL segments but camelCase parameters in
one subtree should declare the narrower static-segment globs instead.

### Which declaration wins

When several globs match one directory, the most specific wins: more path segments first, then fewer
`**` segments, then the longer key, then the alphabetically first. That is what lets
`'src/routes/internalApi/*'` narrow `'src/routes/**'`.

Segment count includes wildcards, so a key made only of wildcards can outrank one naming a real
directory if it is deeper. Write the depth you mean.

A **trailing** `/**` means "everything under this directory" and never governs the directory itself —
which matters here, because the containers those keys name are `src/routes`, `src/lib` and `src`, and
SvelteKit chooses those names, not you.

### `exclude`

**`exclude` removes a directory and everything beneath it.** Use it for a subtree whose names you do
not control — generated code, a vendored tree:

```js
options: {
  directories: { 'src/lib/**': 'camelCase' },
  exclude: ['src/lib/generated']
}
```

If a broad declaration sweeps in a subtree that you _do_ control, narrow the glob instead of excluding
it: an exclusion takes everything below it out of the check as well.

## Limitations

Only directories under `src/` are considered, so anything outside it is never checked and does not
need excluding. File names are not checked at all.

A violation's `route` is the directory it names; its `location` points at a file inside that
directory, because `--diff` filters on `location` and git can only tell a file changed, never a
directory.

The two are kept apart on purpose: a directory nested inside another violating directory is still
reported separately, and each can be suppressed on its own.

A declaration that is not checking what it says is reported, so a typo cannot leave the rule silently
doing nothing. Five cases land in that finding, each named in the message:

| The declaration                            | Reported as                                                    |
| ------------------------------------------ | -------------------------------------------------------------- |
| matched no directory                       | `matched no directory`                                         |
| had every match removed by `exclude`       | `matched only excluded directories`                            |
| names no casing at all (e.g. `''`, `'\|'`) | `the value names no casing at all, so it checks nothing`       |
| names no casing this rule knows            | `unknown casing name '…', so it checks nothing`                |
| names some casing this rule knows          | `unknown casing name '…'; the rest of the value still applies` |

The last is the one worth watching for: the declaration keeps working under its valid names and
quietly enforces less than you wrote.

A declaration naming **no** known casing is dropped before matching, so it cannot shadow a broader
valid declaration that would otherwise govern the same directory.

Two things are deliberately never reported:

- A declaration written **only** inside an `overrides` entry — whether it matched anything depends
  on which paths the override applies to.
- An `exclude` glob that matches nothing, since removing nothing changes no report. A mistyped
  `exclude` is therefore silent when the subtree it meant to remove had no findings anyway.

A mis-cased directory that is also a declared unit missing its entry file draws a finding from
`architecture/unit-entry-file` as well. Neither suppresses the other — they are different claims and
both are true.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/directory-naming -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/directory-naming': 'off'
  }
};
```
