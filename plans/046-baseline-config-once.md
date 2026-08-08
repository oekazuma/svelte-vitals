# Plan 046: Load the config file once and reuse it for the `--baseline` analysis

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9e0cf9e..HEAD -- packages/cli/src/index.ts packages/cli/src/config-file.ts packages/cli/src/baseline.ts packages/cli/test/run-baseline.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — changes which config governs the baseline side of the
  comparison (deliberately; see "The semantic decision"). Public API gets one
  additive optional field.
- **Depends on**: `plans/043-string-flag-value-guard.md` — not logically, but
  both touch `packages/cli/src/index.ts`'s call-site surroundings; execute
  serially (043 first) to avoid conflicts.
- **Category**: bug
- **Planned at**: commit `9e0cf9e`, 2026-08-08

## Why this matters

`--baseline <ref>` checks out `<ref>` into a worktree under `os.tmpdir()` and
runs `analyzeProject` there. `analyzeProject` **loads the config file from its
cwd** — so the baseline run re-imports `svelte-vitals.config.*` from a
directory that has **no `node_modules` anywhere in its ancestry**. The `install`
wizard's own `.ts` scaffold emits `import { defineConfig } from 'svelte-vitals'`
(a runtime bare-specifier import), so for every project that took the wizard's
default, the baseline-side config load throws `ERR_MODULE_NOT_FOUND`, the
`catch` logs one stderr line, and **all findings are reported as new** — the PR
gate exits 1 on unrelated changes. The tool's own scaffolder produces the
config that disables the tool's own baseline gate.

There is a second, quieter wrong: even when the worktree config _does_ load, it
is the **ref's** config, so the two sides of the comparison run under different
rule sets whenever the config changed between ref and HEAD, producing findings
"introduced" by a config edit rather than by code.

## The semantic decision (already made — implement, don't relitigate)

**The current checkout's config file governs both sides of the comparison.**
A baseline run answers "which findings does my change introduce, under today's
policy?" — policy is an input to the comparison, not part of the compared code.
This also happens to be what makes the fix mechanical: load the config file
once, in the real cwd, and hand the loaded result to the baseline
`analyzeProject` call instead of letting it re-load from the worktree.

## Current state

Files:

- `packages/cli/src/index.ts` — `analyzeProject()` (config load + merge,
  ~line 203+), `applyScope()` (baseline block, ~line 291-307), `run()`.
- `packages/cli/src/config-file.ts` — `loadConfigFile(cwd)`; check its exact
  return type (it returns `undefined` when no config file exists, otherwise an
  object with at least `config` and `warnings`).
- `packages/cli/src/baseline.ts` — worktree creation
  (`mkdtempSync(join(tmpdir(), 'svelte-vitals-baseline-'))`); no changes here.
- `packages/cli/src/install/config-content.ts:19-21` — the scaffold emitting
  the runtime `defineConfig` import (context only, do not modify).

`analyzeProject`'s config load (`index.ts:203-223`):

```ts
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();

  const loaded = await loadConfigFile(cwd);
  const file = loaded?.config;

  const weights = opts.weights ?? file?.weights;
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? file?.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? file?.metaComponents ?? [],
    rules: resolveRuleSelection({ fileRules: file?.rules, rules: opts.rules, allowRules: opts.allowRules, ignoreRules: opts.ignoreRules }),
    failOn: opts.failOn ?? file?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {}),
    ...(file?.overrides !== undefined ? { overrides: file.overrides } : {})
  });
```

The baseline block in `applyScope` (`index.ts:291-307`):

```ts
if (opts.baseline !== undefined) {
  const checkout = checkoutBaseline(opts.cwd, opts.baseline);
  if (checkout === undefined) {
    errorLog(`svelte-vitals: could not analyze baseline '${opts.baseline}' (...); reporting all findings.`);
  } else {
    try {
      const base = await analyzeProject({ ...opts.analyzeOpts, cwd: checkout.analyzeCwd });
      scoped = filterToNewFindings(scoped, base.results);
    } catch {
      errorLog(`svelte-vitals: baseline analysis of '${opts.baseline}' failed; reporting all findings.`);
    } finally {
      checkout.cleanup();
    }
  }
}
```

