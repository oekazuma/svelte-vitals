---
'@svelte-vitals/vite': patch
---

The dev dashboard's `/__svelte-vitals/ingest` endpoint now accepts POSTs only from the dashboard's own origin (same host and port) or from the server-side handle, and answers 413 to bodies over 4 MiB. Previously a page served from any other localhost port could inject findings — including fix snippets that reach "Copy AI prompt" — into the dashboard.
