---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`seo/heading-level-skip` reads a route's headings in document order in source analysis: the page where its layout renders its children (a layout heading after `{@render children()}` no longer comes before the page's), a snippet's heading at its `{@render}`, and a heading a child component renders at the component's tag. A component's heading closes a gap before a route file's heading where it renders whenever that heading does (not from a closed dialog or menu), and is never reported itself. A `<svelte:element>` of an undetermined level holds its place without a level, and the heading after it is not judged. A page heading that skips from a component's heading (a `PageHeader` `<h1>`, then the page's `<h3>`) is now reported; one a component's heading closes the gap before is not.