Key observation: the baseline call already reuses the **explicit** options
(`...opts.analyzeOpts`); only the **file** config is re-derived from the wrong
cwd. Injecting the loaded file result reproduces the identical effective config
on both sides.

Repo conventions: conventional commits (`fix(cli): ...`); changeset required;
public-API JSDoc on exported options fields; tests build real temp git repos
with explicit identity (`git -c user.name=... -c user.email=...` — see
`packages/cli/test/run-baseline.test.ts` for the exact pattern).

## Commands you will need

| Purpose        | Command                                                                 | Expected on success |
| -------------- | ----------------------------------------------------------------------- | ------------------- |
| Install        | `pnpm install`                                                          | exit 0              |
| Typecheck      | `pnpm -r typecheck`                                                     | exit 0              |
| CLI tests      | `pnpm --filter svelte-vitals test`                                      | all pass            |
| Baseline tests | `pnpm --filter svelte-vitals exec vitest run test/run-baseline.test.ts` | all pass            |
| Full suite     | `pnpm test`                                                             | all pass            |
| Lint           | `pnpm lint`                                                             | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `packages/cli/src/index.ts`
- `packages/cli/src/config-file.ts` — only if the loaded-result type needs a
  named export to be referenced in `AnalyzeOptions`
- `packages/cli/test/run-baseline.test.ts`
- `.changeset/<new>.md`

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/baseline.ts` — the tmpdir worktree location is fine once
  the config no longer loads there; moving the worktree into the repo was
  considered and rejected (glob-exclusion and crash-cleanup risks).
- `packages/cli/src/install/config-content.ts` — the scaffold's `defineConfig`
  import is a feature (type-checked configs), not the bug.
- `packages/vite/**` — the vite plugin has no baseline path.

## Git workflow

- Branch: `advisor/046-baseline-config-once`
- Commit style: `fix(cli): analyze the baseline under the current checkout's config instead of re-loading it in the worktree`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the injection point to `analyzeProject`

In `index.ts`, extend `AnalyzeOptions` with an optional field (JSDoc included —
this is public API):

```ts
  /**
   * Result of a `loadConfigFile()` call to reuse instead of loading from `cwd`.
   * Pass the value loaded from the real project so a secondary analysis (the
   * `--baseline` worktree) runs under the same config file; `null` means "the
   * project has no config file — do not look for one".
   */
  loadedConfig?: Awaited<ReturnType<typeof loadConfigFile>> | null;
```

(If that type alias reads poorly, export a named type from `config-file.ts`
— e.g. `export type LoadedConfigFile = ...` — and use it; keep it additive.)

In the function body:

```ts
const loaded = opts.loadedConfig !== undefined ? (opts.loadedConfig ?? undefined) : await loadConfigFile(cwd);
```

Everything downstream (`file`, warnings concatenation) is unchanged.

**Verify**: `pnpm -r typecheck` → exit 0; `pnpm --filter svelte-vitals test` →
all pass (no behavior change yet — the field is unused).

### Step 2: Expose the loaded config to `applyScope` and pass it through

Trace how `applyScope` receives `opts.analyzeOpts` from `run()` (read `run()`
around its `analyzeProject` call and the `applyScope` invocation). Implement
the smallest of these that fits the actual code shape:

- **Preferred**: have `analyzeProject` include the loaded result in its return
  value (add a field to `AnalyzeResult`, e.g. `loadedConfig`), and have `run()`
  pass `analysis.loadedConfig ?? null` into `applyScope`'s options, which
  forwards it: `analyzeProject({ ...opts.analyzeOpts, cwd: checkout.analyzeCwd, loadedConfig: opts.loadedConfig ?? null })`.
- Alternative (if `AnalyzeResult` is awkward to extend): `run()` calls
  `loadConfigFile` once itself and passes the same value to BOTH the main
  `analyzeProject` call (via `loadedConfig`) and `applyScope`. This must not
  cause a double load or double warning print — check where config warnings are
  printed before choosing this route.

The `??  null` is load-bearing: when the project has no config file, the
baseline side must **skip** the lookup (`null`), not fall back to loading from
the worktree (`undefined`).

Keep the `try/catch` around the baseline `analyzeProject` — other failures
(broken checkout, parse explosions) must still degrade to "reporting all
findings" with the existing stderr line.

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/run-baseline.test.ts`
→ existing tests all pass.

