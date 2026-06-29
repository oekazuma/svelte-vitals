---
'svelte-vitals': minor
---

Resolve SvelteKit layout breakouts in static (CLI) mode (#12). `+page@.svelte` /
`+page@segment.svelte` pages are now enumerated (previously skipped entirely),
and the layout chain honors `+page@` / `+layout@` resets — so a route that breaks
out inherits the correct layouts instead of the full ancestor chain. The route
URL is unchanged (the `@segment` only affects layout inheritance).
