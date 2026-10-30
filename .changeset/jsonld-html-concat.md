---
'svelte-vitals': patch
---

In source analysis, `seo/json-ld` reads `{@html open + json + close}` as JSON-LD when one part of the string concatenation or template literal is a script binding already read as building a JSON-LD block (`const open = '<script type="application/ld+json">'`). Such a page used to be reported for missing JSON-LD, since only `{@html x}` of a single binding was followed. A call given such a binding (`{@html ldTag(item)}`) is still not followed.
