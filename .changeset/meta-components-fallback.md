---
'svelte-vitals': patch
---

`metaComponents` is now a fallback, not an override: a declared component is only credited as a broad meta source when the analyzer cannot resolve it (bare specifier, missing file, depth limit, cycle). Declaring a resolvable local wrapper no longer discards its transitively resolved tags — previously it silently lost `seo/json-ld` (and the wrapper's subtree dropped out of a11y composition), so adding the option could make results strictly worse.

Behavior change: a project that declared a resolvable local component whose head tags are statically invisible was previously granted broad credit for it; those routes' findings now reappear. Declare only components the analyzer cannot follow.
