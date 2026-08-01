---
title: Monorepos
description: How svelte-vitals picks which SvelteKit app to analyze, why it exits 2 instead of prompting in a non-interactive shell, and how to name the app explicitly.
---

# Monorepos

## Naming the app is always safest

```bash
npx svelte-vitals@latest apps/web
```

An explicit `path` — or running from inside the app directory — takes priority and skips
detection entirely. In a script, a hook, or an agent's shell, prefer this over relying on
detection.

## What happens without a path

When no `path` is given and the current directory is not itself a SvelteKit app, svelte-vitals
looks for nearby apps (a directory with `svelte.config.{js,ts}` and `src/routes`):

| Found       | Interactive terminal                | Non-interactive (CI, agents, piped output)                 |
| ----------- | ----------------------------------- | ---------------------------------------------------------- |
| exactly one | analyzed, notice on stderr          | same — analyzed, notice on stderr                          |
| several     | single-select prompt                | **exit `2`** listing the apps, asking for an explicit path |
| none        | exit `2`, "not a SvelteKit project" | same                                                       |

**svelte-vitals never prompts when stdout is not a TTY.** A non-interactive run with several apps
fails fast with the list rather than hanging or guessing — if you hit exit `2` here, re-run with
the path it printed.

Cancelling the interactive prompt exits `0` without analyzing anything.

## `install` in a monorepo

`svelte-vitals install` splits its targets by where they belong:

- `vite-plugin`, `vite-hooks`, `config-file` write into the **app** directory — they resolve it
  the same way the analyzer does, and `--app <dir>` names it explicitly.
- the agent skills and `ci-workflow` always write at the **current** directory, because the repo
  root is their correct home.

```bash
npx svelte-vitals@latest install --client vite-plugin,config-file --app apps/web --yes
```

`--app` pointing at a directory that is not a SvelteKit app is an error (exit `2`).

## Related

- `svelte-vitals docs show output` — what exit `2` means versus exit `1`
