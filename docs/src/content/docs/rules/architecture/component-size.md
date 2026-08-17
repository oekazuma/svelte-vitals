---
title: architecture/component-size · Component size
description: Very large components should be split up.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a `.svelte` component longer than 200 lines (static/CLI analysis of `src/**/*.svelte`).

The threshold comes from the same survey of real Svelte 5 codebases as `architecture/prop-count`, and sits deliberately above the measured 90th and 95th percentiles: length is a weaker signal than a wide prop surface, because tables, forms, and generated markup are legitimately long.

## Why it matters

A very large component is hard to read, test, and reuse, and usually means several responsibilities should be split out — a common shape for AI-generated code.

## How to fix

Extract sections into smaller, focused child components (and reusable `.svelte.ts` modules for logic).

## Configuration

| Option | Type    | Default |
| ------ | ------- | ------: |
| `max`  | integer |     200 |

```js svelte-vitals.config.js
export default {
  rules: { 'architecture/component-size': { options: { max: 300 } } }
};
```

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/component-size -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/component-size': 'off'
  }
};
```
