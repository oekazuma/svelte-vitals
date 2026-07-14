# Contributing

This is a pnpm-workspaces monorepo (TypeScript / ESM).

## Requirements

- Node.js — see `devEngines` in [`package.json`](./package.json)
- pnpm — see `packageManager` in [`package.json`](./package.json)

## Setup

```bash
pnpm install
```

## Common commands

```bash
pnpm build       # build all packages (tsup)
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm lint        # prettier --check + eslint
pnpm format      # prettier --write
```

## Packages

| Package                                  | Description                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| [`svelte-vitals`](./packages/cli)        | CLI + static mode (`npx svelte-vitals@latest`)              |
| [`@svelte-vitals/core`](./packages/core) | Runtime-agnostic core: types, rule engine, scorer, reporter |
| [`@svelte-vitals/vite`](./packages/vite) | Plugin mode (build-time): analyzes the prerendered `<head>` |
| [`@svelte-vitals/mcp`](./packages/mcp)   | MCP server: run analysis inside an agent's tool loop        |

Each package also exposes its own `build`, `test`, and `typecheck` scripts, runnable via `pnpm --filter <package> <script>`.

## Documentation site

The docs site lives in [`docs/`](./docs) (Astro + Starlight).

```bash
pnpm --filter docs dev     # local dev server
pnpm --filter docs check   # astro check
pnpm --filter docs build   # production build
```

## Releases

Releases are managed with [Changesets](https://github.com/changesets/changesets): run `pnpm changeset` to describe your change, then merging to `main` opens a release PR.

## CI

Pull requests run lint, typecheck, build, test, and a docs build/check. See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) for the exact jobs.
