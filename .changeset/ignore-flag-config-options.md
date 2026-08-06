---
'svelte-vitals': patch
---

Fix `--ignore` silently discarding a config file's per-rule settings and options for every other
rule. `--ignore` was translated into a partial `rules` map containing nothing but `'off'` entries
for the ids it named, and that map replaced the config file's `rules` field outright instead of
layering on top of it — so `--ignore some/unrelated-rule-id` dropped severities and options (e.g.
a configured `max` or `directories`) declared for every rule not named, and those rules ran with
their built-in defaults instead.

The failure was silent: exit 0, no warning, and the flag didn't even have to name the affected
rule — ignoring one unrelated rule was enough to reset every other rule's options. A run narrowed
with `--ignore` could report clean indefinitely while the config file's intent was being ignored.

`--ignore` now only ever adds `'off'` entries for the rule ids it names, layered on top of
whatever the config file (or `--rules`) already resolved `rules` to. `--rules` still means "run
only these rules" and still overrides a config-file `'off'` for the ids it names, and it now
inherits their severity and options instead of discarding them.
