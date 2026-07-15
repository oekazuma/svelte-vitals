---
'svelte-vitals': minor
---

`svelte-vitals install` now understands monorepos. The app-scoped targets — `vite-plugin`, `vite-hooks`, and `config-file` — resolve the SvelteKit app directory the same way the analyzer does: an explicit `--app apps/web` wins, a cwd that is itself an app is used as-is, one detected app is used automatically with a notice, several prompt a picker on a TTY, and non-interactive runs exit 2 asking for `--app`. The `@svelte-vitals/vite` auto-install also runs inside the chosen app (with the package manager still detected from the workspace root's lockfile). Root-scoped targets (MCP client configs, agent skills/rules, `ci-workflow`) keep writing at the current directory, which is their correct home in a monorepo.
