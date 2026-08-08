# Plan 043: Reject flag-shaped and empty values on every CLI string flag

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9e0cf9e..HEAD -- packages/cli/src/resolve-args.ts packages/cli/src/bin.ts packages/cli/test/resolve-args.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (rejecting values nobody passes on purpose; the only behavior
  that changes is silent-wrong → loud exit 2)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e0cf9e`, 2026-08-08

## Why this matters

PR #392 migrated argument parsing from `mri` to `node:util`'s `parseArgs`
(`strict: false`). Under `parseArgs`, a declared string flag **consumes the next
token even when that token is another flag**, and `--flag=` yields the empty
string. Both were verified empirically against the real parser at commit
`9e0cf9e`:

- `svelte-vitals --route --staged x` parses as `{ route: "--staged", _: ["x"] }`
  — the run analyzes a route literally named `--staged` (matches nothing),
  reports a clean result, and exits 0. `--staged` is silently dropped.
- `svelte-vitals --min-health=` parses as `''`; `Number('') === 0`, which passes
  the range check, so the gate becomes "health ≥ 0" — a CI gate that can never
  fail. `--min-health="$THRESHOLD"` with an unset env var is the realistic way
  to hit this.
- `--meta-components=` yields `[]`, which `run()` treats as an explicit value,
  discarding the config file's `metaComponents` list — every route using a meta
  component then reports false "missing title/description" criticals.

The repo already recognizes this exact failure class and guards **one** flag:
`--baseline` rejects empty and leading-`-` values, and its comment names the
reason ("turning a misconfigured CI gate into a silent pass"). This plan extends
that stance to the other string flags, and consolidates the `--min-health`
parse into `resolveArgs` where every other flag is validated (it is the one flag
currently parsed ad hoc in `bin.ts`, with a second, differently-worded check in
`index.ts`).

Audit trail: this plan implements findings 2608-TEST-02 (flag swallowing) and
2608-CLI-06 (empty-value coercion) from the 2026-08-08 audit, and reverses the
2026-07 audit's rejection of TEST-02 (min-health duplication) — the empty-value
bug gave that duplication a live consequence.

## Current state

Files:

- `packages/cli/src/resolve-args.ts` — flag table + `resolveArgs()`, the
  no-I/O validation layer (its own JSDoc at line 153-157 states the goal:
  all validation unit-testable here, `bin.ts` only prints and exits).
- `packages/cli/src/bin.ts` — thin CLI entry; parses `--min-health` itself
  (lines 126-135).
- `packages/cli/src/cli-args.ts` — the `parseArgs` shim (`parseCliArgs`). Do
  not modify it.
- `packages/cli/test/resolve-args.test.ts` — existing tests, including the
  `--baseline` guard tests.

The flag table (`resolve-args.ts:117-151`):

```ts
export function parseRunArgs(args: string[]): CliArgv {
  // --diff takes an optional value, which parseArgs cannot express: a bare --diff
  // (next token is another flag, or nothing) gets its default ref inlined here.
  const patched = args.map((a, i) => (a === '--diff' && (args[i + 1] ?? '--').startsWith('-') ? '--diff=HEAD' : a));
  return parseCliArgs(patched, {
    boolean: [ 'by-route', 'staged', 'score', ... ],
    string: [
      'meta-components', 'treat-dynamic-as', 'route', 'fail-on', 'reporter',
      'rules', 'ignore', 'min-health', 'out-file', 'diff', 'baseline',
      'weights', 'category'
    ],
    short: { h: 'help', v: 'version' }
  });
}
```

The one existing guard (`resolve-args.ts:180-193`) — reuse its shape and its
reasoning comment style:

```ts
// --baseline: unlike --diff, no implicit default — a bare `--baseline` (parseArgs
// yields `true`) is a fatal error rather than silently defaulting to HEAD, ...
// Values starting with '-' are rejected too: git refnames cannot start with '-',
// and parseArgs would otherwise consume a following flag (`--baseline --force`)
// as the ref, turning a misconfigured CI gate into a silent pass.
let baselineRef: string | undefined;
if (argv.baseline !== undefined) {
  if (typeof argv.baseline !== 'string' || argv.baseline.trim() === '' || argv.baseline.startsWith('-')) {
    errors.push('svelte-vitals: --baseline requires a git ref (e.g. --baseline origin/main).');
  } else {
    baselineRef = argv.baseline;
  }
}
```

The ad-hoc `--min-health` parse in `bin.ts:126-135`:

```ts
const minHealthRaw = argv['min-health'];
let minHealth: number | undefined;
if (minHealthRaw !== undefined) {
  // A bare `--min-health` parses as `true` — NaN it so it errors instead of becoming 1.
  const n = typeof minHealthRaw === 'string' ? Number(minHealthRaw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    console.error(`svelte-vitals: invalid --min-health '${minHealthRaw}'; expected a number 0-100.`);
    // (exits 2)
  }
  minHealth = n;
}
```

Note `Number('') === 0` sails through this check — that is the bug.

There is a **second** range check in `packages/cli/src/index.ts:356-359`
(`run()`'s programmatic-API guard). Leave it in place — `run()` is a public API
and callers can bypass `resolveArgs` — but it is out of scope to modify.

Repo conventions: conventional commits scoped by package
(`fix(cli): ...`); comments state constraints, not narration; every
user-facing change needs a changeset (`pnpm changeset`).

## Decision table (the contract this plan implements)

| Input shape                            | Today                          | After this plan                            |
| -------------------------------------- | ------------------------------ | ------------------------------------------ |
| `--route --staged` (value = next flag) | route = `"--staged"`, silent   | exit 2, `--route requires a value.`        |
| `--reporter=` (empty)                  | empty string flows on          | exit 2                                     |
| bare `--rules` (parses as `true`)      | non-string, flows on           | exit 2                                     |
| `--min-health=`                        | becomes `0` — gate never fails | exit 2                                     |
| `--min-health` bare                    | NaN → error (bin.ts)           | exit 2 (same outcome, now via resolveArgs) |
| `--min-health=0` / `=100`              | valid                          | valid (unchanged)                          |
| `--baseline` (all bad shapes)          | exit 2 (existing guard)        | unchanged, **keep its existing message**   |
| `--diff` bare / `--diff=`              | defaults to `HEAD`             | **unchanged — exempt** (see below)         |

**`--diff` is exempt by design**: the pre-pass at `resolve-args.ts:120` rewrites
a bare `--diff` to `--diff=HEAD`, and `|| 'HEAD'` at line 177 catches an
explicit `--diff=`. Optional-valued is its documented contract. Do not add the
guard to it.

No current flag has a legitimate leading-dash value (rule ids, categories,
reporters, refs, paths as used here never start with `-`). If one ever appears,
allow-list that flag instead of weakening the guard.

## Commands you will need

| Purpose   | Command                            | Expected on success                    |
| --------- | ---------------------------------- | -------------------------------------- |
| Install   | `pnpm install`                     | exit 0                                 |
| Build     | `pnpm build`                       | exit 0                                 |
| Typecheck | `pnpm -r typecheck`                | exit 0                                 |
| CLI tests | `pnpm --filter svelte-vitals test` | all pass                               |
| All tests | `pnpm test`                        | all pass                               |
| Lint      | `pnpm lint`                        | exit 0                                 |
| Format    | `pnpm format`                      | rewrites files (run before committing) |

## Scope

**In scope** (the only files you should modify):

- `packages/cli/src/resolve-args.ts`
- `packages/cli/src/bin.ts` (delete the local `--min-health` parse, consume
  the value from `resolveArgs` instead)
- `packages/cli/test/resolve-args.test.ts`
- `packages/cli/test/cli.test.ts` / `packages/cli/test/run.test.ts` — only if
  an existing assertion references the old `bin.ts` message string
- `.changeset/<new>.md`

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/cli-args.ts` — the parseArgs shim's semantics are shared by
  other subcommands; changing it moves the fix away from the analysis flag
  table and risks the `install`/`ci`/`docs` parsers.
