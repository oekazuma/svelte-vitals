---
title: performance/sequential-awaits · Sequential independent awaits
description: Awaits that don't use each other's results still run one after another; start them together.
---

**Severity:** info · **Category:** performance

## What it checks

Flags an await in a `load` function (universal or server) that uses no result from any await before it. The requests serialize for no data-flow reason.

Detection uses the same conservative straight-line scan as `performance/load-waterfall`: forward taint through bindings and intermediate constants, callback-parameter shadowing respected, `await parent()` exempt. Awaiting an already-created promise (`await somePromise`) starts no request and is never flagged.

## Why it matters

Two independent requests awaited sequentially cost the sum of their latencies; started together they cost only the slowest. In a load function this is pure waste on every page visit. `Promise.all` gives the same data with no behavior change when the requests are truly independent.

## How to fix

```ts
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

## Limitations

Static data flow cannot see side-effect ordering. If an earlier await performs setup a later request relies on (sessions, locale, cache warming), the sequence is intentional. That is why this rule reports at `info` severity. Suppress a deliberate sequence per line with `// svelte-vitals-disable-next-line performance/sequential-awaits`, or raise/lower the severity in your config.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

```js svelte-vitals.config.js
export default {
  rules: {
    'performance/sequential-awaits': 'off'
  }
};
```
