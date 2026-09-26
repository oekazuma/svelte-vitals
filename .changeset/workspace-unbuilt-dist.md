---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Source analysis now follows a workspace package whose `exports` or `svelte` field name its build output in `dist/` when the checkout has not built it yet: the component is read from the same path under the package's `src/` or `src/lib/` (`./dist/components/SEO.svelte` → `src/components/SEO.svelte`). A head component from such a package was not followed, so every route rendering it was reported as missing its title, description and social tags. A built checkout still reads `dist/`. Tags the component renders only under a condition now count as may-render on those routes, so a "Missing JSON-LD" on a page that does not pass the component's JSON-LD prop is no longer reported.
