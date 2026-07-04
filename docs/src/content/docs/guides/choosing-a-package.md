---
title: Choosing a package
description: Which of svelte-vitals' three packages to use, and when to combine them.
---

svelte-vitals ships as three packages — `svelte-vitals` (CLI), `@svelte-vitals/vite` (plugin + dev overlay), and `@svelte-vitals/mcp` (MCP server). They share the same rule engine and scoring, but read different input and cover different ground. Most projects end up using more than one.

## Quick answer

| If you want to...                                                                        | Use                                 |
| ---------------------------------------------------------------------------------------- | ----------------------------------- |
| Gate CI / PRs against SEO, Performance, and code-health issues, across the whole project | **CLI** — `npx svelte-vitals`       |
| Check only the files you're about to commit                                              | **CLI** with `--staged` or `--diff` |
| Verify the exact HTML your prerendered pages will ship, whatever generated it            | **Vite plugin**, build mode         |
| See warnings live while developing, with no build step                                   | **Vite plugin**, dev overlay        |
| Let an AI coding agent (Claude Code, Cursor, Codex) check its own changes                | **MCP server**                      |

## Comparison

|                | CLI (`svelte-vitals`)                                         | Vite plugin — build mode | Vite plugin — dev overlay         | MCP server                       |
| -------------- | ------------------------------------------------------------- | ------------------------ | --------------------------------- | -------------------------------- |
| Reads          | Source (`.svelte` files, layout chain)                        | Prerendered HTML output  | Rendered HTML, per dev request    | Source (same engine as the CLI)  |
| Categories     | All 5 — SEO, Performance, Correctness, Security, Architecture | SEO, Performance         | SEO, Performance                  | All 5                            |
| Routes covered | Every route — SSR, dynamic, prerendered                       | Prerendered routes only  | Only routes you've visited in dev | Every route                      |
| Runs           | On demand — terminal, CI, pre-commit                          | Every `vite build`       | Live, while `vite dev` runs       | On demand — an agent's tool call |
| Needs a build  | No                                                            | Yes                      | No                                | No                               |
| Typical home   | CI, pre-commit hooks, one-off audits                          | Build pipeline gate      | Local dev feedback                | An AI agent's tool loop          |

### Why the coverage differs

Correctness, Security, and Architecture rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts — which only exists before compilation. Only the two paths that read source directly (the CLI and MCP, which runs the CLI's own analysis engine) can run them.

The Vite plugin, in both its build and dev-overlay forms, inspects **HTML** instead — the prerendered output or the rendered response. That makes it SEO/Performance-only, but also library-agnostic and exact for the pages it covers: whatever produced the `<head>`, if it's missing from the shipped HTML, the plugin sees it. It's the only path that inspects what a browser actually receives.

## The packages

### CLI — broadest coverage

`svelte-vitals` reads your project's source directly, so it's the only path that covers every route (including SSR and dynamic ones) and all five categories. It needs no build and runs anywhere Node does — a terminal, a CI job, a pre-commit hook via `--staged`, or a PR check via `--diff main`. Start here for CI gating; see the [CLI reference](/svelte-vitals/guides/cli/).

### Vite plugin — exact, build-time verification

`@svelte-vitals/vite`'s build mode runs during `vite build` and parses the **actual prerendered HTML**, so it can't be fooled by a component the source scanner doesn't recognize — if the tag isn't in the shipped output, it fails. The trade-off is scope: only prerendered routes, and only the head/DOM-based SEO and Performance rules. See [Plugin mode](/svelte-vitals/guides/plugin-mode/).

The same package also adds a **dev overlay** — live warnings in the terminal (and an optional dashboard at `/__svelte-vitals/`) as you navigate `vite dev`, with zero build step. It's feedback, not a gate: nothing here fails a build or a CI run. See [Dev overlay](/svelte-vitals/guides/dev-overlay/).

### MCP server — for AI-agent workflows

`@svelte-vitals/mcp` exposes the CLI's own analysis (all 5 categories, every route) as `analyze` and `explain_rule` tools over the Model Context Protocol, so an agent can call it mid-conversation instead of shelling out and parsing text output. Useful once you're working with an AI coding agent day to day; not a replacement for a CI gate. Set it up with `npx svelte-vitals install`. See [MCP server](/svelte-vitals/guides/mcp/).

## Recommended setups

- **Just starting out:** run `npx svelte-vitals` locally, then add it to CI (`pnpm build && npx svelte-vitals --fail-on critical`). This alone covers all 5 categories and every route.
- **Coding with an AI agent:** add the MCP server (`npx svelte-vitals install`) so the agent can check its own edits without you asking it to.
- **Polishing prerendered/marketing pages:** add the Vite plugin's build mode for an exact, build-time gate on shipped HTML, and the dev overlay for live feedback while you write.
- **All of the above together** is the common end state — they check different things at different times and don't conflict.
