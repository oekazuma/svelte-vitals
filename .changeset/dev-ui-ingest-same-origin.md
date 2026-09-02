---
'@svelte-vitals/vite': patch
---

The dev dashboard's `/__svelte-vitals/ingest` endpoint now rejects a request whose `Origin` header does not match the dashboard's own host and port (requests without an `Origin`, such as the server-side handle's own POSTs, are accepted as before), and answers 413 as soon as a body exceeds 4 MiB. Previously a page served from any other localhost port could inject findings — including fix snippets that reach "Copy AI prompt" — into the dashboard.
