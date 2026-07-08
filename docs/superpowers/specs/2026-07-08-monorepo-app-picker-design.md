# Monorepo app auto-detection + interactive picker for the CLI

**Date:** 2026-07-08
**Status:** Accepted (maintainer-approved in session; implementation plan: `plans/019-monorepo-app-picker.md`)
**Packages:** `svelte-vitals` (CLI only — no core/mcp/vite changes)

## Goal

Running `npx svelte-vitals` at a monorepo root currently dead-ends with exit 2
("No SvelteKit project found in the current directory"), forcing the user to
know and type the app path (`npx svelte-vitals ./apps/web`). Turn that dead end
into a helpful path: detect SvelteKit apps in the repository and either analyze
the only one found or let the user pick interactively.

Requested by the maintainer on 2026-07-08. This lifts the previous deferral
("monorepo support: wait for real user demand", recorded in `plans/README.md`).

## Decisions (maintainer-approved)

1. **Trigger: failure-time only.** Discovery runs only when (a) no path
   argument was given AND (b) `detectProject(cwd)` threw `ProjectError`. Every
   currently-working invocation is untouched. When an **explicit** path fails
   detection, the CLI still errors immediately — the user's stated target is
   never silently reinterpreted.
2. **Non-TTY (CI, agents): never prompt.** Exit 2 with the detected app list
   embedded in the error and a hint to pass a path
   (`npx svelte-vitals apps/web`). No implicit selection in CI.
3. **TTY, exactly one app: auto-run.** Print
   `svelte-vitals: detected SvelteKit app at apps/web; analyzing it.` to stderr
   and continue. A one-option prompt is noise.
4. **TTY, multiple apps: single-select prompt** via `@clack/prompts` (already a
   CLI dependency; same style as the `install` wizard). Cancel exits 0.

## Detection method

**Chosen: glob for `svelte.config.{js,ts}`, filtered by `src/routes`.**

- Glob `**/svelte.config.{js,ts}` from cwd with ignores
  `node_modules`, `.svelte-kit`, `build`, `dist`, `.git` and a depth cap of 4
  path segments.
- A candidate qualifies only if `<dir>/src/routes` also exists. This excludes
  SvelteKit component libraries (svelte.config without routes) — there is
  nothing for svelte-vitals to analyze there.
- Results are sorted by path for deterministic ordering.

**Rejected alternative: workspace-manifest parsing** (`pnpm-workspace.yaml`
globs / `package.json#workspaces`). More "correct" on paper but needs YAML
parsing, misses monorepos that don't declare workspaces (plain dirs, some Nx
setups), and is more code for a narrower net. The glob approach is
tool-agnostic.

## Flow

```
run(opts)
  └─ analyzeProject(cwd) throws ProjectError
       ├─ opts.cwd was an explicit CLI path → error, exit 2 (unchanged)
       └─ no explicit path:
            apps = discoverApps(cwd)
            ├─ 0 apps            → original error (reworded, see below), exit 2
            ├─ 1 app             → stderr notice, re-run analysis with that dir as cwd
            ├─ >1 apps, TTY      → clack select → re-run with chosen dir (cancel → exit 0)
            └─ >1 apps, non-TTY  → exit 2, error lists apps + "pass a path" hint
```

After selection the chosen directory becomes the analysis `cwd`, so the
`svelte-vitals.config.*` file is read from the selected app (existing
semantics) and `--diff`/`--staged`/`--baseline` keep working — their
subdirectory handling shipped in plans 001/014.

The picker is injected into `run()` as an optional function option
(test-injectable, like the `install` wizard's `InstallPrompts`), defaulting to
a clack implementation in `bin.ts`'s wiring.

## Targeted fix riding along

`detectProject`'s error message ends with "or pass --config." — `--config` is
not a flag that exists. Since this message is being reworked anyway, it becomes:
`No SvelteKit project found in the current directory. Run this inside a SvelteKit app, or pass a path (e.g. npx svelte-vitals apps/web).`

## Non-goals (YAGNI)

- Analyzing multiple/all detected apps in one run — aggregate-Health semantics
  is a separate design question.
- The same discovery in `@svelte-vitals/mcp` or `@svelte-vitals/vite`
  (`analyzeProject` keeps throwing; discovery is a CLI-UX concern).
- Workspace-manifest parsing.
- A flag to force the picker (`--pick`) — failure-time trigger covers the need.

## Test plan

Fixture: minimal monorepo under `packages/cli/test/fixtures/` with
`apps/web` + `apps/admin` (both SvelteKit apps with routes) and `packages/ui`
(svelte.config, no routes → must be excluded).

Paths pinned by tests: 0 apps / 1 app auto-run / multiple + TTY select /
multiple + TTY cancel / multiple + non-TTY error / explicit-path failure stays
an immediate error / `packages/ui` exclusion / depth cap and ignore dirs.
