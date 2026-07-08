---
'svelte-vitals': minor
---

Add `claude-skill` and `cursor-rules` targets to `svelte-vitals install`, generating a Claude Code skill (`.claude/skills/svelte-vitals/SKILL.md`) and a Cursor rules file (`.cursor/rules/svelte-vitals.mdc`) from the current rule set (ids, titles, severities, and rationale grouped by category) so an agent has the rule knowledge and a run playbook before it writes code. Unlike the Vite targets, these files are fully regenerated, so `--force` overwrites them with a fresh copy.
