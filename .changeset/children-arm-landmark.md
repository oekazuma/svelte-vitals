---
'svelte-vitals': patch
---

`a11y/duplicate-landmark` and `a11y/id-duplication` now place content a layout or component passes to another component (`<Shell>{@render children()}</Shell>`) in the `{#if}` arm where that component renders its children, so a `<main>` or id the component renders only in another arm (a loading or sign-in screen) is no longer counted together with the page's. A component that also hands `children` to another component as a prop keeps the content beside its arms, as before.
