---
title: CORRECT002 · Effect used to derive state
description: Use $derived instead of an $effect that only assigns state.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` whose body only assigns to `$state` variables. Checked by static (CLI) analysis of component instance scripts.

## Why it matters

Synchronising state with an `$effect` (the "useEffect → $effect" habit from React) runs after render and can trigger extra render passes or loops. A `$derived` value expresses the same dependency declaratively and updates synchronously.

## How to fix

```svelte
<script>
  let count = $state(0);
  // Instead of: $effect(() => { double = count * 2; });
  let double = $derived(count * 2);
</script>
```

## Known limitation: mount-flag / hydration-guard effects

This check is structural — "does the effect body only assign to `$state`?" — not
semantic, so it can't distinguish a genuine derive-in-an-effect anti-pattern from
the "mount signal" idiom used to avoid SSR/prerender ↔ hydration mismatches:

```svelte
<script>
  let mounted = $state(false);
  $effect(() => {
    mounted = true;
  });
  // Must stay false during SSR/prerender and on the client's first render, or
  // hydration mismatches. $derived(canVibrate()) would evaluate eagerly during
  // hydration, reintroducing the exact flash this $effect exists to avoid.
  const showVibrationToggle = $derived(mounted && canVibrate());
</script>
```

`$derived` is evaluated eagerly, including during hydration; `$effect` runs one
tick after mount, which is the whole point here. Converting this specific shape
to `$derived` is not a style preference — it reintroduces the bug the `$effect`
was added to prevent. If your finding is this pattern, don't "fix" it; suppress
it instead with a
[`svelte-vitals-disable-next-line`](/svelte-vitals/guides/cli/#suppressing-a-single-finding-inline)
comment.
