---
title: Choosing a package
description: Which svelte-vitals surface to use — CLI, Vite plugin, GitHub Action, or Agent Skills — and when to combine them.
sidebar:
  order: 2
---

Two npm packages — `svelte-vitals` (CLI) and `@svelte-vitals/vite` (plugin + live dashboard) — plus surfaces you don't install from npm: **`@svelte-vitals/action`**, consumed straight from its repo, and **Agent Skills**, `SKILL.md` files installed from [skills.sh](https://www.skills.sh/) with `npx skills add`.

The CLI, the plugin and the Action share one rule engine and scoring but read different input. Agent Skills analyze nothing themselves — they carry the rule knowledge and tell the agent when to run the scanner. Most projects use more than one.

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

|                | CLI (`svelte-vitals`)                                                                 | Vite plugin — build mode                                                              | Vite plugin — live dashboard                                                                               |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Reads          | Source (`.svelte` files, layout chain)                                                | Prerendered HTML output + `.svelte` source (component rules)                          | Source at startup; rendered HTML for routes you've visited                                                 |
| Categories     | All categories — SEO, Performance, Correctness, Security, Architecture, Accessibility | All categories — SEO, Performance, Correctness, Security, Architecture, Accessibility | All categories (static baseline); visited routes refine to rendered SEO/Performance/Accessibility accuracy |
| Routes covered | Every route — SSR, dynamic, prerendered                                               | Prerendered routes only                                                               | Every route from startup — visited routes upgrade to `measured`                                            |
| Runs           | On demand — terminal, CI, pre-commit, an agent's shell                                | Every `vite build`                                                                    | Live, while `vite dev` runs                                                                                |
| Needs a build  | No                                                                                    | Yes                                                                                   | No                                                                                                         |
| Typical home   | CI, pre-commit hooks, one-off audits, agent tool loops                                | Build pipeline gate                                                                   | Local dev feedback (on by default)                                                                         |

Some surfaces are intentionally absent from this table: the **GitHub Action** runs the CLI's own engine in-process, so its coverage is the CLI column — what it adds is the PR experience (annotations, summary, sticky comment) rather than different analysis. **Agent Skills** run no analysis of their own at all — they give the agent the rule knowledge and tell it when to run the scanner.

### Why build-mode coverage is close to the CLI's

Correctness, Security, Architecture, and Accessibility rules read component **source** — `$effect` bodies, `{@html}` calls, prop counts, ARIA attributes — which only exists before compilation. The CLI, the Vite plugin's **build mode**, and the live dashboard's whole-project static baseline all read this source directly, so all three cover the full rule set across every category.

Visiting a route in dev additionally re-checks its **rendered HTML** (via `svelteVitalsHandle`) for SEO/Performance/Accessibility — the one thing the static baseline alone can't give you. Build mode reads rendered HTML too, _in addition to_ the source scan, making it the only build-time path with both.

## The packages

### CLI — broadest coverage

`svelte-vitals` reads your project's source directly, so it's the only direct path that covers every route (including SSR and dynamic ones) and all categories. It needs no build and runs anywhere Node does — a terminal, a CI job, a pre-commit hook via `--staged`, or a PR check via `--diff main`. Start here for CI gating; see the [CLI reference](/guides/cli).

### Vite plugin — exact, build-time verification

Build mode runs during `vite build` and parses the **actual prerendered HTML** for SEO/Performance/Accessibility: if the tag isn't in the shipped output it is reported, whatever produced it — and the build fails once a finding reaches the `failOn` threshold. It also scans `.svelte` source for Correctness, Security, Architecture and the component-scoped Performance and Accessibility rules, as the CLI does.

The trade-off is route scope — only prerendered routes get the HTML check; component-scoped rules apply project-wide. See [Plugin mode](/guides/plugin-mode).

The same package also serves a **live dashboard** at `/__svelte-vitals/` during `vite dev`, on by default, with zero build step — whole-project coverage from startup, refined to real rendered results as you browse. It's feedback, not a gate: nothing here fails a build or a CI run. See [Live dashboard](/guides/dev-dashboard).

### GitHub Action — PR gating with zero YAML

Runs the CLI's engine on every pull request and turns findings into GitHub-native feedback: inline annotations, a job summary, and one sticky PR comment that updates in place.

`npx svelte-vitals@latest ci install` (or the `ci-workflow` install target) scaffolds a workflow calling it pinned to a SHA; `svelte-vitals ci upgrade` bumps that pin. The workflow scopes findings to the PR's own changes, so pre-existing issues don't fail other people's PRs. See [CI integration](/guides/ci).

### Agent Skills — rule knowledge for your agent, up front

[Agent Skills](/guides/agent-skills) make an agent _know the rules before it writes code_. `npx skills add oekazuma/svelte-vitals` installs portable `SKILL.md` files that work identically in Claude Code, Codex and Cursor: **`/svelte-vitals`** embeds the rule catalog plus a run-after-every-edit playbook, **`/improve-svelte`** is a read-only audit that turns "review my app" into impact-ranked implementation plans.

They pair with the CLI rather than replace it — knowledge up front, analysis on demand. The playbook itself tells the agent to run `npx svelte-vitals . --diff --reporter agent` after an edit, and `npx svelte-vitals explain <rule-id>` for a rule's rationale and options.

## Recommended setups

- **Just starting out:** run `npx svelte-vitals@latest` locally, then add it to CI (`npx svelte-vitals@latest --fail-on critical`). This alone covers all categories and every route.
- **Hosting on GitHub:** `npx svelte-vitals@latest ci install` instead of hand-writing that CI step — same engine, plus inline PR annotations and the sticky comment, scoped to each PR's own changes.
- **Coding with an AI agent:** install the Agent Skills (`npx skills add oekazuma/svelte-vitals`) — they give the agent the rules before it writes code and tell it to verify each edit with the CLI (`--diff --reporter agent`) afterward.
- **Polishing prerendered/marketing pages:** add the Vite plugin's build mode for an exact, build-time gate on shipped HTML — its live dashboard (on by default) gives you feedback while you write, no extra setup needed.
- **All of the above together** is the common end state — they check different things at different times and don't conflict.
