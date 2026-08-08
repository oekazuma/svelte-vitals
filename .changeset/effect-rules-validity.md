---
'@svelte-vitals/core': patch
---

Two `correctness/effect-*` rule content fixes from the v1.0 rule-validity review:

- `correctness/effect-as-onmount` no longer flags an `$effect` that reads a reactive value through
  a member expression on an imported binding or a local declared with a `new …()` initializer — a
  class instance with `$state` fields, a `SvelteMap`/`SvelteSet`, an imported runes-module state
  object, and `svelte/reactivity/window` were all indistinguishable from the true mount-only
  positive, and the rule's "use `onMount` instead" advice would have converted a re-running effect
  into run-once. The change is strictly narrowing (only removes findings, never adds one); the
  rule's message, recommendation, and docs now name `{@attach}` and event handlers alongside
  `onMount` instead of presenting `onMount` as the sole fix, and the docs admit the remaining blind
  spots (a reactive value reached only through a plain function's return value, or through a local
  assigned `new …()` after its declaration instead of at it).
- The documented fix snippets for `correctness/server-browser-global` and
  `correctness/instance-browser-global` now use `onMount` (and, for the latter,
  `svelte/reactivity/window` as the preferred modern form) instead of an `$effect` that assigns a
  browser global to `$state` — that snippet was itself flagged by `correctness/effect-as-derived`,
  whose "use `$derived`" advice would reintroduce the SSR `ReferenceError` those two rules exist to
  prevent. `correctness/effect-as-derived`'s docs gain this as a second known limitation, and drop
  an inaccurate "$derived updates synchronously" claim in favor of describing its actual push-pull,
  lazy-recompute behavior.
