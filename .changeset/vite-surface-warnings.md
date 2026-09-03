---
'@svelte-vitals/vite': patch
---

The dev dashboard's whole-project runner now forwards `analyzeProject`'s warnings (for example an `overrides` glob that matched nothing, an unknown inline-directive id, a file that could not be read or parsed, a rule that crashed and was skipped, or a config-file validation notice) to the terminal, the same way `vite build` already does. An unchanged warning set is not repeated on the next re-analysis. Config-file warnings already printed when the file was loaded are not printed a second time by the runner. The build path's crashed-rule warning is now pinned by a test.
