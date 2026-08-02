---
title: architecture/reserved-directory-names · Reserved directory names
description: A directory's subdirectories should only take names declared for that position.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a directory whose name is not one of the names you declared for its position — a `helpers/`
inside a component unit that may only hold `parts/`, `functions/` and `tests/`.

This rule is **off until you configure it**. It has no default idea of which names your project
reserves.

## Why it matters

A closed set of directory names is only worth writing down if it stays closed. The first directory
outside it costs nothing — it is correctly cased, it sits in a plausible place — but the table stops
describing the tree, and from then on a reader who has met one exception has to open every directory
to learn what it holds.

`architecture/directory-naming` checks a directory's **casing**; this checks its **name**. A
`helpers/` is perfectly camelCase, so no casing declaration objects to it.

## How to fix

Rename the directory to a declared name, move it under one of them, or add its name to the
declaration — deciding to widen the set is a legitimate outcome, as long as it is a decision.

## Configuration

| Option       | Type                                        | Default |
| ------------ | ------------------------------------------- | ------- |
| `scopes`     | map of directory glob → allowed child names | `{}`    |
| `unitScopes` | map of root glob → allowed child names      | `{}`    |
| `exclude`    | list of directory globs                     | `[]`    |

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

**A `scopes` key names the parent directly.** `'src/lib'` matches `src/lib`, and the names its
immediate subdirectories may take are the ones you list.

**A `unitScopes` key names a root.** `'src/**'` matches every directory beneath `src`, and the rule
governs the children of whichever of them are **units** — a directory whose name begins with a capital
and which holds a file named after it (`Card/Card.svelte`, `Card/Card.ts`, `Card/Card.svelte.ts`). Use
it for a closed set that hangs off something a glob cannot reach, because units nest to arbitrary
depth.

A `scopes` key is only worth writing where the children are **entirely** drawn from the names you
list. A route directory holds its reserved names beside its route segments, and route segments are
unbounded — one per page — so no declaration belongs there. Writing one anyway reports every segment.

The same applies wherever a position mixes reserved names with names the project invents freely. A
camelCase unit that keeps its own nested helpers beside a `tests/` is such a position: the helper names
are as unbounded as route segments, so `scopes: { 'src/**/functions/*': 'tests' }` would report every
one of them. Between the two, the vocabulary is enforceable under component units and at positions
whose children really are a closed list — not everywhere a reserved name appears.

The names in one declaration need not be the names in another. Each declared position has its own
closed set; there is no single table.

### Which declaration wins

When both maps match one directory, the most specific key governs: more path segments first, then
fewer `**` segments, then the longer key, then alphabetically first. That is what lets either map
narrow the other.

Two **identical** globs are the only pair those steps cannot separate, and there `scopes` wins —
because it applies to every directory its key matches, while `unitScopes` applies only to the ones
that are units. Declaring the same glob in both maps is reported: `scopes` wins wherever both are
declared, so the `unitScopes` entry does nothing there. (It can still govern elsewhere — e.g. a
`unitScopes` key declared globally and shadowed by a `scopes` key added only inside an `overrides`
entry still governs outside that override's scope.)

A **trailing** `/**` means "everything under this directory" and never governs the directory itself.

### `exclude`

**`exclude` removes a directory and everything beneath it.** Use it for a subtree whose names you do
not control:

```js
options: {
  unitScopes: { 'src/**': 'parts|functions|tests' },
  exclude: ['**/generated']
}
```

## Limitations

Only directories under `src/` are considered. File names are not checked. Dot directories never
appear, so they need no excluding.

**A directory beginning A–Z that holds no file named after it is not a unit here**, and this rule
says nothing about its children. That directory is `architecture/unit-entry-file`'s finding —
reported once, rather than once per child.

"Named after it" compares the directory name against the filename up to its **first** dot, which is
what lets `Card/Card.svelte.ts` count. One consequence: a directory whose only such file is a test —
`Card/Card.test.ts` — counts as a unit too, and its children are checked. The alternative, stripping a
single extension, would reject a real entry-file shape, and a finding a reader can dismiss is the
milder failure.

The cut applies only to the filename, not the directory name — the directory's basename is compared
whole. So `src/lib/Card.v2/` is **not a unit here**, even though it holds `Card.v2.svelte`: the stem of
that filename up to its first dot is `Card`, which does not equal the directory's own uncut name
`Card.v2`. Its children go unchecked. `architecture/unit-entry-file`, configured with an explicit extension, asks a
different question — whether `Card.v2` + `.svelte` exists — and answers yes for the same directory.
Both answers are consistent with each rule's own definition.

The rule says "here, only these names". It cannot say "this name, only here": a `parts/` in the wrong
place is invisible unless that place is itself declared.

**A project that nests units directly inside units should not declare `unitScopes`** — the nested unit
is a child not in the set, and would be reported.

A declaration that is not checking what it says is reported, so a typo cannot leave the rule silently
doing nothing. Five cases land in that finding, each named in the message:

- the glob matched no directory;
- every directory it matched is excluded;
- it matched directories but never a unit;
- the value lists no name at all;
- the same glob is declared in both maps, with **both** values naming at least one directory. If either value names nothing it is dropped before matching, so the other governs alone and the empty-value reason reports instead.

Two things are never reported:

- A declaration written **only** inside an `overrides` entry, since whether it matched anything
  depends on which paths the override applies to. One exception: the identical-glob collision check
  is not narrowed to globally declared keys, so a `scopes`/`unitScopes` collision assembled entirely
  from `overrides` entries is still reported.
- A declared name no directory currently uses — the set says what **may** appear, not what must.
