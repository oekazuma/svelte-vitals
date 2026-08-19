---
title: performance/namespace-import · Namespace import
description: Prefer named imports over import * as for tree-shaking.
---

**Severity:** info · **Category:** performance

## What it checks

Flags a value `import * as X from '<package>'` from a bare (node_modules) package. Type-only imports (`import type * as T`) and non-bare specifiers (relative, `$lib`, `$app`, `$env`, `#…`) are not flagged.

## Why it matters

A namespace import (`import * as X`) is only tree-shakeable while every access to `X` stays static (`X.foo()`). Passing `X` around, or indexing it dynamically (`X[key]`), forces the bundler to assume every export is reachable and keep the whole module.

Named imports are reliably shakeable and make the dependency surface explicit. With a bundler that tree-shakes, that can cut real weight from packages like `three` or `d3`; the guarantee is the shakeability, not a smaller bundle in every setup.

## How to fix

```svelte
<script>
  // Instead of:  import * as _ from 'lodash';
  import debounce from 'lodash/debounce';

  // Instead of:  import * as THREE from 'three';
  import { Scene, WebGLRenderer } from 'three';
</script>
```

## Mode differences

None. This rule reads source — the same `.svelte` and `.ts` files — on every surface: the CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line performance/namespace-import -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/namespace-import': 'off'
  }
};
```
