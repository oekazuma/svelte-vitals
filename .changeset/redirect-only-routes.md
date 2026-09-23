---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

A page whose own `load` always redirects no longer gets route-level findings. Such a page never renders a document, yet it used to be reported as missing its `<title>`, description, `<h1>` and the rest. The CLI now recognises a `redirect()` or `throw redirect()` sitting directly in the body of the `load` exported from the page's `+page.ts` or `+page.server.ts`, with no earlier `return` and not inside a condition, `try` or helper function, and skips the route's head, heading, image and landmark checks; component-level rules still read its files. This holds under `--route` as well. The Vite plugin skips the redirect stub SvelteKit writes for a route that redirected during prerendering.
