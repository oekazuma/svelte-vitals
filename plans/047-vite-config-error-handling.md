# Plan 047: Fail the vite build on an invalid config file; keep the dev server up with defaults

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9e0cf9e..HEAD -- packages/vite/src/plugin.ts packages/vite/src/analyze.ts packages/vite/test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — only already-broken configs change behavior (silent skip →
  loud failure in build; crash → warn-and-defaults in dev)
- **Depends on**: none (parallel-safe with plans 043–046)
- **Category**: bug
- **Planned at**: commit `9e0cf9e`, 2026-08-08

## Why this matters

`svelte-vitals.config.*` validation errors **throw** (unknown rule id, invalid
`weights`, malformed `overrides[]` — `packages/cli/src/config-file.ts:135-235`),
and the CLI exits 2 on them, because a silently-inert config is the failure the
strictness exists to prevent. The vite plugin defeats this in both modes:

- **Build**: `closeBundle` wraps the whole analysis — including config
  resolution — in a `catch` that `console.warn`s and returns. One typo in the
  config file turns `vite build` from "gates on findings" into "prints a
  warning and ships", with exit 0. The catch's own comment ("that's our
  problem, not a real SEO finding") is right for I/O and parse failures, wrong
  for user-config validation.
- **Dev**: `configureServer` awaits `resolveConfig` with **no** guard, so the
  same typo crashes the dev server at startup with an unhandled rejection.

Same input, three behaviors today: plugin **option** errors are fatal at
construction (`plugin.ts:96-110`), config-**file** errors are silently
swallowed in build and fatal-by-crash in dev. After this plan: build fails
loudly, dev warns and falls back to defaults, plugin options unchanged.

## Current state

Files:

- `packages/vite/src/plugin.ts` — `closeBundle` (build gate, ~line 190-220)
  and `configureServer` (dev dashboard, ~line 240-250).
- `packages/vite/src/analyze.ts` — `resolveConfig(cwd, options)` (~line 45-62)
  and `analyze(...)` (~line 69+), which calls `resolveConfig` internally.

`analyze.ts` — `resolveConfig` and `analyze`'s first line:

```ts
export async function resolveConfig(
  cwd: string,
  options: SvelteVitalsOptions
): Promise<{ config: Config; warnings: string[] }> {
  const loaded = await loadConfigFile(cwd);           // ← throws on invalid config
  const fileConfig = loaded?.config;
  const weights = options.weights ?? fileConfig?.weights;
  const overrides = options.overrides ?? fileConfig?.overrides;
  const config = defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? fileConfig?.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? fileConfig?.metaComponents ?? [],
    rules: options.rules ?? fileConfig?.rules ?? {},
    failOn: options.failOn ?? fileConfig?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {}),
    ...(overrides !== undefined ? { overrides } : {})
  });
  return { config, warnings: loaded?.warnings ?? [] };
}

export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions,
  extraProjectFacts?: Partial<Project>
): Promise<AnalyzeResult> {
  const { config, warnings } = await resolveConfig(cwd, options);
  ...
```

`plugin.ts` — the build-path catch (~198-210):

```ts
      let result;
      try {
        const viteMinifyDisabled = minifyFlag
          ? await resolveMinifyDisabled(minifyFlag.minify, minifyFlag.configFile, root)
          : undefined;
        result = await analyze(resolved, root, options, viteMinifyDisabled ? { viteMinifyDisabled } : undefined);
      } catch (err) {
        // The analysis itself failed (unreadable/malformed output, glob error,
        // …). That's our problem, not a real SEO finding, so warn and skip the
        // gate instead of failing the whole build — distinct from `result.failed`.
        console.warn(`svelte-vitals: skipped — analysis failed: ${...}`);
        return;
      }
```

`plugin.ts` — the unguarded dev path (~240-246):

```ts
// This `config` drives the dashboard's rendering/scoring (installUiMiddleware →
// buildSnapshot → buildJsonReport) — the whole-project `runner` below gets its
// config-file values independently, since it calls analyzeProject (which loads
// the config file itself).
const { config, warnings } = await resolveConfig(uiRoot, options);
for (const w of warnings) console.warn(`svelte-vitals: ${w}`);
```

Note from that comment: the dev dashboard's whole-project **runner** calls the
CLI's `analyzeProject` internally, which does its own config loading — that
path is out of scope here (its failure handling lives in the runner).

Repo conventions: conventional commits (`fix(vite): ...`); changeset required
(this one is a **behavior change** — see Step 4); comments state constraints.
Existing test files to model after: `packages/vite/test/analyze.test.ts`
(precedence tests), `packages/vite/test/plugin-options.test.ts`,
`packages/vite/test/ui-plugin-config-file.test.ts`.

## Commands you will need

