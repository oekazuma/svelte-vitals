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
pnpm build          # build all packages (tsup)
pnpm test           # vitest
pnpm typecheck      # tsc --noEmit
pnpm lint           # oxlint + oxfmt --check
pnpm format         # oxfmt --write
pnpm check:publish  # publint + attw (--profile esm-only)
```

## Packages

| Package                                  | Description                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| [`svelte-vitals`](./packages/cli)        | CLI + static mode (`npx svelte-vitals@latest`)                              |
| [`@svelte-vitals/core`](./packages/core) | Runtime-agnostic core: types, rule engine, scorer, reporters, full rule set |
| [`@svelte-vitals/vite`](./packages/vite) | Plugin mode (build-time) + the live dev dashboard                           |
| [`@svelte-vitals/mcp`](./packages/mcp)   | MCP server: run analysis inside an agent's tool loop                        |

Each package also exposes its own `build`, `test`, and `typecheck` scripts, runnable via `pnpm --filter <package> <script>`.

The first-party GitHub Action lives in its own repository, [oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) — not a subdirectory of this monorepo (see `docs/superpowers/specs/2026-07-22-action-dist-post-merge-only.md` for why).

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
