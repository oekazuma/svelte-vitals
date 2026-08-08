---
'@svelte-vitals/core': minor
---

`architecture/reserved-directory-names`, `architecture/directory-naming` and `architecture/unit-entry-file`
now report `examined` counts in the JSON report, the same mechanism `architecture/reserved-name-placement`
already used: per declaration, how many places it judged, keyed by the same bare glob string its own
diagnostic names. A run configuring all four rules previously got one `examined` entry and silence for the
other three, even though all three already emit a project-scoped finding for a declaration that matched no
directory — the count fills in the missing number for a key that governed a hundred directories versus one.

No exported shape changes: `runRules`, `RuleContext.recordExamined` and `JsonReport.examined` already exist.
This is JSON-only, matching the existing feature — no CLI or console output changes.
