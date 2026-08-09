---
'@svelte-vitals/core': patch
---

Fix a parse crash on argument-less `$state()` that made the whole component invisible to every rule. `let el = $state();` (the idiomatic `bind:this` declaration) threw inside fact extraction; the error was swallowed and the file silently contributed no findings at all. Such files are now analyzed normally. Note: projects using this pattern may see new findings on the next run — including critical ones (e.g. correctness/orphan-effect) in files that were previously skipped — so a previously green run can now fail the default `--fail-on critical` gate. That is the fix working, not a regression.
