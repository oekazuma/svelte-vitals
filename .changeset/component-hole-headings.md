---
'svelte-vitals': patch
---

Source analysis now places content passed to a component — its children, or a `{#snippet}` in its tag — in the arm where that component renders it. A layout that wraps the page in an error-boundary component (`{@render children()}` and an error screen in one `<svelte:boundary>`), or in a guard component that renders `children` or a `fallback` snippet in exclusive `{#if}` arms, no longer has the wrapper's `<h1>` counted together with the page's in `seo/single-h1`. A snippet a file renders is now read at each `{@render}` of it instead of where it is defined, so a snippet's `<h1>` rendered from exclusive `{#if}` arms counts once, and `seo/heading-level-skip` reads its headings in their rendered position: a skip can now be reported at a snippet's heading, and one rendered twice counts twice.
