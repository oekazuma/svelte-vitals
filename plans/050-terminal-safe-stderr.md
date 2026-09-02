# Plan 050: Route the CLI's stderr diagnostics through `terminalSafe` (close the PR #465 gap)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ddcf62d0..HEAD -- packages/core/src/index.ts packages/core/src/reporter/sanitize.ts packages/cli/src/index.ts packages/cli/test/ packages/core/test/sanitize.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — `terminalSafe` is a pure, already-tested string transform;
  the only visible change is that control bytes stop reaching the terminal.
- **Depends on**: none (Plan 052 depends on THIS plan's core export)
- **Category**: security
- **Planned at**: commit `ddcf62d0`, 2026-08-12

## Why this matters

PR #465 added `terminalSafe` to strip ANSI/OSC/C0 escape sequences from
analyzed-repo-derived strings — its own doc comment names the threat: "POSIX
file/route names can contain almost any byte, so a hostile repo can smuggle
a terminal-title rewrite, cursor move, or other escape-sequence trick into
what looks like plain report text." But it was wired only into the console
**reporter**. The CLI's stderr diagnostics channel interpolates the same
class of strings — skipped-file paths, failed-rule exception text (added by
PR #464, the newest and widest path), detected app directory names,
`ProjectError` messages — and prints them raw. On `--reporter json`/`sarif`
runs, stderr is the only human-visible channel, so the mitigation currently
misses the one place a human is guaranteed to look. Two independent audit
passes (security and correctness) converged on this finding.

## Current state

- `packages/core/src/reporter/sanitize.ts:55-60` — the function (exists,
  tested in `packages/core/test/sanitize.test.ts`, **not exported from
  core's public index**):

  ```ts
  export function terminalSafe(text: string): string {
    return text
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '') // OSC ... (BEL | ST)
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '') // CSI ... final byte
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  }
  ```

- `packages/core/src/index.ts` — the public barrel; `grep -n terminalSafe`
  returns nothing today. Reporter exports live around lines 153-165.
- `packages/cli/src/index.ts:478` — `run()`'s errorLog binding:

  ```ts
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));
  ```

- `packages/cli/src/index.ts:387` — `applyScope()` has an identical binding.
- The raw interpolation sites that all route through those two bindings
  (do NOT wrap each individually — wrap the binding):
  - `packages/cli/src/index.ts:567` — `for (const w of analysis.warnings)
errorLog(\`svelte-vitals: ${w}\`)`; `analysis.warnings`includes`skippedFileWarnings`(raw analyzed-repo file paths, built at`index.ts:253-262`) and `failedRuleWarnings`(raw exception first
lines,`index.ts:270-271`).
  - `index.ts:529` / `:545-546` — detected/multiple SvelteKit app directory
    names.
  - `index.ts:557,561,690` — `err.message` interpolations
    (`ProjectError`/config-load, which quote repo paths and config content).
- Convention: comments state constraints only.

## Commands you will need

| Purpose   | Command              | Expected on success |
| --------- | -------------------- | ------------------- |
| Install   | `pnpm install`       | exit 0              |
| Build     | `pnpm build`         | exit 0              |
| Typecheck | `pnpm typecheck`     | exit 0              |
| Tests     | `pnpm test`          | all pass            |
| Lint      | `pnpm lint`          | exit 0              |
| Publish   | `pnpm check:publish` | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `packages/core/src/index.ts` — add the `terminalSafe` re-export
- `packages/cli/src/index.ts` — wrap the two errorLog bindings
- `packages/cli/test/` — one new test (or extend an existing run() test
  file)
- `.changeset/<new>.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `packages/vite/src/**` — the plugin's `console.warn` sites get the same
  treatment in **Plan 052**, which rewrites those lines anyway. Touching
  them here creates a merge conflict between independent executors.
- `packages/core/src/reporter/console.ts` — already sanitized by PR #465.
- `packages/core/src/reporter/sanitize.ts` — the function itself is
  correct; do not modify it.
- `analyzeProject`'s returned `warnings` array — embedders get raw strings
  by contract; sanitization happens at the CLI's output boundary only.

## Git workflow

- Branch: `advisor/050-terminal-safe-stderr`
- Conventional commits, two logical commits are fine:
  `feat(core): export terminalSafe for out-of-reporter terminal sinks` and
  `fix(cli): strip terminal escapes from stderr diagnostics`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export `terminalSafe` from core

In `packages/core/src/index.ts`, add `terminalSafe` to the existing reporter
export block (near the other `./reporter/…` exports around lines 153-165),
importing from `./reporter/sanitize.js`.

**Verify**: `pnpm build && node -e "import('./packages/core/dist/index.js').then(m=>console.log(typeof m.terminalSafe))"`
→ prints `function`.

### Step 2: Wrap the CLI's errorLog bindings

In `packages/cli/src/index.ts`, at **both** bindings (`run()` at line ~478
and `applyScope()` at line ~387), wrap the sink once so every existing and
future interpolation site inherits it:

```ts
const rawErrorLog = opts.errorLog ?? ((line: string) => console.error(line));
const errorLog = (line: string) => rawErrorLog(terminalSafe(line));
```

Import `terminalSafe` from `@svelte-vitals/core`. Add one comment at the
`run()` wrap stating the constraint (not the mechanics), e.g.:
`// Analyzed-repo strings (paths, rule exception text) reach stderr through here — same threat model as reporter/sanitize.ts.`

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Pin it with a test

Add a test (in `packages/cli/test/`, next to whichever existing file already
tests `run()`'s warning output — search for a test asserting
`skipped … file(s) that could not be parsed`) that:

1. builds a fixture project containing a `.svelte` file whose **filename**
   embeds an ESC byte (construct the name in JS, e.g.
   `'\x1b]0;pwned\x07' + '.svelte'`; if the filesystem rejects it, fall
   back to embedding `\x1b` in a config-load error message path), and which
   fails to parse;
2. runs `run()` with an injected `errorLog` capturing lines;
3. asserts the captured stderr lines contain no `\x1b` (ESC) and no C0
   bytes other than `\n`/`\t` (e.g.
   `expect(line).not.toMatch(/[\x00-\x08\x0b-\x1f\x7f]/)`), while still
   naming the file (printable part preserved).

**Verify**: `pnpm test` → all pass including the new one.

### Step 4: Changeset

Run `pnpm changeset`:

- `@svelte-vitals/core` **minor** — new public export `terminalSafe`.
- `svelte-vitals` **patch** — "stderr diagnostics (skipped files, failed
  rules, app detection, errors) now strip terminal escape sequences from
  analyzed-repo-derived strings, matching the console reporter."

**Verify**: a new `.changeset/*.md` names both packages with those bump
types.

## Test plan

- New test per Step 3: control-byte-bearing analyzed-repo string reaches
  `errorLog` sanitized; printable content preserved.
- Existing suites are the regression net: `pnpm test` (note several CLI
  tests inject `errorLog` and assert exact wording — sanitization must not
  alter any message that contains no control bytes; if a golden changes,
  your wrap altered clean strings — that's a bug in the wrap, not a
  snapshot to refresh).
- Verification: `pnpm build && pnpm typecheck && pnpm test && pnpm lint &&
pnpm check:publish` all green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node -e "import('./packages/core/dist/index.js').then(m=>console.log(typeof m.terminalSafe))"` prints `function` (after `pnpm build`)
- [ ] `grep -n 'terminalSafe' packages/cli/src/index.ts` shows the import
      and exactly two wrap sites (both bindings)
- [ ] New test exists and passes; `pnpm test` fully green with **zero**
      changed snapshots/goldens
- [ ] Changeset file exists (`@svelte-vitals/core: minor`,
      `svelte-vitals: patch`)
- [ ] `pnpm check:publish` exits 0
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The errorLog bindings at `index.ts:478`/`387` don't match the excerpt.
- Any existing test's expected stderr text changes — the wrap must be a
  no-op on clean strings; investigate rather than updating the expectation.
- You find yourself wanting to sanitize inside `analyzeProject` or inside
  individual warning builders — that widens the contract; the plan's
  boundary is the two sinks.
- The filesystem on the executor machine cannot create a control-byte
  filename AND no config-error path can carry the byte either — report
  which paths you tried.

## Maintenance notes

- Future stderr diagnostics added inside `run()`/`applyScope()` inherit
  sanitization automatically; diagnostics printed through any OTHER sink do
  not — reviewer should ask "does this new print go through errorLog?" on
  future CLI PRs.
- Plan 052 applies the same treatment to the vite plugin's `console.warn`
  boundary and depends on Step 1's export landing first.
- Deferred deliberately: the dashboard's copy-to-clipboard AI prompt
  (`packages/core/src/reporter/app-shell.ts:287-308`) concatenates the same
  strings into Markdown without `mdEscape` (audit finding 260812-SEC-02) —
  separate surface, separate fix, not this plan.
