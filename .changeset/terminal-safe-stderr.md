---
'@svelte-vitals/core': minor
'svelte-vitals': patch
---

`@svelte-vitals/core` now exports `terminalSafe`, the ANSI/OSC/C0 escape stripper already used by the console reporter, for sinks outside the reporters.

`svelte-vitals`'s stderr diagnostics (skipped files, failed rules, app detection, and other errors) now strip terminal escape sequences from analyzed-repo-derived strings before printing, matching the console reporter's existing protection.
