---
'@svelte-vitals/core': patch
---

`performance/load-waterfall` no longer counts awaiting a promise an earlier result hands over, such as one an ancestor load started and passed down through `parent()` (`const { deferred } = await parent(); await deferred.state`), as a network hop: no request starts there. A promise the load itself starts from an earlier result (`const p = fetch(user.url); await p`) is still a hop.
