---
title: architecture/prop-count · Prop count
description: Components taking many props are doing too much.
---

**Severity:** info · **Category:** architecture

## What it checks

Flags a component that destructures more than 6 props from `$props()`. A rest element (`...rest`) or a non-destructured `$props()` is not counted.

The threshold is measured, not guessed. 6 is the 90th percentile of prop counts across a survey of real Svelte 5 codebases, so a component with 7 or more props is wider than roughly nine in ten of the components whose props can be counted. Widening the survey did not move the number.

## Why it matters

A component with a large prop surface is usually doing too much; grouping related props or splitting the component keeps its API understandable.

## How to fix

```svelte
<script>
  // Group related props into an object instead of many flat props.
  let { user, layout } = $props(); // user: { name, avatar, … }
</script>
```
