---
'svelte-vitals': patch
---

In source analysis, `seo/json-ld` reads `{@html x}` as JSON-LD when `x` is built by a call given an object literal with an `@context` key (`const faq = scriptTag({ '@context': 'https://schema.org', '@type': 'FAQPage', … })`), whatever the function is named; `JSON.stringify` stays excluded. Such a page used to be reported for missing JSON-LD unless the helper's or the binding's name said JSON-LD.
