---
'svelte-vitals': patch
---

Point the scaffolded agent skills at the fix text that actually exists. Both skills told the agent to take a finding's fix from `svelte-vitals explain <rule-id> --json`, which never returns `recommendation` and returns no `fix` for a rule that words its fix per finding — a dead end on more than half the registry, criticals included. They now read `recommendation` off the finding in the report, and the rule digest says so where a `Fix:` line is absent. The `svelte-vitals` skill also gained the inline-suppression directive (the only way to clear a correct-by-design finding) and the exit-code contract, and the bundled `docs show scoping` guide now documents `svelte-vitals-disable-next-line`.
