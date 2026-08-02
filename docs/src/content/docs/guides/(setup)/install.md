---
title: svelte-vitals install
description: Set up the Vite integration, Agent Skills, the config file, and CI.
sidebar:
  order: 2
---

Interactively set up the svelte-vitals Vite integration, [Agent Skills](/guides/agent-skills) for **Claude Code**, **Codex** and **Cursor**, the [config file](/guides/configuration), and the [CI workflow](/guides/ci) — everything a project needs, wired up in one pass.

```bash
npx svelte-vitals@latest install
```

With no flags it launches an interactive wizard: pick your targets, review the plan, and confirm. The picker groups targets by category — **Vite integration**, **Agent Skills & rules**, **CI (GitHub Actions)**, **Config file** — so it's clear what each one is for. For non-interactive/CI use, drive it entirely with flags.

## `--client <ids>`

Comma-separated targets to configure: `vite-plugin`, `vite-hooks`, `claude-skill`, `cursor-rules`, `claude-skill-improve`, `config-file`, `ci-workflow`. When given, the interactive picker is skipped.

`vite-plugin` registers the build-mode plugin in `vite.config.{ts,js,mjs}` (the live dashboard is on by default); `vite-hooks` wires `svelteVitalsHandle` into `src/hooks.server.{ts,js}`, improving the dashboard's per-route accuracy as you browse.

Both use a `magicast` codemod that only touches a file whose shape it confidently recognizes — anything else is left alone and a snippet printed instead. Writing either installs `@svelte-vitals/vite` via the detected package manager if it isn't already a dependency. **`--force` does not apply to these two:** an existing registration is always left as-is.

`claude-skill` writes the [`/svelte-vitals` Agent Skill](/guides/agent-skills#svelte-vitals) to `.claude/skills/`, `.agents/skills/` and `.cursor/skills/` at once, byte-identical — all three tools read the same frontmatter-driven `SKILL.md` convention. `cursor-rules` writes `.cursor/rules/svelte-vitals.mdc`.

Both are generated at install time from the current rule set (id, title, severity and rationale per rule, grouped by category). Being regenerated rather than codemodded, **`--force` does apply** and overwrites them.

`claude-skill-improve` writes the [`/improve-svelte` Agent Skill](/guides/agent-skills#improve-svelte) to the same three locations, under `improve-svelte/` (`.claude/skills/improve-svelte/SKILL.md`, `.agents/skills/improve-svelte/SKILL.md`, `.cursor/skills/improve-svelte/SKILL.md`). Like `claude-skill`/`cursor-rules`, it's fully regenerated, so **`--force` does apply**.

`config-file` scaffolds `svelte-vitals.config.{mjs,ts}` with every option (`treatDynamicAs`, `metaComponents`, `rules`, `failOn`, `weights`) commented out, auto-picking the best extension for the environment — see [Config file](/guides/configuration). Like the agent targets, it's fully regenerated, so **`--force` does apply** (to whichever file already exists — regenerating never switches its extension).

`ci-workflow` scaffolds `.github/workflows/svelte-vitals.yml`, the same file the standalone [`svelte-vitals ci install`](/guides/ci) command writes — pick it here to set up CI in the same pass as everything else, instead of a separate command. It's fully regenerated, so **`--force` does apply**; `svelte-vitals ci upgrade` (not part of this wizard) remains the way to bump an existing workflow's pinned action version without touching anything else in the file.

## `--app <dir>` — monorepos

The `vite-plugin`, `vite-hooks`, and `config-file` targets must land in the SvelteKit **app** directory — that's where `vite.config.*` and `src/hooks.server.*` live, and a `svelte-vitals.config.*` is only [loaded from the analyzed directory](/guides/configuration#where-it-lives). When you run `install` from a monorepo root, these targets resolve their app the same way [the analyzer does](/guides/cli#monorepos):

- An explicit `--app apps/web` always wins (and fails with exit `2` if that directory has no `svelte.config.{js,ts}`).
- Otherwise, if the current directory is itself a SvelteKit app, it's used as-is.
- Otherwise detection kicks in: exactly one app found → used automatically with a notice; several found → a picker prompt on an interactive terminal, or exit `2` asking for `--app` when non-interactive.

Everything else — agent skills/rules, `ci-workflow` — always writes relative to the current directory, since the repo root is those files' correct home in a monorepo.

```bash
cd my-monorepo
npx svelte-vitals@latest install --client vite-plugin,config-file --app apps/web --yes
```

## `--yes`, `-y`

Skip the confirmation prompt.

## `--dry-run`

Print the planned changes and exit without writing anything.

## `--force`

Overwrite an existing `svelte-vitals` entry. By default an entry that already exists is left untouched.

## `--refresh`

Regenerates whichever `claude-skill`/`cursor-rules`/`claude-skill-improve` files are already on disk, with the current rule set — a way to pick up new rules without remembering which targets you installed. It never creates a file that isn't there.

`--yes`, `--force` and `--app` are ignored with a warning; `--client` is a fatal combination. With no generated files present it prints guidance and exits `0`.

```bash
# Non-interactive: write the agent skill and register the Vite plugin
npx svelte-vitals@latest install --client claude-skill,vite-plugin --yes

# Preview what would change, without writing
npx svelte-vitals@latest install --client config-file --dry-run

# Regenerate any already-installed agent skill/rules files after adding a rule
npx svelte-vitals@latest install --refresh

# Set up CI in the same pass as everything else
npx svelte-vitals@latest install --client claude-skill,ci-workflow --yes
```

If a target file can't be read, the command reports the path and exits `2` rather than writing over something it could not inspect.

> **Removed in favour of the CLI:** the `claude-code`, `cursor` and `codex` target ids configured the `@svelte-vitals/mcp` server, which no longer exists. Passing them now warns and skips. Use `claude-skill` instead — one skill file that Claude Code, Codex and Cursor all read — and see [`svelte-vitals explain`](/guides/cli#explain) for the per-rule detail the `explain_rule` tool used to return.
