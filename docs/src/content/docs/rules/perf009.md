---
title: PERF009 · Heavy dependency import
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
