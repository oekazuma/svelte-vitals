# AGENTS.md

Repository conventions for AI agent sessions. Read this before exploring the codebase — it exists so you don't have to rediscover (or guess) these facts every session.

## What this is

svelte-vitals is a static code-health checker for SvelteKit — not a runtime Web Vitals reporter. It statically analyzes source code (resolved `<head>` metadata and component bodies) across five categories: SEO, Performance, Correctness, Security, Architecture. The project is pre-1.0 (all packages are on `0.x` versions).

## Verify commands

| Purpose        | Command              | Notes                                 |
| -------------- | -------------------- | ------------------------------------- |
| Build          | `pnpm build`         | `pnpm -r build`                       |
| Typecheck      | `pnpm typecheck`     | `pnpm -r typecheck`                   |
| Test           | `pnpm test`          | `pnpm -r test` (vitest)               |
| Lint           | `pnpm lint`          | `oxlint .` + `oxfmt --check .`        |
| Format         | `pnpm format`        | `oxfmt --write .`                     |
| Publish checks | `pnpm check:publish` | publint + attw (`--profile esm-only`) |

CI (`.github/workflows/ci.yml`) runs four jobs: `lint`, `check` (build + typecheck + check:publish), `test`, `docs`. Run the relevant verify commands yourself and confirm they pass **before** claiming a task is complete.

## Package map

- `packages/core` — runtime-agnostic rule engine, scorer, and reporter (types + logic only).
- `packages/cli` — the `svelte-vitals` CLI.
- `packages/vite` — Vite/SvelteKit plugin + dev overlay; analyzes prerendered HTML during `vite build`.
- `packages/mcp` — Model Context Protocol server exposing svelte-vitals to agent tool loops.
- `docs` — Astro Starlight docs site, English + Japanese (`docs/src/content/docs/` and `docs/src/content/docs/ja/`).

The first-party GitHub Action is **not** part of this monorepo — it lives in its own repository,
[oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action), depending on
the published `svelte-vitals`/`@svelte-vitals/core` npm packages like any other consumer (regular
semver ranges, not workspace links). See `docs/superpowers/specs/2026-07-22-action-dist-post-merge-only.md`
for why it was split out. `packages/cli/scripts/gen-action-pin.mjs` (run manually via
`pnpm --filter svelte-vitals run update-action-pin`, not on every build) fetches that repo's
latest release into the committed `packages/cli/src/ci/action-pin.generated.ts`, which `ci
install`/`ci upgrade` bundle into scaffolded workflows.

## Hard rules

- **Core purity**: `packages/core/src/index.ts` states verbatim: "runtime-agnostic core (design §8). No `node:` imports, no I/O, no runtime-specific globals." All I/O is injected through the `Runtime` interface (`packages/core/src/runtime.ts`). Never add a `node:` import or direct I/O call inside `packages/core`.
- **Dependencies via catalog**: root `package.json` devDependencies are all pinned as `catalog:`; actual versions live in `pnpm-workspace.yaml`. Add/bump shared devDependencies there, not as literal versions in a package's `package.json`.
- **Changesets required**: any user-facing change needs `pnpm changeset`. Merging to `main` opens a release PR (Changesets bot). Internal-only / doc-only changes don't need one.
- **en/ja docs stay in sync**: `docs/src/content/docs/` (English) and `docs/src/content/docs/ja/` (Japanese) are updated together by convention — don't ship an English-only doc change if the Japanese equivalent exists.

## Conventions

- **Conventional commits**, scoped by package, e.g.:
  - `fix(cli): make --diff/--staged work when the project is not at the git repo root`
  - `test(cli): pin behavior for malformed .svelte files in both passes`
  - Other prefixes in use: `feat(vite):`, `docs:`, `chore:`.
- **Adding a rule**: create `packages/core/src/rules/<dir>/<slug>.ts` (the Performance directory is `perf/`, not `performance/`), then register it in **four** places: `packages/core/src/rules/index.ts` (the import, the `allRules` array, and the re-export block) _and_ `packages/core/src/index.ts`'s own `export { ... } from './rules/index.js'` list, which duplicates the same names. TypeScript won't catch a missed spot in the fourth place (it's a plain re-export list), so grep for the previous rule's id after adding a new one. Add rule docs under `docs/src/content/docs/rules/<id>.md` (en) and `docs/src/content/docs/ja/rules/<id>.md` (ja) — `packages/cli/test/docs-links.test.ts` fails the build if either is missing. (`<id>` already includes the category, e.g. `docs/src/content/docs/rules/performance/heavy-import.md` — note the docs tree uses `performance/` here, not the source tree's `perf/`.) Then regenerate the index pages with `pnpm --filter svelte-vitals run gen:rules-index && pnpm format` and commit them; `packages/cli/test/rules-index.test.mjs` fails the build if they are stale. **Never hard-code rule counts or ID ranges in READMEs/guides** (e.g. "CORRECT001–009" or "the two Performance rules") — such text rots on every new rule; refer to rule _categories_ instead. Rule IDs in guides are fine only as examples or sample output.
- **Tests**: vitest, per-package `test/` directories; fixtures live under `test/fixtures/`.

## Design docs

`docs/superpowers/specs/` holds design docs, `docs/superpowers/plans/` holds implementation plans, both accumulated with date-prefixed filenames. Before assuming a tradeoff is undecided or reintroducing something that was deliberately removed, check here first — e.g. the a11y category was designed (`2026-06-22-a11y-v0.5-design.md`) and later removed (`docs/superpowers/specs/2026-06-23-remove-a11y-design.md`, `docs/superpowers/plans/2026-06-23-remove-a11y.md`).

## Exit codes

The CLI's contract (`packages/cli/src/bin.ts`):

- `0` — no failing findings
- `1` — critical finding present (or `--fail-on`/`--min-health` threshold reached)
- `2` — execution error (not a SvelteKit project / internal error)

## Svelte MCP server

The Svelte MCP server (configured in `.mcp.json`) provides Svelte 5 / SvelteKit documentation and code validation. Use it whenever the task involves Svelte/SvelteKit topics or writing `.svelte` code:

- `list-sections` — call this first to discover the available documentation sections (returns titles, `use_cases`, and paths).
- `get-documentation` — after `list-sections`, fetch every section relevant to the task (accepts single or multiple sections; judge relevance by the `use_cases` field).
- `svelte-autofixer` — run on any Svelte code before presenting it; keep re-running until it returns no issues or suggestions.
- `playground-link` — generates a Svelte Playground link. Only after the user confirms they want one, and never for code already written to files in the project.