- `packages/cli/src/index.ts` — `run()`'s own `minHealth` range check stays as
  the programmatic-API guard.
- The `--diff` pre-pass and its default (`resolve-args.ts:118-120,175-177`).

## Git workflow

- Branch: `advisor/043-string-flag-value-guard`
- Commit style: `fix(cli): reject flag-shaped and empty values on string flags`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the shared guard in `resolveArgs`

In `resolve-args.ts`, near the top of `resolveArgs()`, add a guard over every
string flag except `diff` and `baseline` (baseline keeps its existing, more
specific message and assignment logic — do not duplicate its error):

```ts
// parseArgs (strict:false) lets a declared string flag consume a following
// flag token (`--route --staged` → route '--staged') and lets `--flag=` pass
// an empty string; either silently un-gates a CI run. Same stance as the
// --baseline guard below, applied to every value-carrying flag. --diff is
// exempt: bare/empty --diff deliberately defaults to HEAD (see parseRunArgs).
const VALUE_FLAGS = [
  'meta-components',
  'treat-dynamic-as',
  'route',
  'fail-on',
  'reporter',
  'rules',
  'ignore',
  'min-health',
  'out-file',
  'weights',
  'category'
] as const;
for (const flag of VALUE_FLAGS) {
  const v = argv[flag];
  if (v !== undefined && (typeof v !== 'string' || v.trim() === '' || v.startsWith('-'))) {
    errors.push(`svelte-vitals: --${flag} requires a value.`);
  }
}
```

