---
title: Choosing a package
description: Which of svelte-vitals' three packages to use, and when to combine them.
sidebar:
  order: 2
---

svelte-vitals ships as three packages — `svelte-vitals` (CLI), `@svelte-vitals/vite` (plugin + live dashboard), and `@svelte-vitals/mcp` (MCP server). They share the same rule engine and scoring, but read different input and cover different ground. Most projects end up using more than one.

Each package is versioned independently and depends on `@svelte-vitals/core` (the shared rule engine) as its own semver range, so two packages installed at the "same time" can still resolve to different core versions — see [live dashboard: Version drift](/svelte-vitals/guides/dev-dashboard/#version-drift) if the CLI and the Vite plugin ever disagree on findings for the same project.

## Quick answer

| If you want to...                                                                        | Use                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------ |
| Gate CI / PRs against SEO, Performance, and code-health issues, across the whole project | **CLI** — `npx svelte-vitals@latest` |
| Check only the files you're about to commit                                              | **CLI** with `--staged` or `--diff`  |
| Verify the exact HTML your prerendered pages will ship, whatever generated it            | **Vite plugin**, build mode          |
| See live findings while developing, whole project, from the moment `vite dev` starts     | **Vite plugin**, live dashboard      |
| Let an AI coding agent (Claude Code, Cursor, Codex) check its own changes                | **MCP server**                       |

## Comparison

|                | CLI (`svelte-vitals`)                                         | Vite plugin — build mode                                      | Vite plugin — live dashboard                                                        | MCP server                       |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| Reads          | Source (`.svelte` files, layout chain)                        | Prerendered HTML output + `.svelte` source (component rules)  | Source at startup; rendered HTML for routes you've visited                          | Source (same engine as the CLI)  |
| Categories     | All 5 — SEO, Performance, Correctness, Security, Architecture | All 5 — SEO, Performance, Correctness, Security, Architecture | All 5 (static baseline); visited routes refine to rendered SEO/Performance accuracy | All 5                            |
| Routes covered | Every route — SSR, dynamic, prerendered                       | Prerendered routes only                                       | Every route from startup — visited routes upgrade to `measured`                     | Every route                      |
| Runs           | On demand — terminal, CI, pre-commit                          | Every `vite build`                                            | Live, while `vite dev` runs                                                         | On demand — an agent's tool call |
| Needs a build  | No                                                            | Yes                                                           | No                                                                                  | No                               |
| Typical home   | CI, pre-commit hooks, one-off audits                          | Build pipeline gate                                           | Local dev feedback (on by default)                                                  | An AI agent's tool loop          |

### Why build-mode coverage is close to the CLI's

Correctness, Security, and Architecture rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts — which only exists before compilation. The CLI, MCP (which runs the CLI's own analysis engine), the Vite plugin's **build mode**, and the live dashboard's whole-project static baseline all read this source directly, so all four cover the full 5-category rule set.

Once you actually visit a route in dev, the dashboard additionally re-checks that route's **rendered HTML** (via `svelteVitalsHandle`) for SEO/Performance — library-agnostic and exact for the pages it covers: whatever produced the `<head>`, if it's missing from the shipped HTML, it's seen. That per-route rendered re-check is the one thing the dashboard's static baseline alone doesn't give you. Build mode reads rendered HTML too (for the same exact-verification reason), _in addition to_ the source scan — it's the only build-time path that gets both.

## The packages

### CLI — broadest coverage

`svelte-vitals` reads your project's source directly, so it's the only path that covers every route (including SSR and dynamic ones) and all five categories. It needs no build and runs anywhere Node does — a terminal, a CI job, a pre-commit hook via `--staged`, or a PR check via `--diff main`. Start here for CI gating; see the [CLI reference](/svelte-vitals/guides/cli/).

### Vite plugin — exact, build-time verification

`@svelte-vitals/vite`'s build mode runs during `vite build` and parses the **actual prerendered HTML** for SEO/Performance, so it can't be fooled by a component the source scanner doesn't recognize — if the tag isn't in the shipped output, it fails. It also scans `.svelte` source directly for Correctness, Security, Architecture, and the two component-scoped Performance rules, the same as the CLI. The remaining trade-off is route scope: only prerendered routes get the HTML-based SEO/Performance verification (component-scoped rules apply project-wide). See [Plugin mode](/svelte-vitals/guides/plugin-mode/).

The same package also serves a **live dashboard** at `/__svelte-vitals/` during `vite dev`, on by default, with zero build step — whole-project coverage from startup, refined to real rendered results as you browse. It's feedback, not a gate: nothing here fails a build or a CI run. See [Live dashboard](/svelte-vitals/guides/dev-dashboard/).

### MCP server — for AI-agent workflows

`@svelte-vitals/mcp` exposes the CLI's own analysis (all 5 categories, every route) as `analyze` and `explain_rule` tools over the Model Context Protocol, so an agent can call it mid-conversation instead of shelling out and parsing text output. Useful once you're working with an AI coding agent day to day; not a replacement for a CI gate. Set it up with `npx svelte-vitals@latest install`. See [MCP server](/svelte-vitals/guides/mcp/).

## Recommended setups

- **Just starting out:** run `npx svelte-vitals@latest` locally, then add it to CI (`pnpm build && npx svelte-vitals@latest --fail-on critical`). This alone covers all 5 categories and every route.
- **Coding with an AI agent:** add the MCP server (`npx svelte-vitals@latest install`) so the agent can check its own edits without you asking it to.
- **Polishing prerendered/marketing pages:** add the Vite plugin's build mode for an exact, build-time gate on shipped HTML — its live dashboard (on by default) gives you feedback while you write, no extra setup needed.
- **All of the above together** is the common end state — they check different things at different times and don't conflict.
