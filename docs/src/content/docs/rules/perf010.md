---
title: PERF010 · Namespace import
description: Prefer named imports over import * as for tree-shaking.
---

**Severity:** info · **Category:** performance

## What it checks

Flags a value `import * as X from '<package>'` from a bare (node_modules) package. Type-only imports (`import type * as T`) and non-bare specifiers (relative, `$lib`, `$app`, `$env`, `#…`) are not flagged. Static (CLI) analysis of `src/**/*.svelte` scripts.

## Why it matters

A namespace import forces the bundler to retain the entire module, so unused exports cannot be tree-shaken out — even packages like `three` or `d3` ship less when imported by name.

## How to fix

```svelte
<script>
  // Instead of:  import * as _ from 'lodash';
  import debounce from 'lodash/debounce';

  // Instead of:  import * as THREE from 'three';
  import { Scene, WebGLRenderer } from 'three';
</script>
```
