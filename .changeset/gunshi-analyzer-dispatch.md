---
'svelte-vitals': minor
---

The CLI's argument parsing and dispatch now run on gunshi (the root analyzer joins `docs` and `explain`), and the root `--help` output's options section is generated from the argument declarations instead of hand-maintained — its formatting changes shape once. Everything else is pinned unchanged by the characterization suite: flags and their meanings, exit codes, error wording, `--version` output, and reporter stdout are all byte-identical.
