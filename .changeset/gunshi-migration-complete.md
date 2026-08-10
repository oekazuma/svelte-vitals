---
'svelte-vitals': minor
---

The CLI migration to gunshi is complete: `install` and `ci` join the analyzer, `docs`, and `explain`, and the legacy argument-parsing layer is removed. Two declared movements: the `--help` output of `docs`/`explain`/`install`/`ci` now generates its options section from the argument declarations (same hybrid format the root command adopted), and `ci <unknown-subcommand>` prints its guidance to stderr instead of stdout before exiting 2 — stdout is now empty on every exit-2 path without exceptions. All flags, exit codes, error wording, and reporter outputs are otherwise byte-identical, pinned by the characterization suite.
