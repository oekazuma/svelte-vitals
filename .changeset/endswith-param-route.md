---
'svelte-vitals': patch
---

A layout's or page's `{#if}` on `page.url.pathname.endsWith('…')` is now decided on a route with a parameter before the literal end, such as `/invoices/[id]/print`, by that literal end, as the rule docs describe. Before, such a test was left undecided there, so `a11y/duplicate-landmark`, `a11y/top-level-landmark`, `a11y/id-duplication`, `seo/single-h1` and `seo/heading-level-skip` counted the arms it rules out.
