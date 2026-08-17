---
title: performance/heavy-import · Heavy dependency import
description: Avoid importing large, non-tree-shakeable packages.
---

**Severity:** info · **Category:** performance

## What it checks

Flags an `import` from a well-known heavy / non-tree-shakeable package (currently `lodash`, `moment`). Matched by exact specifier, so a subpath import like `lodash/debounce` is **not** flagged. Static (CLI) analysis of `src/**/*.svelte` scripts.

A **type-only** import is not flagged — `import type { Moment } from 'moment'`, or one whose every specifier is inline-typed — because it is erased at build and adds nothing to the bundle.

`architecture/private-scope-import` still reports type-only imports: that rule is about coupling between parts of your tree, which a type import creates just the same.

## Why it matters

Importing a large, non-tree-shakeable package pulls its whole weight into the bundle even when you use a fraction of it, slowing page load.

## How to fix

```svelte
<script>
  // Instead of:  import _ from 'lodash';
  import debounce from 'lodash/debounce'; // or use lodash-es

  // Instead of:  import moment from 'moment';
  import { format } from 'date-fns'; // or dayjs
</script>
```

## Configuration

| Option     | Type                               | Default            |
| ---------- | ---------------------------------- | ------------------ |
| `packages` | map (package → remediation advice) | `lodash`, `moment` |

Configured packages are **added to** the built-in list, never a replacement: a project keeps flagging
`lodash` and `moment` after adding its own entries, and picks up whatever the built-in list grows to
cover in a later release.

Reusing a built-in key keeps the package on the list but replaces its advice, so
`{ lodash: 'use our own helpers' }` rewords the finding rather than adding a second entry.

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } }
  }
};
```

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line performance/heavy-import -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/heavy-import': 'off'
  }
};
```
