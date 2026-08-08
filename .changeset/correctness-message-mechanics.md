---
'@svelte-vitals/core': patch
---

Corrected the failure-mechanism claims in three correctness rules' messages, rationale, and docs (severities unchanged):

- `correctness/checkable-bind-value`: `bind:value` on a **checkbox** throws `bind_invalid_checkbox_value` only in a development build — the rule text claimed it silently "freezes," which is only true in production (where the binding falls back to tracking the `value` attribute). The radio message was already correct and is unchanged.
- `correctness/orphan-effect`: the rule claimed a `production 500`. The server compiler deletes `$effect`/`$effect.pre` calls entirely, so SSR renders without error — the `effect_orphan` crash actually happens client-side, at module evaluation, breaking hydration.
- `correctness/orphan-lifecycle`: `onMount`/`beforeUpdate`/`afterUpdate`/`createEventDispatcher` are silent no-ops on the server (and `onDestroy` throws a plain `TypeError`, not `lifecycle_outside_component`) — so "throws `lifecycle_outside_component`" was wrong for a Kit module that only ever runs on the server (`+page.server.ts`, `+server.ts`, `hooks.server.ts`). The context functions (`getContext`/`setContext`/`hasContext`/`getAllContexts`) do still throw there, and every name is unchanged for universal Kit modules (`+page.ts`/`+layout.ts`) and component-scoped code, since those also run in the browser.
