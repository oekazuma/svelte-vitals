---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

Sanitize the two remaining output sinks that carried analyzed-repo strings raw. The interactive app picker and the install plan confirmation now pass directory names and plan text through `terminalSafe` before `@clack/prompts` renders them (the selected value is still the raw path). The SARIF reporter now URI-encodes `artifactLocation.uri`, so a path with `#`, `?`, `%`, spaces or non-ASCII characters attaches the alert to the right file in code scanning. Dynamic route segments are encoded in their RFC 3986 form (`src/routes/[slug]/+page.svelte` becomes `src/routes/%5Bslug%5D/+page.svelte`); `/` and `+` are left as they are, so `src/routes/+page.svelte` is unchanged. `partialFingerprints` are unchanged.
