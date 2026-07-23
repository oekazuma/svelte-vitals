---
'svelte-vitals': minor
---

Warn (stderr, non-blocking) when the analyzed project declares a `svelte` or `@sveltejs/kit` version below what rules assume (Svelte 5+ runes, SvelteKit 2+) — rules that key off runes syntax can't recognize the legacy (`export let` / `$:`) equivalent of the same bugs, so findings may be incomplete for components that haven't migrated to runes yet.