| Purpose    | Command                                  | Expected on success |
| ---------- | ---------------------------------------- | ------------------- |
| Install    | `pnpm install`                           | exit 0              |
| Typecheck  | `pnpm -r typecheck`                      | exit 0              |
| Vite tests | `pnpm --filter @svelte-vitals/vite test` | all pass            |
| Full suite | `pnpm test`                              | all pass            |
| Lint       | `pnpm lint`                              | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `packages/vite/src/plugin.ts`
- `packages/vite/src/analyze.ts`
- `packages/vite/test/` — the appropriate existing test files (or one new one)
- `.changeset/<new>.md`

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/config-file.ts` — its throw-on-invalid contract is correct
  and shared; no cross-package error marker classes (considered and rejected:
  the hoist below classifies errors by _where_ they occur, which is enough).
- The dev dashboard's whole-project runner / `analyzeProject` internals.
- `packages/vite/src/plugin.ts`'s plugin-**option** validation (~96-110) —
  already correct.

## Git workflow

- Branch: `advisor/047-vite-config-error-handling`
- Commit style: `fix(vite): fail the build on an invalid config file instead of skipping the gate`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Let `analyze` accept a pre-resolved config

In `analyze.ts`, add an optional parameter so a caller can resolve config
themselves:

```ts
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions,
  extraProjectFacts?: Partial<Project>,
  resolved?: { config: Config; warnings: string[] }
): Promise<AnalyzeResult> {
  const { config, warnings } = resolved ?? (await resolveConfig(cwd, options));
```

(If a fifth positional parameter reads badly against the file's style, an
options-bag refactor is acceptable — keep it additive so existing callers and
tests compile unchanged.)

**Verify**: `pnpm -r typecheck` → exit 0;
`pnpm --filter @svelte-vitals/vite test` → all pass.

### Step 2: Build path — hoist config resolution out of the catch

In `closeBundle`, resolve the config **before** the `try`, and pass it in:

```ts
      // Resolved OUTSIDE the try: a config-file validation error must fail the
      // build (same stance as the CLI's exit 2) — the catch below is only for
      // the analysis itself (unreadable output, glob errors).
      const resolvedConfig = await resolveConfig(root, options);

      let result;
      try {
        const viteMinifyDisabled = ...;
        result = await analyze(resolved, root, options, viteMinifyDisabled ? { viteMinifyDisabled } : undefined, resolvedConfig);
      } catch (err) { ... unchanged ... }
```

A throw from `resolveConfig` now propagates out of `closeBundle`, which fails
the vite build — that is the intended behavior. Extend the existing catch
comment as shown so the boundary is documented.

**Verify**: `pnpm --filter @svelte-vitals/vite test` → all pass (existing
tests use valid configs).

### Step 3: Dev path — warn and fall back to defaults

In `configureServer`, wrap the resolve; on failure warn once and build the
config from plugin options alone (no file). To avoid duplicating the merge,
extract the `defineConfig({...})` merge in `resolveConfig` into a small local
helper `mergeConfig(options, fileConfig?)` in `analyze.ts` and use it for the
fallback:

```ts
let config: Config;
let warnings: string[];
try {
  ({ config, warnings } = await resolveConfig(uiRoot, options));
} catch (err) {
  // Dev must not crash on a config typo; the dashboard runs on defaults
  // and says so. The build path (closeBundle) intentionally DOES fail.
  console.warn(
    `svelte-vitals: config file invalid — dashboard using plugin options/defaults: ${err instanceof Error ? err.message : String(err)}`
  );
  ({ config, warnings } = { config: mergeConfig(options, undefined), warnings: [] });
}
```

**Verify**: `pnpm --filter @svelte-vitals/vite test` → all pass.

### Step 4: Tests + changeset

Tests (see "Test plan"), then `pnpm changeset` → `@svelte-vitals/vite`
**minor** (deliberate behavior change, pre-1.0): an invalid
`svelte-vitals.config.*` now fails `vite build` instead of skipping the
analysis with a warning; in `vite dev` it no longer crashes the server — the
dashboard warns and runs on plugin options/defaults. Then `pnpm format`.

**Verify**: `pnpm lint` → exit 0; `pnpm test` → all pass.

## Test plan

Model after the config-file fixtures in `packages/vite/test/analyze.test.ts` /
`ui-plugin-config-file.test.ts` (they already write `svelte-vitals.config.mjs`
files into temp dirs):

1. **Build fails on invalid config**: temp project with a config file
   containing an unknown rule id (e.g. `rules: { 'nope/nope': 'off' }`);
   invoke the plugin's `closeBundle` path (follow how existing plugin tests
   drive it) → the returned promise **rejects** with a message containing the
   config file path. Pin that it is NOT the "skipped — analysis failed" warn
   path (assert no such warn, or assert the rejection reaches the caller).
2. **Dev survives invalid config**: same fixture through `configureServer` →
   server setup completes, a `console.warn` matching
   `config file invalid` fired, and the dashboard config equals the
   plugin-options-only merge (assert via whatever the existing
   `ui-plugin-config-file.test.ts` asserts config through — snapshot/data
   route).
3. **Valid config unchanged**: one existing precedence test still passing
   covers this; no new test needed.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm test` exits 0; the 2 new tests exist and pass
- [ ] In `plugin.ts`, `resolveConfig` is called before the `try` in `closeBundle` (visible in the diff) and inside a `try/catch` in `configureServer`
- [ ] The `closeBundle` catch comment now names the boundary (config errors propagate, analysis errors warn-and-skip)
- [ ] A changeset for `@svelte-vitals/vite` (**minor**) exists and names the behavior change
- [ ] `pnpm lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `plugin.ts` / `analyze.ts` excerpts don't match the live code (drift —
  these files were refactored in PR #396 the day before this plan; verify
  carefully).
- An existing test asserts that an invalid config file is skipped with a warn
  in build mode (would mean the current behavior was pinned deliberately).
- Driving `closeBundle` in a test requires plumbing this plan doesn't
  anticipate (report how the existing plugin tests invoke hooks rather than
  inventing a harness).
- `resolveMinifyDisabled` turns out to also throw config-shaped errors — its
  placement inside the try is deliberate today; report instead of moving it.

## Maintenance notes

- The boundary is now: **where** the error happens classifies it (config
  resolution = user error = fail loudly; analysis = tool problem = warn and
  skip). Future code added to `closeBundle` should land on the correct side of
  the `try`.
- If the CLI's `loadConfigFile` ever gains warning-instead-of-throw modes, the
  dev fallback here can surface those warnings instead of defaults — revisit
  then.
- Reviewer should check the dev-path fallback uses plugin options (not silently
  ignoring them) — `mergeConfig(options, undefined)` keeps explicit options.
