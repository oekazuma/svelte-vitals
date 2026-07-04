# CLI install wizard — Vite plugin targets

**Date:** 2026-07-04
**Status:** Approved
**Package:** `svelte-vitals` (CLI)

## Context

Follow-up to the [install wizard](./2026-07-03-cli-install-wizard-design.md), which automated MCP client setup (Claude Code, Cursor, Codex) but left `@svelte-vitals/vite` entirely manual: users hand-edit `vite.config.ts` to register the build-mode plugin and `src/hooks.server.ts` to wire up the dev overlay (see `docs/.../guides/plugin-mode.md`, `.../dev-overlay.md`). Getting users onto more of the surface area (not just the CLI) is a core adoption goal, so removing this manual step directly serves it.

Unlike the MCP client configs (JSON/TOML files svelte-vitals owns a single key in), `vite.config.ts` and `src/hooks.server.ts` are hand-written TS/JS source files with no fixed schema. Editing them safely requires an AST-based codemod, not string/regex patching.

## Goal

Extend `npx svelte-vitals install` so the same wizard can also register `@svelte-vitals/vite`'s build-mode plugin and/or dev-overlay hook in the user's project, installing the package if needed — while never producing invalid or semantically-wrong source. When the existing file's shape isn't one the codemod confidently recognizes, it skips the write and prints the exact snippet to paste in by hand, rather than guessing.

## Decisions (settled during brainstorming)

