---
title: Getting started
description: Install svelte-vitals and run your first health check in seconds.
sidebar:
  order: 1
---

## What is svelte-vitals?

svelte-vitals is a static code-health checker for SvelteKit. It scores your app per route and site-wide, before you deploy, across six categories: SEO, Performance, Correctness, Security, Architecture, and Accessibility.

The CLI works entirely from source. It resolves every route's effective `<head>` by walking the layout chain and parsing `<svelte:head>` blocks, and it reads component bodies for the rules that live there. No running site and no browser are involved. For prerendered pages, the [Vite plugin](/guides/plugin-mode) runs the same rules against the HTML your build actually ships. That is the more accurate of the two checks, since nothing is left dynamic.

## Prerequisites

Node.js 24.16 or later is required.

## Installation

No install needed for a one-off run:

```bash
npx svelte-vitals@latest
```

To add it as a dev dependency:

```bash
npm install --save-dev svelte-vitals
# or
pnpm add -D svelte-vitals
```

## First run

Run inside the root of any SvelteKit project:

```bash
npx svelte-vitals@latest --verbose
```

To target a sub-directory:

```bash
npx svelte-vitals@latest ./apps/web --verbose
```

Example output (`--verbose` shows every passed check individually rather than just a count):

```text
Svelte Vitals  ·  static mode

Health: 79/100
SEO Score: 79/100   (route avg 96 · capped at 79: critical present)

Critical (1)
────────────────────────
✗ seo/title-presence  Missing <title>
            /none
            src/routes/none/+page.svelte

Passed (3)
────────────────────────
✓ seo/title-presence  <title>  /blog
✓ seo/title-presence  <title>  ↯ dynamic  /dynamic
✓ seo/title-presence  <title>  /static

↯ = set dynamically (verified at runtime).
```

A `↯` marker means the value is set dynamically, as in `<title>{data.title}</title>`. Dynamic titles pass. svelte-vitals flags only genuinely missing or empty metadata. Without `--verbose`, the `Passed` section collapses to a bare count, `Passed (3)`, and this footnote is omitted, since no `↯` marker would then be on screen for it to explain.

## Exit codes

| Code | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| `0`  | No failing findings                                                                       |
| `1`  | A critical finding is present (or the `--fail-on` / `--min-health` threshold was reached) |
| `2`  | Execution error: not a SvelteKit project, or an internal error                            |

These codes are stable and suitable for CI gates.

## Next steps

- Not sure which package to reach for? See [Choosing a package](/guides/choosing-a-package) for a comparison of the CLI, the Vite plugin, the GitHub Action, and Agent Skills.
- See [CLI reference](/guides/cli) for all flags.
- Use [Plugin mode](/guides/plugin-mode) to integrate with `vite build`.
- Install [Agent Skills](/guides/agent-skills) to let AI agents apply the rules and run the analysis themselves. `npx skills add oekazuma/svelte-vitals` installs them for Claude Code / Codex / Cursor in one step.
