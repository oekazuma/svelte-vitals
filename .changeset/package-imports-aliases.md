---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Components imported through a package.json `imports` entry (`#lib/*`, as svelte.dev and many SvelteKit apps use) are now followed like `$lib` imports. They were treated as unresolvable, so their headings, head tags and landmarks were invisible: a page whose `<h1>` came from `#lib/ui/heading.svelte` was reported as "Missing `<h1>`".
