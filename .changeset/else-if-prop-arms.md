---
'svelte-vitals': patch
---

`a11y/id-duplication` and `a11y/duplicate-landmark` now decide each `{:else if}` arm of a component on the props its use passes, so `<Limits section="spend" />` and `<Limits section="authority" />` no longer count each other's arms. A test joining a prop test with something else (`section === 'authority' && view`) is decided when the prop test settles it.
