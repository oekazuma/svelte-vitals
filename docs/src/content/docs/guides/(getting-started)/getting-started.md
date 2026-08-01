---
title: Getting started
description: Install svelte-vitals and run your first SEO audit in seconds.
sidebar:
  order: 1
---

## What is svelte-vitals?

svelte-vitals is a SvelteKit SEO and Performance checker that works entirely from source code — no running site, no browser, no build server required. It resolves every route's effective `<head>` by walking the layout chain and parsing `<svelte:head>` blocks, then scores each route and the site as a whole.

## Prerequisites

Node.js 22.13 or later is required.

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

A `↯` marker means the value is set dynamically (e.g. `<title>{data.title}</title>`). Dynamic titles pass — only genuinely missing or empty metadata is flagged. Without `--verbose`, the `Passed` section collapses to a bare count (`Passed (3)`) and this footnote is omitted, since there'd be no `↯` marker on screen for it to explain.

## Exit codes

| Code | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| `0`  | No failing findings                                                                       |
| `1`  | A critical finding is present (or the `--fail-on` / `--min-health` threshold was reached) |
| `2`  | Execution error — not a SvelteKit project, or an internal error                           |

These codes are stable and suitable for CI gates.

## Next steps

- Not sure which package to reach for? See [Choosing a package](/guides/choosing-a-package) for a comparison of the CLI, the Vite plugin, the GitHub Action, and Agent Skills.
- See [CLI reference](/guides/cli) for all flags.
- Use [Plugin mode](/guides/plugin-mode) to integrate with `vite build`.
- Install [Agent Skills](/guides/agent-skills) to let AI agents apply the rules and run the analysis themselves — `npx svelte-vitals@latest install` writes them for Claude Code / Codex / Cursor in one step.
