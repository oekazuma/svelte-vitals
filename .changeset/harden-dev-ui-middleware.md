---
'@svelte-vitals/vite': patch
---

Harden the dev UI middleware: reject non-loopback origins/hosts, fully validate ingested findings against what the dashboard renderer dereferences, and never let a malformed payload crash the dashboard.
