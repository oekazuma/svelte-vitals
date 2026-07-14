---
title: svelte-vitals install
description: Set up the MCP server, Vite integration, and Agent Skills for your AI-agent clients.
sidebar:
  order: 3.2
---

Interactively set up the svelte-vitals [MCP server](/svelte-vitals/guides/mcp/), the Vite integration, and [Agent Skills](/svelte-vitals/guides/agent-skills/) for your AI-agent clients — **Claude Code**, **Cursor**, and **Codex** — by merging the server entry into each client's config (your other servers are left untouched).

```bash
npx svelte-vitals@latest install
```

With no flags it launches an interactive wizard: pick your clients/targets, choose a scope per client, review the plan, and confirm. The picker groups targets by category — **MCP server**, **Vite integration**, **Agent Skills & rules**, **CI (GitHub Actions)**, **Config file** — so it's clear what each one is for even with ten targets on offer. For non-interactive/CI use, drive it entirely with flags.

## `--client <ids>`

Comma-separated clients/targets to configure: `claude-code`, `cursor`, `codex`, `vite-plugin`, `vite-hooks`, `claude-skill`, `cursor-rules`, `claude-skill-improve`, `config-file`, `ci-workflow`. When given, the interactive picker is skipped.

`vite-plugin` registers `@svelte-vitals/vite`'s build-mode plugin in `vite.config.{ts,js,mjs}` (its live dashboard is on by default); `vite-hooks` wires up the `svelteVitalsHandle` hook in `src/hooks.server.{ts,js}`, which improves the dashboard's per-route accuracy as you browse. Both use a `magicast` codemod that only touches a file whose shape it confidently recognizes — anything else is left alone and a snippet is printed instead. If either is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. **`--force` does not apply to these two** — an existing registration is always left as-is regardless of the flag.

`claude-skill` writes the [`/svelte-vitals` Agent Skill](/svelte-vitals/guides/agent-skills/#svelte-vitals) to three conventional locations at once — `.claude/skills/svelte-vitals/SKILL.md` (Claude Code), `.agents/skills/svelte-vitals/SKILL.md` (Codex), and `.cursor/skills/svelte-vitals/SKILL.md` (Cursor) — with byte-identical content, since all three tools read the same frontmatter-driven `SKILL.md` convention; `cursor-rules` writes a Cursor project rules file to `.cursor/rules/svelte-vitals.mdc`. Both are generated at install time from the current rule set (every rule's id, title, severity, and rationale, grouped by category). Unlike the Vite targets, these files are fully regenerated rather than codemodded, so **`--force` does apply** and simply overwrites them with a fresh copy.

`claude-skill-improve` writes the [`/improve-svelte` Agent Skill](/svelte-vitals/guides/agent-skills/#improve-svelte) to the same three locations, under `improve-svelte/` (`.claude/skills/improve-svelte/SKILL.md`, `.agents/skills/improve-svelte/SKILL.md`, `.cursor/skills/improve-svelte/SKILL.md`). Like `claude-skill`/`cursor-rules`, it's fully regenerated, so **`--force` does apply**.

`config-file` scaffolds `svelte-vitals.config.{mjs,ts}` with every option (`treatDynamicAs`, `metaComponents`, `rules`, `failOn`, `weights`) commented out, auto-picking the best extension for the environment — see [Config file](/svelte-vitals/guides/configuration/). Like the agent targets, it's fully regenerated, so **`--force` does apply** (to whichever file already exists — regenerating never switches its extension).

`ci-workflow` scaffolds `.github/workflows/svelte-vitals.yml`, the same file the standalone [`svelte-vitals ci install`](/svelte-vitals/guides/ci/) command writes — pick it here to set up CI in the same pass as everything else, instead of a separate command. It's fully regenerated, so **`--force` does apply**; `svelte-vitals ci upgrade` (not part of this wizard) remains the way to bump an existing workflow's pinned action version without touching anything else in the file.

## `--scope <project|global>`

Where to write the config. Applies to all selected clients; **Codex is always global** (it has no project-scoped config). (Vite targets, agent skill/rules targets, the config-file target, and the ci-workflow target have no scope and ignore this flag.)

| Client      | project            | global                 |
| ----------- | ------------------ | ---------------------- |
| Claude Code | `.mcp.json`        | `~/.claude.json`       |
| Cursor      | `.cursor/mcp.json` | `~/.cursor/mcp.json`   |
| Codex       | —                  | `~/.codex/config.toml` |

## `--yes`, `-y`

Skip the confirmation prompt.

## `--dry-run`

Print the planned changes and exit without writing anything.

## `--force`

Overwrite an existing `svelte-vitals` entry. By default an entry that already exists is left untouched.

## `--refresh`

Regenerate whichever `claude-skill`/`cursor-rules`/`claude-skill-improve` files are already present on disk, with the current rule set — a one-command way to pick up newly added rules or improved rationale text without remembering which agent targets you originally installed. It only regenerates files that already exist; it never creates one (refresh is not install). It ignores `--scope`, `--yes`, and `--force` (with a warning) since they don't apply, and cannot be combined with `--client` (fatal). If no generated agent files are found, it prints guidance and exits `0`.

```bash
# Non-interactive: configure Claude Code + Cursor for this project
npx svelte-vitals@latest install --client claude-code,cursor --scope project --yes

# Preview what would change, without writing
npx svelte-vitals@latest install --client codex --dry-run

# Regenerate any already-installed agent skill/rules files after adding a rule
npx svelte-vitals@latest install --refresh

# Set up CI in the same pass as everything else
npx svelte-vitals@latest install --client claude-code,ci-workflow --yes
```

If an existing config can't be parsed, the command fails without writing (exit `2`) rather than overwriting it.
