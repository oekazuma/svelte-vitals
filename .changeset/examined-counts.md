---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

The JSON report gains a top-level `examined` map: per rule, per declaration, how many places that declaration
judged.

A glob-configured rule reporting zero findings could not be told apart from one whose declarations matched
nothing, and verifying a real project meant planting a deliberate violation to see whether anything fired.
`architecture/reserved-name-placement` now reports this count for each of its declarations, keyed by the same
label its own diagnostic uses, so the two can be read together.

Three exported shapes change. `runRules` now returns `{ results, examined }` instead of a bare `Result[]`.
`RuleContext` gains an optional `recordExamined(counts)`, which the engine supplies so a rule can report its
counts without every caller having to thread a sink through by hand. `JsonReport` gains an optional top-level
`examined: Record<string, Record<string, number>>`, present only when a rule reported something.

`RuleEvidence` — the shape of `rules[id]` — is unchanged. The count deliberately does not go there: `rules`
describes what survived into the report (baseline, suppression and `--diff` narrow it), while `examined`
describes what the analysis looked at, unaffected by any of that filtering. Putting both under one key would
give one object two different scopes with nothing marking the difference.
