---
'@svelte-vitals/vite': patch
---

`svelteVitalsHandle` now drops a route's ingest signature when the dashboard does not acknowledge the POST, so a route whose first ingest was lost (dev server restarting, a transient socket error, a rejected request) is retried on its next render instead of staying `static` for the rest of the session. POSTs for the same route are sent in render order, so a slow earlier ingest can no longer overwrite a newer one, and a render whose findings change back while an older POST is still in flight is sent rather than deduplicated. With `SVELTE_VITALS_DEBUG` set, a rejected or failed ingest is logged.
