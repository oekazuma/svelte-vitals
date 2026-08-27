---
title: correctness/effect-as-derived · Effect used to derive state
description: Use $derived instead of an $effect that only assigns state.
---

**Severity:** warning · **Category:** correctness

## What it checks

Flags an `$effect` whose body only assigns to `$state` variables, in the component's instance script.

## Why it matters

Synchronising state with an `$effect` (the "useEffect → $effect" habit from React) runs after render and can trigger extra render passes or loops. A `$derived` value expresses the same dependency declaratively. Svelte recomputes it lazily, the next time it's read, rather than scheduling a separate effect run.

## How to fix

```svelte
<script>
  let count = $state(0);
  // Instead of: $effect(() => { double = count * 2; });
  let double = $derived(count * 2);
</script>
```

## Known limitation: mount-flag / hydration-guard effects

This check is structural, asking only "does the effect body only assign to `$state`?", and not
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

`$derived` recomputes on next read, including during hydration; `$effect` runs only after the
component has mounted to the DOM, which is the whole point here. Converting this shape to
`$derived` reintroduces the bug the `$effect` was added to prevent, so suppress it with a
[`svelte-vitals-disable-next-line`](/guides/cli#suppressing-a-single-finding-inline) comment
rather than "fixing" it.

## Known limitation: browser-global capture

The same structural blind spot also catches the documented fix for
[correctness/server-browser-global](/rules/correctness/server-browser-global) and
[correctness/instance-browser-global](/rules/correctness/instance-browser-global), an `$effect` that
reads a browser-only global and assigns it to `$state`:

```svelte
<script>
  let stored = $state(null);
  $effect(() => {
    stored = localStorage.getItem('filters'); // flagged here, but don't "fix" it
  });
</script>
```

`$derived` only evaluates its expression when something reads the derived value, but a value like
this exists to be read (typically from the template), and a template read happens during SSR too.
Converting this to `$derived(localStorage.getItem('filters'))` would reintroduce the exact
`ReferenceError: localStorage is not defined` those two rules exist to prevent, the moment
something reads it during server-side rendering. `localStorage`/`window`/etc. are exactly the
values `$derived` cannot safely read, because there is no read that is guaranteed client-only.
Prefer `onMount`, or [`svelte/reactivity/window`](https://svelte.dev/docs/svelte/svelte-reactivity-window)
for `window` properties, whose fix those two rules' docs describe, and suppress this finding rather
than switching to `$derived`.

## Mode differences

None. This rule reads source, the same `.svelte` and `.ts` files, everywhere it runs. The CLI, the Vite plugin's build pass, and the live dashboard's static baseline all report it identically, and the rendered-HTML pass never re-evaluates it. Scoping a run with `--route` skips it: component-scoped rules have no route to attribute a finding to.

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line correctness/effect-as-derived -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/effect-as-derived': 'off'
  }
};
```
