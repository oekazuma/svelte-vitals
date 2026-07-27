---
title: performance/heavy-import · Heavy dependency import
description: Avoid importing large, non-tree-shakeable packages.
---

**Severity:** info · **Category:** performance

## What it checks

Flags an `import` from a well-known heavy / non-tree-shakeable package (currently `lodash`, `moment`). Matched by exact specifier, so a subpath import like `lodash/debounce` is **not** flagged. Static (CLI) analysis of `src/**/*.svelte` scripts.

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

Configured packages are **added to** the built-in list, not a replacement for it — a project keeps
flagging `lodash` and `moment` even after adding its own entries, and picks up any package the
built-in list grows to cover in a later svelte-vitals release. Reusing a built-in key keeps the
package on the list but replaces its advice, so `{ lodash: 'use our own helpers' }` rewords the
finding instead of adding a second entry.

```js
// svelte-vitals.config.js
export default {
  rules: {
    'performance/heavy-import': { options: { packages: { 'chart.js': 'import chart.js/auto' } } }
  }
};
```
