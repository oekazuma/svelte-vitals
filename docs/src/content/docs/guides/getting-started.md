---
title: Getting started
description: Install svelte-vitals and run your first SEO audit in seconds.
---

## What is svelte-vitals?

svelte-vitals is a SvelteKit SEO and Performance checker that works entirely from source code — no running site, no browser, no build server required. It resolves every route's effective `<head>` by walking the layout chain and parsing `<svelte:head>` blocks, then scores each route and the site as a whole.

## Installation

No install needed for a one-off run:

```bash
npx svelte-vitals
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
npx svelte-vitals
```

To target a sub-directory:

```bash
npx svelte-vitals ./apps/web
```

Example output:

```
Svelte Vitals  ·  SEO (static mode)

Critical (1)
────────────────────────
✗ SEO001  Missing <title>
            /none
            src/routes/none/+page.svelte

Passed (3)
────────────────────────
✓ SEO001  <title>  /blog
✓ SEO001  <title>  ↯ dynamic  /dynamic
✓ SEO001  <title>  /static

↯ = set dynamically (verified at runtime).
```

A `↯` marker means the value is set dynamically (e.g. `<title>{data.title}</title>`). Dynamic titles pass — only genuinely missing or empty metadata is flagged.

## Exit codes

| Code | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| `0`  | No failing findings                                                                       |
| `1`  | A critical finding is present (or the `--fail-on` / `--min-health` threshold was reached) |
| `2`  | Execution error — not a SvelteKit project, or an internal error                           |

These codes are stable and suitable for CI gates.

## Next steps

- See [CLI reference](/svelte-vitals/guides/cli/) for all flags.
- Use [Plugin mode](/svelte-vitals/guides/plugin-mode/) to integrate with `vite build`.
- Use [MCP](/svelte-vitals/guides/mcp/) to let AI agents run the analysis automatically.
