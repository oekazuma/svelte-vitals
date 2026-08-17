---
title: correctness/server-browser-global · Browser global in server module code
description: window, document, localStorage accessed in module scope or a load/handler crash SSR with a ReferenceError.
---

**Severity:** critical · **Category:** correctness

## What it checks

Flags reads of browser-only globals (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `location`, `history`, `screen`, `matchMedia`, `requestAnimationFrame`, `cancelAnimationFrame`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `alert`, `confirm`, `prompt`) in code that always runs on the server:

- **module scope** of a `.svelte.ts`/`.svelte.js` runes module or a `.svelte` `<script module>` block (crashes when the module is imported on the server), and
- **SvelteKit route/hooks files** — top level, `load`/action/endpoint handler bodies, and the `init` hook (crashes at import or on every request).

Not flagged:

- Code guarded by `browser` from `$app/environment` (aliases included) or a `typeof window !== 'undefined'` check (early-return guards included).
- Code inside `onMount`/`$effect`/ordinary functions — they don't run at module evaluation.
- A bare `typeof window`, which never throws.
- Names you imported or declared yourself (`const document = …`).
- Closures nested inside handlers, typically client callbacks.
- Files that export `ssr = false` themselves.

## Why it matters

None of these globals exist in Node. A module-scope `window` read crashes the server the moment the file is imported; in a `load` it crashes every SSR request — `ReferenceError: window is not defined`, a production 500 the compiler never warns about.

## How to fix

```ts +page.ts
export function load() {
  const stored = localStorage.getItem('filters'); // ❌ ReferenceError on the server

  return {};
}
```

Move the browser access to the client side, in `onMount` — it never runs on the server:

```svelte +page.svelte
<script>
  import { onMount } from 'svelte';

  let stored = $state(null);
  onMount(() => {
    stored = localStorage.getItem('filters'); // ✅ onMount never runs on the server
  });
</script>
```

Or guard it explicitly:

```ts
import { browser } from '$app/environment';

const stored = browser ? localStorage.getItem('filters') : null; // ✅
```

## Disabling

Silence a single occurrence with `<!-- svelte-vitals-disable-next-line correctness/server-browser-global -->` on the line above it, or turn the rule off:

```js svelte-vitals.config.js
export default {
  rules: {
    'correctness/server-browser-global': 'off'
  }
};
```
