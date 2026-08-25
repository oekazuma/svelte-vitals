---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

Add `performance/iframe-loading`: recommends `loading="lazy"` on `<iframe>` elements. An offscreen iframe typically loads an entire third-party document — scripts, fonts, media — so eager-loading one usually costs more than an offscreen image, and iframes rarely are the LCP element. Severity is `info`: an above-the-fold iframe is legitimately eager and position is statically unknowable. Any literal `loading` value passes (the author made a choice), as do an expression-valued `loading` and a spread attribute.
