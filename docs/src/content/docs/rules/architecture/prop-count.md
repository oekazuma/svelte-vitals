---
title: architecture/prop-count · Prop count
description: Components taking many props are doing too much.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a component that destructures more than 6 props from `$props()`. A rest element (`...rest`) beside named props doesn't stop the named props from being counted — only a bare rest element with no named props, or a non-destructured `$props()`, is not counted.

The threshold is measured, not guessed. 6 is the median per-repository 90th percentile of prop counts across a survey of real Svelte 5 codebases — so in a typical project, a component with 7 or more props is wider than roughly nine in ten of the components whose props can be counted. Widening the survey to 13 repositories left the number unchanged; a later fix that also counts named props destructured beside a `...rest` element re-measured the per-repo p90 median at 6.5, and the default stays 6 pending review of that update.

## Why it matters

A component with a large prop surface is usually doing too much; grouping related props or splitting the component keeps its API understandable.

## How to fix

```svelte
<script>
  // Group related props into an object instead of many flat props.
  let { user, layout } = $props(); // user: { name, avatar, … }
</script>
```

## Configuration

| Option | Type    | Default |
| ------ | ------- | ------: |
| `max`  | integer |       6 |

```js svelte-vitals.config.js
export default {
  rules: { 'architecture/prop-count': { options: { max: 10 } } }
};
```

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line architecture/prop-count -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'architecture/prop-count': 'off'
  }
};
```