### Step 3: Regression test — the `ERR_MODULE_NOT_FOUND` shape

In `run-baseline.test.ts`, following the file's temp-git-repo pattern:

1. Create a temp repo. Write `node_modules/fake-pkg/package.json`
   (`{"name":"fake-pkg","version":"1.0.0","type":"module","main":"index.js"}`)
   and `node_modules/fake-pkg/index.js` (`export const marker = true;`).
   Do **not** `git add node_modules` (it stays untracked, as in real projects).
2. Commit (as commit A) a `svelte-vitals.config.mjs` that does
   `import 'fake-pkg';` and exports a default config, together with a route
   containing a known finding F.
3. Make a working-tree change introducing a second finding G in another file.
4. Run with `baseline: 'HEAD'`.
5. Assert: G is reported, F is **not**, and stderr does **not** contain
   `baseline analysis` / `failed` (the old behavior's message). Before the fix
   this test fails on all three counts (worktree config import throws → F and
   G both reported + failure line).

### Step 4: Regression test — config governs both sides

1. Temp repo, commit A: a route with finding F of rule R and a
   `svelte-vitals.config.mjs` that sets R `'off'`.
2. Working tree: edit the config to remove the `'off'` (R now enabled); make
   no code change to F's file.
3. Run with `baseline: 'HEAD'`.
4. Assert F is **not** reported: under the current-config-both-sides semantics,
   R is enabled on both sides, F exists on both sides, so it is not "new".
   (Under the old behavior the baseline side would load the ref's config with R
   off, find no F at base, and wrongly report F as introduced.)

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/run-baseline.test.ts`
→ all pass, including 2 new tests; temporarily reverting Step 2 makes both fail.

### Step 5: Changeset + format

`pnpm changeset` → `svelte-vitals` **patch**. Text: `--baseline` now analyzes
the baseline ref under the current checkout's `svelte-vitals.config.*` instead
of re-loading the config inside the temporary worktree — fixes the gate
reporting every finding as new when the config imports `svelte-vitals` (the
`install` wizard's `.ts` scaffold), and makes config edits not count as
"introduced findings". Then `pnpm format`.

**Verify**: `pnpm lint` → exit 0; `pnpm test` → all pass.

## Test plan

Steps 3 and 4 above; pattern file `packages/cli/test/run-baseline.test.ts`
(real git, explicit commit identity, findings asserted by rule id/route).
Both tests must be shown to fail without the fix (Step 4's verify).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm test` exits 0; the 2 new baseline tests exist and pass
- [ ] In `applyScope`'s baseline block, the `analyzeProject` call passes a `loadedConfig` value (grep: `loadedConfig` appears in `index.ts` at both the option definition and the baseline call site)
- [ ] The `try/catch` + `finally { checkout.cleanup() }` around the baseline analysis is still present
- [ ] A changeset for `svelte-vitals` (patch) exists
- [ ] `pnpm lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `index.ts` excerpts don't match the live code (drift).
- `loadConfigFile`'s return shape can't be passed through without copying
  (e.g. it holds live handles) — report the actual shape.
- An existing test asserts that the baseline side loads the ref's config
  (would mean the old semantics were pinned deliberately — the audit found no
  such test, but if one exists, the semantic decision needs the maintainer).
- Step 3's test cannot reproduce the failure before the fix (the bug's
  mechanism assumption would be wrong — re-verify with a manual run before
  proceeding).

## Maintenance notes

- Anything else that ever calls `analyzeProject` against a checkout that is not
  the real project directory (future: `--diff` against a ref-tree, a "compare
  two refs" mode) must pass `loadedConfig` the same way; the option's JSDoc is
  the contract.
- Reviewer should scrutinize the `undefined` vs `null` handling — `undefined`
  = "load from cwd" (default), `null` = "no config, don't look"; swapping them
  silently reintroduces the bug for projects without a config file.
- Deferred (out of scope): distinguishing baseline-degradation in the exit
  code / JSON report rather than a stderr line only.
