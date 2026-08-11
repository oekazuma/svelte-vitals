---
'svelte-vitals': minor
---

A mistyped sub-command or rule id now gets a `did you mean …?` hint appended after the existing error message, on four surfaces: `svelte-vitals <mistyped-subcommand>` falling through to the root analyzer as a path that doesn't exist on disk (e.g. `svelte-vitals isntall`), `docs <unknown-subcommand>`, `ci <unknown-subcommand>`, and `explain <unknown-rule-id>`. The hint only appears when the typed token is close to a real name and, for the root analyzer, when the explicit path does not exist on disk — an existing path is always analyzed as asked, never redirected. Nothing about the existing error wording, exit codes, or stdout/stderr split changes; the hint is a new, additional line.
