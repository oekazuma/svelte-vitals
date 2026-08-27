---
title: architecture/private-scope-import · Private-scope import
description: A unit inside a private directory should not be imported from outside it.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags an import of a file inside a directory you have declared private, made from outside that directory's owner.

This rule is **off until you configure it**. It has no default convention, because where a project keeps its private code is the project's own decision.

## Why it matters

Code placed in a private directory is written for one owner. Importing it from elsewhere couples two parts of the tree that were meant to move independently: renaming or deleting the owner now breaks a stranger. The unit belongs higher up, in the directory its importers share.

## How to fix

Move the unit out of its private directory, up to the directory shared by all of its importers, and update the import paths. Or keep it private and import it only from inside its own scope.

## Configuration

| Option   | Type          | Default |
| -------- | ------------- | ------- |
| `scopes` | list of globs | `[]`    |

Each glob matches a **private directory**, and its **parent** becomes the boundary: files inside the parent may import from it, files outside may not.

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': {
      options: { scopes: ['**/parts', 'src/routes/**/components'] }
    }
  }
};
```

With that configuration:

- `Card/parts/Badge.svelte` is importable from anywhere under `Card/`, and nowhere else.
- `src/routes/blog/components/Toc.svelte` is importable from anywhere under `src/routes/blog/`, and nowhere else.
- `src/lib/components/Button.svelte` is unconstrained: no glob matches it, so the same directory name means something different here.

When private directories nest, the innermost one wins: with `**/parts`, a unit in `A/parts/B/parts/C` is private to `A/parts/B`, not to `A`.

In globs, `*` matches within a path segment and `**` across segments. A `**` between two segments matches one segment or more, not zero, so `src/routes/**/components` does not match `src/routes/components`. List both patterns if you have a private directory at that level.

## Limitations

Imports written in `.svelte` components and `.svelte.ts` / `.svelte.js` modules are checked. Imports written in a Kit module such as `+page.ts` or `+server.ts` are not checked yet.

This is a gap being closed, not a deliberate exemption.

A type-only import (`import type { X } from '../parts/types'`) is flagged the same as a value import: the structural coupling to the private unit's location survives into source even though the import itself is erased at build.

An import that names a private directory itself, rather than a file inside it (for example `import { Badge } from '../Card/parts'`), is not checked. This is a deliberate limitation, not a gap: resolving it to the directory's own contents would trade this false negative for a false positive elsewhere.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/private-scope-import -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/private-scope-import': 'off'
  }
};
```
