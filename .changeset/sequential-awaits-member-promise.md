---
'@svelte-vitals/core': patch
---

`performance/sequential-awaits` no longer flags an await of a promise held in a property, such as `await mgr.loading`. Like `await somePromise`, it starts no request, so there is nothing to run in parallel; only awaits of a call, tagged template, `new`, or `import()` count as starting work.
