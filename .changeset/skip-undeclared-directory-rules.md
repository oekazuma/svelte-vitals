---
'@svelte-vitals/core': patch
---

Skip the three directory-shaped Architecture rules entirely when no config layer mentions them.
`architecture/unit-entry-file`, `architecture/directory-naming` and
`architecture/reserved-directory-names` read their options per directory, so an unconfigured project
was resolving and discarding options once for every directory under `src/`, three times over — on
every dev-server save. Measured over a synthetic tree of 1,523 directories, that cost 5.4 ms per
analysis for rules that are off by default and produce nothing. It is now zero.
