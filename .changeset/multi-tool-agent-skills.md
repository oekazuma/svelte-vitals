---
'svelte-vitals': minor
---

`svelte-vitals install --client claude-skill` and `claude-skill-improve` now write the same generated skill content to three conventional locations at once — `.claude/skills/`, `.agents/skills/`, and `.cursor/skills/` — instead of just `.claude/skills/`. Claude Code, Codex, and Cursor all read the same frontmatter-driven `SKILL.md` convention (directory name decides the invocable command), so a project that picks `claude-skill`/`claude-skill-improve` now gets a working skill in all three tools with no extra action. `--force` and `--refresh` apply per-file, so a project with only the old single-path install gets the two new destinations created without disturbing the existing one. `cursor-rules` (`.cursor/rules/*.mdc`) is unchanged.
