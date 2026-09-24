---
'svelte-vitals': patch
---

Source analysis now composes a route's page (and each inner layout) at the branch where its parent layout renders `{@render children()}` or `<slot />`. An id or landmark in a layout's other `{#if}` arm — for example a set-up form shown only while the page is not rendered — no longer counts as rendering together with the page's copy in `a11y/id-duplication` and `a11y/duplicate-landmark`.
