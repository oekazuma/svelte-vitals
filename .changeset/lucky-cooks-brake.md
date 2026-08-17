---
'@svelte-vitals/core': patch
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Stop a low open-file limit from silently shrinking the analysis.

Every `.svelte` file in a project was read in parallel with no bound, so on a large project the
process ran out of descriptors. `EMFILE` was raised on `open`, but each read sits inside the
per-file `try`/`catch` that exists for malformed components — so the file was recorded as a parse
failure, dropped, and the run carried on. Measured on a real 1 681-route project:

| `ulimit -n` | routes analysed | findings | files skipped | reported health |
| ----------- | --------------- | -------- | ------------- | --------------- |
| 256         | 232             | 93       | 1 450         | 94              |
| 1 024       | 1 000           | 150      | 682           | 94              |
| 4 096       | 1 681           | 191      | 0             | 94              |

At 1 024 — a common container default — 40% of the project went unexamined, 41 findings vanished,
and **the score did not move**. Nothing in the report said how much had been skipped.

Reads are now capped at 64 in flight, in both the CLI and the Vite plugin. The same project at
`ulimit -n 256` now analyses all 1 681 routes and reports all 191 findings, and the cap costs
nothing measurable (1 000 routes: 406ms capped vs 403ms unbounded) because reads are ~3% of the
work.

A file that could not be **read** is also now distinguished from one that could not be **parsed**,
for components and SvelteKit modules alike. The two shared a message, which is how a descriptor
limit read as hundreds of broken components; an unreadable file now says so and points at
permissions and `ulimit -n`.

The Vite plugin reports skipped files too. It previously warned about config problems and crashed
rules but never about files a collector dropped, so an `EACCES` during `vite build` was scored as
empty facts in silence. Both packages now format the warning with one shared function.
