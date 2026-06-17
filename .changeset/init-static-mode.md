---
'svelte-vitals': patch
'@svelte-vitals/core': patch
---

Initial release: the static-mode SEO foundation.

- `npx svelte-vitals` scans a SvelteKit project and checks `<title>` presence (SEO001) by statically parsing `<svelte:head>` with `svelte/compiler`, resolving the full layout chain (`+layout.svelte` → … → `+page.svelte`).
- Two-axis detection (presence × value): a dynamic title such as `<title>{data.title}</title>` is recognized and never reported as missing; it passes with a `↯` marker. Only genuinely missing or empty metadata is flagged.
- Runtime-agnostic `@svelte-vitals/core` (types, rule engine, reporter) with a `Runtime` I/O abstraction, plus a Node adapter in the CLI. Exit codes: `0` ok, `1` critical finding, `2` execution error.
