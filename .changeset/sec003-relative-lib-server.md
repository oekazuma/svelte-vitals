---
'@svelte-vitals/core': patch
---

SEC003 no longer flags `.set()`/`.update()` calls on modules imported from `src/lib/server/**` via a relative path — the exemption now checks the resolved path, not just the `$lib/server/` alias form.
