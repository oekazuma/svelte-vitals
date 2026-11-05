---
'svelte-vitals': patch
---

Read a message function passed to a prop (`title={m.title()}`, `title={m.nav.title({ count })}`) as non-empty text, the way a translation call given a string literal already was: `{#if title}` in the component is decided, so its heading counts in `seo/single-h1` and `seo/heading-level-skip`, and no longer leaves a skip reported on the content after it.
