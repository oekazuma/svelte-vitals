---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

`svelte-vitals` now exports `globFiles`, the file-only, POSIX-path `node:fs` glob its own collectors use; `@svelte-vitals/vite` imports it instead of carrying a copy, so this `@svelte-vitals/vite` release requires this `svelte-vitals` release — the peer range says so. `@svelte-vitals/vite/hooks` resolves straight to the handle module (the one-line barrel is gone) — the subpath and its exports are unchanged. No findings change.
