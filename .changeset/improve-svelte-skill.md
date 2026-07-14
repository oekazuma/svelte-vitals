---
'svelte-vitals': minor
---

Add a `claude-skill-improve` install target: `svelte-vitals install --client claude-skill-improve` writes a second, read-only Claude Code skill (`.claude/skills/improve-svelte/SKILL.md`). Where the existing `claude-skill` target is the every-edit regression-check playbook, this new skill audits the whole codebase as a senior Svelte/SvelteKit engineer — using svelte-vitals' own scan as evidence — and writes prioritized, self-contained implementation plans under `plans/` for another agent (or cheaper model) to execute later; it never edits source itself. It reuses the same rule-catalog generator the existing skill already renders, so every rule's canonical fix is inlined with no network fetch required. Supports `--force`/`--refresh` like the other agent targets.
