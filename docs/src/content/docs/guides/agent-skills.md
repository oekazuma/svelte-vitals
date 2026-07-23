---
title: Agent Skills
description: Slash-command skills that teach Claude Code, Cursor, and Codex svelte-vitals' rules and how to run a project-wide improvement audit.
sidebar:
  order: 6.5
---

svelte-vitals ships two Agent Skills — portable `SKILL.md` files that work identically in **Claude Code**, **Cursor**, and **Codex**, since all three tools read the same frontmatter-driven convention. Both are generated once from the project's current rule set and written to each tool's conventional location; install them with [`svelte-vitals install`](/guides/install):

```bash
npx svelte-vitals@latest install --client claude-skill,claude-skill-improve --yes
```

## `/svelte-vitals`

The every-edit companion. It embeds the full rule catalog — every rule's id, title, severity, and rationale, grouped by category — so the agent already knows the rules before it writes code, and knows to run `svelte-vitals --diff`/`--staged` as a regression check once it's done.

Written to:

- `.claude/skills/SKILL.md` (Claude Code)
- `.agents/skills/SKILL.md` (Codex)
- `.cursor/skills/SKILL.md` (Cursor)

All three files are byte-identical.

## `/improve-svelte`

A read-only, project-wide audit skill. It turns "review my SvelteKit app" into an evidence-based, ranked plan: it scans the whole project, ranks findings by actual user/search-engine impact rather than raw rule severity (a missing canonical URL on the homepage outranks the same issue on a page nobody visits), and writes each selected finding into a self-contained implementation plan under `plans/` — precise enough for another agent (even a cheaper model) or a human to execute without re-deriving context.

Every fix recommendation comes from svelte-vitals's own rule catalog — the same one `/svelte-vitals` embeds — never invented on the spot, so it needs no network access. It never edits source itself, so it's safe to run any time. Where `/svelte-vitals` is the every-edit regression check, `/improve-svelte` is the periodic "give me a prioritized roadmap" pass — run it before a push, a refactor, or a focused SEO/performance effort.

Written to:

- `.claude/skills/improve-svelte/SKILL.md` (Claude Code)
- `.agents/skills/improve-svelte/SKILL.md` (Codex)
- `.cursor/skills/improve-svelte/SKILL.md` (Cursor)

## Keeping skills up to date

Rules change between releases. Regenerate any already-installed skill file after upgrading, without remembering which ones you originally installed:

```bash
npx svelte-vitals@latest install --refresh
```

See [`--refresh`](/guides/install#--refresh) for details.

## Agent Skills vs. Cursor rules

`cursor-rules` (`.cursor/rules/svelte-vitals.mdc`) is a separate, Cursor-only mechanism — an always-applied project rules file, not a slash-command skill. See [`--client`](/guides/install#--client-ids) for how it's generated alongside the two skills above.
