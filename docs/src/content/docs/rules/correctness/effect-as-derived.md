---
title: correctness/effect-as-derived · Effect used to derive state
description: Use $derived instead of an $effect that only assigns state.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` whose body only assigns to `$state` variables. Checked by static (CLI) analysis of component instance scripts.

## Why it matters

Synchronising state with an `$effect` (the "useEffect → $effect" habit from React) runs after render and can trigger extra render passes or loops. A `$derived` value expresses the same dependency declaratively — Svelte recomputes it lazily, the next time it's read, rather than scheduling a separate effect run.

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

`$derived` recomputes on next read, including during hydration; `$effect` runs one tick after mount,
which is the whole point here. Converting this shape to `$derived` reintroduces the bug the
`$effect` was added to prevent — so suppress it with a
[`svelte-vitals-disable-next-line`](/guides/cli#suppressing-a-single-finding-inline) comment
rather than "fixing" it.

## Known limitation: browser-global capture

The same structural blind spot also catches the documented fix for
[correctness/server-browser-global](/rules/correctness/server-browser-global) and
[correctness/instance-browser-global](/rules/correctness/instance-browser-global) — an `$effect` that
reads a browser-only global and assigns it to `$state`:

```svelte
<script>
  let stored = $state(null);
  $effect(() => {
    stored = localStorage.getItem('filters'); // flagged here, but don't "fix" it
  });
</script>
```

Converting this to `$derived(localStorage.getItem('filters'))` would evaluate the expression during
SSR — reintroducing the exact `ReferenceError: localStorage is not defined` those two rules exist to
prevent. `localStorage`/`window`/etc. are exactly the values `$derived` cannot safely read, since a
derived expression can run during server-side rendering. Prefer `onMount`, or
[`svelte/reactivity/window`](https://svelte.dev/docs/svelte/svelte-reactivity-window) for `window`
properties — see those two rules' docs for the fix — and suppress this finding rather than switching to
`$derived`.
