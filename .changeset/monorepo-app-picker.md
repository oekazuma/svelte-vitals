---
'svelte-vitals': minor
---

Running `npx svelte-vitals` at a monorepo root with no path argument no longer dead-ends on "No SvelteKit project found": it detects SvelteKit apps underneath and either analyzes the only one found (with a stderr notice) or, in an interactive terminal, offers a single-select prompt to pick one. Non-interactive environments (CI, agents) still never prompt — they get exit `2` with the detected app list and a hint to pass a path explicitly. Passing an explicit path always skips detection, so existing invocations are unaffected.
