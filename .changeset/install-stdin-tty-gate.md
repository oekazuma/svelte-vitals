---
'svelte-vitals': patch
---

`install` no longer hangs waiting for input when stdin is piped while stdout is a terminal — interactive prompts now require both stdin and stdout to be TTYs, matching the analyzer's existing gate.