1. **Integrated into the existing `install` wizard**, not a separate subcommand — one entry point, selectable targets.
2. **Two independent targets**, not one bundled "Vite integration": `vite-plugin` (build-mode gate in `vite.config.ts`) and `vite-dev-overlay` (`src/hooks.server.ts` hook), each separately selectable. Clack's per-option `hint` explains the difference inline (see §3).
3. **Codemod via `magicast`** (already resolvable in the workspace's lockfile via a transitive dependency, so no new version-resolution risk) — parses and mutates the source AST while preserving formatting/comments, rather than regex/string patching.
4. **Safe subset + manual fallback.** The codemod recognizes a defined set of common shapes (§4, §5). Anything else is left untouched; the plan reports it as `manual` and the tool prints the snippet to paste in.
5. **Auto-installs `@svelte-vitals/vite`** via the detected package manager if either vite target is selected and the package isn't already a dependency.

## Design

### 1. New target types (`src/install/vite-targets.ts`)

```ts
export type ViteTargetId = 'vite-plugin' | 'vite-dev-overlay';

export interface ViteTarget {
  id: ViteTargetId;
  label: string;
  hint: string;
}

export const VITE_TARGETS: ViteTarget[] = [
  {
    id: 'vite-plugin',
    label: 'Vite plugin (build gate)',
    hint: 'Fails `vite build` when prerendered pages cross the SEO/Performance threshold'
  },
  {
    id: 'vite-dev-overlay',
    label: 'Dev overlay',
    hint: 'Live warnings in `vite dev` only — never fails a build or CI'
  }
];
```

`ClientId` (existing) and `ViteTargetId` (new) are both narrowed from a broader `TargetId` union used at the CLI-argument and plan-row level, so `--client` continues to accept either kind of id without a new flag.

### 2. Detection & defaults

- MCP clients: unchanged — preselected when their config file already exists.
- `vite-plugin` / `vite-dev-overlay`: preselected when a `vite.config.{ts,js,mjs}` exists in `cwd` (signal that this is a Vite/SvelteKit project). Otherwise shown but unselected.
- Scope selection (project/global) still only applies to MCP clients; Vite targets have no scope concept and skip that prompt step.

### 3. Wizard UX

Single `multiselect` lists all five options (three clients + two Vite targets) with per-option `hint`:

```
Which clients/targets should svelte-vitals be installed for?
  [x] Claude Code
  [ ] Cursor
  [ ] Codex
  [x] Vite plugin (build gate)   Fails `vite build` when prerendered pages cross the SEO/Performance threshold
  [ ] Dev overlay                Live warnings in `vite dev` only — never fails a build or CI
```

Plan preview gains rows for Vite targets, same format as today: `  <label> → <path>  [<status>]`, where `<status>` is one of `created | added | exists | updated | manual`. A `manual` row prints its snippet directly beneath it in the preview, so `--dry-run` shows exactly what a human would need to paste.

### 4. `vite.config.ts` codemod

Recognized shape: a default-exported (or `defineConfig(...)`-wrapped) object literal with a `plugins` array literal.

- **Already present** (an import of `svelteVitals` from `@svelte-vitals/vite` and a matching call inside `plugins`) → `exists` (skip unless `--force`).
- **Recognized shape, not present** → add `import { svelteVitals } from '@svelte-vitals/vite';` and unshift `svelteVitals()` into the `plugins` array → `added` (new import) or `created` (file didn't exist — see below).
- **Unrecognized shape** (no static `plugins` array, config built via a function/spread that magicast can't resolve, etc.) → `manual`, no write. Snippet printed:

  ```ts
  import { svelteVitals } from '@svelte-vitals/vite';
  // add svelteVitals() to your `plugins` array
  ```

- **File doesn't exist at all** → not created from scratch (a missing `vite.config.ts` means this isn't a Vite project); target reports `manual` with a short note instead of fabricating a config file.

### 5. `src/hooks.server.ts` codemod

- **File doesn't exist** → create it fresh:

  ```ts
  import { svelteVitalsHandle } from '@svelte-vitals/vite/hooks';
  import { sequence } from '@sveltejs/kit/hooks';

  export const handle = sequence(svelteVitalsHandle());
  ```

  Status: `created`.

- **`export const handle = sequence(a, b, ...)` already present** → append `svelteVitalsHandle()` to the call's arguments (skip if already one of them → `exists`). Status: `added`.
- **`export const handle = someExpr;` (not a `sequence(...)` call)** → rewrite to `export const handle = sequence(someExpr, svelteVitalsHandle());`, adding the `sequence` import from `@sveltejs/kit/hooks` if missing. Status: `updated`.
- **Anything else** (conditional exports, a `handle` built through a custom composition helper, multiple `handle` exports, etc.) → `manual`, no write; snippet printed showing the `sequence(...)` pattern to adopt by hand.

### 6. Package auto-install

If either Vite target is selected and `@svelte-vitals/vite` is not already in `package.json`'s `dependencies`/`devDependencies`, run an install after the file writes succeed:

```ts
function detectPackageManager(cwd: string): 'pnpm' | 'yarn' | 'npm' | 'bun' {
  if (exists(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(join(cwd, 'yarn.lock'))) return 'yarn';
  if (exists(join(cwd, 'bun.lockb'))) return 'bun';
  return 'npm'; // package-lock.json or no lockfile found
}
```

Runs `<pm> add -D @svelte-vitals/vite` via `node:child_process`. Hand-rolled (no new dependency for this — the detection is ~10 lines). Failure to install is reported but does not roll back the file writes already made (the config edit is still correct; the user can install the package themselves).

### 7. CLI flags

`--client` accepts the union of `claude-code,cursor,codex,vite-plugin,vite-dev-overlay` (documented in `cli.md`). `--scope`, `--yes`, `--dry-run`, `--force` behave as today across all targets. No new flags.

### 8. Testing

Same injected-IO pattern as the existing wizard (`InstallIO`/`InstallPrompts`), extended with fixtures for `vite.config.ts` / `hooks.server.ts` covering: absent file, recognized-empty, already-configured, and each unrecognized shape. Magicast output is asserted with snapshot tests. The package-manager install step is exercised through an injected `runCommand` (mirroring `readFile`/`writeFile`), not a real child process, in tests.

## Out of scope

- Build tools other than Vite (webpack, etc.).
- Any recovery UI beyond a warning if package-manager detection is wrong or the install command fails.
- Rewriting `hooks.server.ts` shapes beyond the three listed in §5.
