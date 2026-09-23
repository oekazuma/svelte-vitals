---
'svelte-vitals': patch
---

Source analysis no longer counts a page's (or nested layout's) top-level `<header>`/`<footer>` as a `banner`/`contentinfo` landmark when the layout above renders it inside `<main>` or `<aside>`. `a11y/top-level-landmark` reported "banner nested inside main" and `a11y/duplicate-landmark` could count a second banner for markup whose rendered DOM has no such landmark, disagreeing with `@svelte-vitals/vite`'s build-time result.
