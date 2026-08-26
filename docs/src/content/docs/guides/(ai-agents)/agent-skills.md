---
title: Agent Skills
description: Slash-command skills that teach Claude Code, Cursor, and Codex how to derive a config file for a project adopting svelte-vitals, how to run a project-wide improvement audit, and the rules themselves.
sidebar:
  order: 2
---

svelte-vitals ships its Agent Skills as portable `SKILL.md` files that work identically in Claude Code, Cursor, and Codex, since all three tools read the same frontmatter-driven convention. They are listed on [skills.sh](https://www.skills.sh/) and installed with the `skills` CLI:

```bash
npx skills add oekazuma/svelte-vitals
```

The CLI asks which agents to install for and writes each skill to that tool's conventional location (`.claude/skills/`, `.agents/skills/`, …). To skip the prompts:

```bash
npx skills add oekazuma/svelte-vitals -a claude-code -a cursor -a codex -y
```

The skills are generated from the repository's rule registry, so what you install always matches the latest rule set on `main`.

## `/setup-svelte-vitals`

This is the first-run skill. It derives a `svelte-vitals.config` for a project instead of scaffolding a blank one.

Several rules ship inert. They declare options that all default empty, so until a project fills them in they examine nothing. `svelte-vitals install --client config-file` writes a template with every field commented out, which is a form rather than an answer. This skill fills the form in from evidence the project already carries: an existing markuplint or eslint-plugin-check-file config, the SvelteKit adapter and prerender settings, the local `<head>` components that belong in `metaComponents`, and, where no neighbouring config answers the question, the measured distribution of the project's own directory names.

The skill measures every candidate before it writes anything. Each candidate config goes to a scratch file outside the project and gets scored with [`--config <path>`](/guides/configuration). Every rule is then adopted, skipped, or adopted-and-absorbed on its own count rather than in one bulk question. It writes configuration only, never source, and it never overwrites an existing config. It shows you the diff instead. Whatever it does not own it hands to [`svelte-vitals install`](/guides/install): the Vite plugin, hooks, the CI workflow.

Run it once when adopting svelte-vitals, and again on a project that installed it long ago and never configured the inert rules.

## `/improve-svelte`

A read-only, project-wide audit skill that turns "review my SvelteKit app" into a ranked, evidence-based plan.

It scans the whole project and ranks findings by real user and search-engine impact rather than raw severity. A missing canonical URL on the homepage outranks the same issue on a page nobody visits. Each selected finding becomes a self-contained plan under `plans/`, or `advisor-plans/` when `plans/` already exists for another purpose, precise enough for another agent or a human to execute without re-deriving context.

Every fix recommendation comes from svelte-vitals's own rule catalog, the same one `/svelte-vitals` embeds, never invented on the spot, so it needs no network access. It never edits source itself, so it's safe to run any time. Where `/svelte-vitals` is the every-edit regression check, `/improve-svelte` is the periodic "give me a prioritized roadmap" pass. Run it before a push, a refactor, or a focused SEO/performance effort.

## `/svelte-vitals`

The every-edit companion. It embeds the full rule catalog: every rule's id, title, severity, and rationale, grouped by category. The agent therefore knows the rules before it writes code, and knows to run `svelte-vitals --diff`/`--staged` as a regression check once it's done.

## Keeping skills up to date

Rules change between releases. Pull the latest copies with the same CLI:

```bash
npx skills update
```

## Agent Skills vs. Cursor rules

`cursor-rules` (`.cursor/rules/svelte-vitals.mdc`) is a separate, Cursor-only mechanism, not a slash-command skill. It is a project rules file Cursor auto-attaches to matching files, meaning Svelte components and routes, via its `globs`. [`svelte-vitals install`](/guides/install#--client-ids) generates it, not `skills add`.
