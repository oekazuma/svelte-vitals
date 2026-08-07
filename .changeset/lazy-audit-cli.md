---
'svelte-vitals': minor
---

Replace the `mri` argument parser with Node's built-in `util.parseArgs` and remove the unused `buildRulesConfig` export (superseded by the rule-selection resolver).

Flag names, aliases, boolean `--flag=false` handling, and unknown-flag passthrough are unchanged. Edge cases on malformed input differ slightly: a repeated string flag now takes the last value instead of being ignored, a string flag passed without a value now falls back to its default (or exits with a clear error for `--min-health`/`--baseline`) instead of being treated as an empty string, and a value following an unknown flag is now treated as a positional argument instead of being swallowed by that flag. `--baseline` additionally rejects values that start with `-`, so a following flag (e.g. `--baseline --force`) can never be silently consumed as the ref.
