---
title: Choosing a package
description: Which svelte-vitals surface to use — CLI, Vite plugin, GitHub Action, or Agent Skills — and when to combine them.
sidebar:
  order: 2
---

svelte-vitals ships as npm packages — `svelte-vitals` (CLI) and `@svelte-vitals/vite` (plugin + live dashboard) — plus surfaces you don't install from npm: **`@svelte-vitals/action`**, a first-party GitHub Action consumed straight from the repo, and **Agent Skills**, `SKILL.md` files the CLI generates into your project. Everything that analyzes — the CLI, the Vite plugin, and the Action — shares the same rule engine and scoring, but reads different input and covers different ground (Agent Skills run no analysis of their own; they carry the rule knowledge and tell the agent when to run the scanner). Most projects end up using more than one.

Each package is versioned independently and depends on `@svelte-vitals/core` (the shared rule engine) as its own semver range, so two packages installed at the "same time" can still resolve to different core versions — see [live dashboard: Version drift](/guides/dev-dashboard#version-drift) if the CLI and the Vite plugin ever disagree on findings for the same project.

## Quick answer

| If you want to...                                                                        | Use                                                       |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Gate CI / PRs against SEO, Performance, and code-health issues, across the whole project | **CLI** — `npx svelte-vitals@latest`                      |
| Check only the files you're about to commit                                              | **CLI** with `--staged` or `--diff`                       |
| Gate GitHub PRs with inline annotations, a job summary, and a sticky comment — no YAML   | **GitHub Action** — `npx svelte-vitals@latest ci install` |
| Verify the exact HTML your prerendered pages will ship, whatever generated it            | **Vite plugin**, build mode                               |
| See live findings while developing, whole project, from the moment `vite dev` starts     | **Vite plugin**, live dashboard                           |
| Let an AI coding agent (Claude Code, Cursor, Codex) check its own changes                | **CLI** with `--diff --reporter agent`                    |
| Teach your agent the rules up front, or get a project-wide improvement roadmap from it   | **Agent Skills** — `/svelte-vitals`, `/improve-svelte`    |

## Comparison

|                | CLI (`svelte-vitals`)                                                  | Vite plugin — build mode                                               | Vite plugin — live dashboard                                                                 |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Reads          | Source (`.svelte` files, layout chain)                                 | Prerendered HTML output + `.svelte` source (component rules)           | Source at startup; rendered HTML for routes you've visited                                   |
| Categories     | All categories — SEO, Performance, Correctness, Security, Architecture | All categories — SEO, Performance, Correctness, Security, Architecture | All categories (static baseline); visited routes refine to rendered SEO/Performance accuracy |
| Routes covered | Every route — SSR, dynamic, prerendered                                | Prerendered routes only                                                | Every route from startup — visited routes upgrade to `measured`                              |
| Runs           | On demand — terminal, CI, pre-commit, an agent's shell                 | Every `vite build`                                                     | Live, while `vite dev` runs                                                                  |
| Needs a build  | No                                                                     | Yes                                                                    | No                                                                                           |
| Typical home   | CI, pre-commit hooks, one-off audits, agent tool loops                 | Build pipeline gate                                                    | Local dev feedback (on by default)                                                           |

Some surfaces are intentionally absent from this table: the **GitHub Action** runs the CLI's own engine in-process, so its coverage is the CLI column — what it adds is the PR experience (annotations, summary, sticky comment) rather than different analysis. **Agent Skills** run no analysis of their own at all — they give the agent the rule knowledge and tell it when to run the scanner.

### Why build-mode coverage is close to the CLI's

Correctness, Security, and Architecture rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts — which only exists before compilation. The CLI, the Vite plugin's **build mode**, and the live dashboard's whole-project static baseline all read this source directly, so all three cover the full rule set across every category.

Once you actually visit a route in dev, the dashboard additionally re-checks that route's **rendered HTML** (via `svelteVitalsHandle`) for SEO/Performance — library-agnostic and exact for the pages it covers: whatever produced the `<head>`, if it's missing from the shipped HTML, it's seen. That per-route rendered re-check is the one thing the dashboard's static baseline alone doesn't give you. Build mode reads rendered HTML too (for the same exact-verification reason), _in addition to_ the source scan — it's the only build-time path that gets both.

## The packages

### CLI — broadest coverage

`svelte-vitals` reads your project's source directly, so it's the only direct path that covers every route (including SSR and dynamic ones) and all categories. It needs no build and runs anywhere Node does — a terminal, a CI job, a pre-commit hook via `--staged`, or a PR check via `--diff main`. Start here for CI gating; see the [CLI reference](/guides/cli).

### Vite plugin — exact, build-time verification

`@svelte-vitals/vite`'s build mode runs during `vite build` and parses the **actual prerendered HTML** for SEO/Performance, so it can't be fooled by a component the source scanner doesn't recognize — if the tag isn't in the shipped output, it fails. It also scans `.svelte` source directly for Correctness, Security, Architecture, and the component-scoped Performance rules, the same as the CLI. The remaining trade-off is route scope: only prerendered routes get the HTML-based SEO/Performance verification (component-scoped rules apply project-wide). See [Plugin mode](/guides/plugin-mode).

The same package also serves a **live dashboard** at `/__svelte-vitals/` during `vite dev`, on by default, with zero build step — whole-project coverage from startup, refined to real rendered results as you browse. It's feedback, not a gate: nothing here fails a build or a CI run. See [Live dashboard](/guides/dev-dashboard).

### GitHub Action — PR gating with zero YAML

`@svelte-vitals/action` runs the same engine as the CLI on every pull request and turns the findings into GitHub-native feedback: inline annotations on the changed lines, a job summary, and a single sticky PR comment that updates in place. You don't install it from npm — `npx svelte-vitals@latest ci install` (or the `ci-workflow` target inside `svelte-vitals install`) scaffolds a workflow that calls it pinned to a commit SHA, and `svelte-vitals ci upgrade` bumps that pin later. The generated workflow scopes findings to the PR's own changes via `--diff`/`--baseline`, so pre-existing issues don't fail other people's PRs. See [CI integration](/guides/ci).

### Agent Skills — rule knowledge for your agent, up front

[Agent Skills](/guides/agent-skills) make an agent _know the rules before it writes code_. `svelte-vitals install` generates portable `SKILL.md` files that work identically in Claude Code, Codex, and Cursor: **`/svelte-vitals`** embeds the full rule catalog plus a run-the-scanner-after-every-edit playbook, and **`/improve-svelte`** is a read-only audit that turns "review my app" into impact-ranked, self-contained implementation plans. They pair with the CLI rather than replacing it — knowledge up front, analysis on demand: the skill's own playbook tells the agent to run `npx svelte-vitals . --diff --reporter agent` after an edit, and `npx svelte-vitals explain <rule-id>` when it needs a rule's full rationale and options. See [Agent Skills](/guides/agent-skills).

## Recommended setups

- **Just starting out:** run `npx svelte-vitals@latest` locally, then add it to CI (`pnpm build && npx svelte-vitals@latest --fail-on critical`). This alone covers all categories and every route.
- **Hosting on GitHub:** `npx svelte-vitals@latest ci install` instead of hand-writing that CI step — same engine, plus inline PR annotations and the sticky comment, scoped to each PR's own changes.
- **Coding with an AI agent:** install the Agent Skills (`npx svelte-vitals@latest install`) — they give the agent the rules before it writes code and tell it to verify each edit with the CLI (`--diff --reporter agent`) afterward.
- **Polishing prerendered/marketing pages:** add the Vite plugin's build mode for an exact, build-time gate on shipped HTML — its live dashboard (on by default) gives you feedback while you write, no extra setup needed.
- **All of the above together** is the common end state — they check different things at different times and don't conflict.
