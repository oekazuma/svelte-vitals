---
'@svelte-vitals/vite': patch
---

`svelteVitalsHandle` now records a route's ingest signature only after the dashboard acknowledged the POST, so a route whose first ingest was lost (dev server restarting, a rejected origin, a transient socket error) is retried on its next render instead of staying `static` for the rest of the session. POSTs for the same route are sent in render order, so a slow earlier ingest can no longer overwrite a newer one. With `SVELTE_VITALS_DEBUG` set, a rejected or failed ingest is logged.
