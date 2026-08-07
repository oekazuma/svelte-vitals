---
'svelte-vitals': minor
---

Fix `--rules` discarding a named rule's own severity and options from the config file. `--rules
<id>` previously ran the named rules at built-in defaults, so an option-configured rule (an integer
`max`, a `packages`/`origins` list, a `directories` map, ...) could not be run alone — its
configured thresholds and globs were gone for the run. For a rule that is inert until its
convention is declared, this meant no convention at all: the rule reported nothing, at exit 0, with
no warning.

`--rules` now inherits that configuration while still narrowing the run to the rule ids it names,
and still overriding a config-file `'off'` for those ids — turning a rule off is itself selection,
so `--rules <that rule>` still force-enables it, only now under its declared severity and options
instead of the built-in ones.