Place it **before** the per-flag handling so downstream code can assume a
guarded flag is either absent or a usable string. The existing per-flag logic
(e.g. the `treat-dynamic-as` unknown-value warning) stays — the guard only
covers missing/flag-shaped/empty, not enum validity.

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/resolve-args.test.ts`
→ existing tests still pass (the `--baseline` tests must be untouched).

### Step 2: Move the `--min-health` parse into `resolveArgs`

- In `resolve-args.ts`: after the Step 1 guard, parse
  `--min-health` (`Number(argv['min-health'])`, must be finite and 0–100
  inclusive; otherwise push
  `svelte-vitals: invalid --min-health '<raw>'; expected a number 0-100.`).
  Expose the parsed value as `minHealth?: number` on the returned
  `ResolvedArgs` object (extend the interface).
- In `bin.ts`: delete lines 126-135 (the local parse) and pass
  `resolved.minHealth` where `minHealth` was passed before. The bare-flag case
  (`--min-health` → `true`) is already rejected by the Step 1 guard, preserving
  the old NaN behavior's outcome (exit 2) with a clearer message.

**Verify**: `pnpm --filter svelte-vitals test` → all pass;
`node packages/cli/dist/bin.js --min-health= 2>&1; echo $?` after `pnpm build`
→ prints the `requires a value` error and exits 2.

### Step 3: Tests

See "Test plan". Add them, run the full suite.

**Verify**: `pnpm --filter svelte-vitals test` → all pass, including the new
table test.

### Step 4: Changeset + format

- `pnpm changeset` → `svelte-vitals` **patch**. Text (user-facing, English):
  string flags now reject empty and flag-shaped values instead of silently
  consuming them; `--min-health=` / a bare `--min-health` now exit 2 instead of
  gating at 0.
- `pnpm format` before the final commit.

**Verify**: `pnpm lint` → exit 0.

## Test plan

In `packages/cli/test/resolve-args.test.ts`, following the file's existing
structure (plain `describe`/`it` over `resolveArgs(parseRunArgs([...]))`):

1. **Table test over all 11 guarded flags**: for each `flag` in the
   `VALUE_FLAGS` list, `parseRunArgs(['--' + flag, '--staged'])` →
   `resolveArgs` result has an error containing `--${flag} requires a value`
   (loop, not 11 copy-pasted cases).
2. Empty-value shapes: `['--min-health=']`, `['--reporter=']`,
   `['--meta-components=']` → fatal error each.
3. `--min-health` value shapes: `=abc` → error; `=150` → error; `=-1` → error;
   `=0` → ok, `minHealth === 0`; `=100` → ok; `=85` → ok.
4. `--diff` exemption pinned: `['--diff']` and `['--diff', '--staged']` →
   no error, `diffBase === 'HEAD'` (this may already be pinned — if so, leave
   the existing test).
5. `--baseline` message unchanged: existing tests must pass unmodified.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm test` exits 0; the new table test exists and passes
- [ ] After `pnpm build`: `node packages/cli/dist/bin.js --route --staged; echo $?` prints a `--route requires a value` error and `2`
- [ ] After `pnpm build`: `node packages/cli/dist/bin.js --diff --reporter json` does NOT error on `--diff` (it may fail later for unrelated reasons, e.g. not a SvelteKit project — that exit is 2 with a different message; the point is no `--diff requires a value` error)
- [ ] `grep -n "min-health" packages/cli/src/bin.ts` shows no parsing logic (help text mentions are fine)
- [ ] A changeset file exists for `svelte-vitals` (patch)
- [ ] `pnpm lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `resolve-args.ts` excerpts above don't match the live code (drift).
- Any existing test asserts that a string flag ACCEPTS a leading-dash or empty
  value (that would mean the behavior is depended on somewhere — report, don't
  break it).
- Fixing a failing test seems to require modifying `cli-args.ts` or
  `index.ts` — both are out of scope.
- The `--diff` exemption can't be expressed without weakening the guard for
  other flags.

## Maintenance notes

- Any **new** string flag added to `parseRunArgs` must also be added to
  `VALUE_FLAGS` (or documented as optional-valued like `--diff`). A reviewer
  should check this pairing whenever the flag table changes.
- `run()`'s duplicate `minHealth` range check in `index.ts` is deliberate
  (programmatic API guard). A follow-up could share the message string via a
  constant; not done here to keep the diff minimal.
- This closes the previous audit's TEST-02 (min-health duplication) as far as
  the CLI path goes: `bin.ts` no longer parses it at all.
