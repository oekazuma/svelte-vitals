# Plan 049: Emit one clean candidate line per flag in shell completion (no prose fragments, real `--no-*` descriptions)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ddcf62d0..HEAD -- packages/cli/src/gunshi/complete.ts packages/cli/src/gunshi/install.ts packages/cli/src/gunshi/analyze.ts packages/cli/test/gunshi-complete.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — `forCompletion` is a completion-only projection; `--help`
  and the docs generator read the arg declarations directly and are
  untouched.
- **Depends on**: none (run `pnpm build` before tests regardless; see
  Plan 048)
- **Category**: bug
- **Planned at**: commit `ddcf62d0`, 2026-08-12

## Why this matters

Shell completion (shipped in PR #456) streams candidates in a line-oriented
protocol: one `value\tdescription` pair per line. Two bugs corrupt that
stream today, both reproduced end to end on the built binary:

1. `install`'s arg descriptions are multi-line strings. Passed through
   verbatim, every continuation line becomes its own candidate:
   `svelte-vitals complete -- install --` emits ~39 lines of which only 7
   are flags — `install --<TAB>` in bash/zsh/fish/pwsh offers ~33 prose
   fragments ("the repo root is their correct home.", …) as selectable
   completions.
2. The three `--no-*` flags show a meaningless stripped-key description
   (`--no-color	color`) instead of their real text, because gunshi's
   completion path treats a literal `no-`-prefixed key as an auto-negation.

Both are in the brand-new completion feature the docs advertise as
"generated from the same argument declarations … so completions stay in
sync". The fix site is one function.

## Current state

- `packages/cli/src/gunshi/complete.ts:25-32` — the projection every surface
  passes through before the completion plugin sees it:

  ```ts
  function forCompletion(args: Args): Args {
    const out: Record<string, ArgSchema> = {};
    for (const [key, schema] of Object.entries(args)) {
      if (schema.hidden) continue;
      out[schema.type === 'positional' || !schema.toKebab ? key : kebabnize(key)] = schema;
    }
    return out;
  }
  ```

  Note it passes `schema` through **by reference** — descriptions included.

- `packages/cli/src/gunshi/install.ts:29-79` — `INSTALL_ARGS` has 7 arg
  entries; `client`, `app`, and `refresh` have multi-line `description`
  strings (embedded `\n`); `scope` is `hidden: true` (line 70), leaving
  **6 visible flags**.
- `packages/cli/src/gunshi/analyze.ts:48-59` — documents the gunshi renderer
  quirk: an arg key literally starting with `no-` renders the stripped key
  instead of the description. `ROOT_ARGS` therefore declares
  `noSuppressions`/`noColor`/`noAnimation` as camelCase keys +
  `toKebab: true`. `forCompletion`'s `kebabnize(key)` re-creates the literal
  `no-*` key, resurrecting the quirk inside the completion plugin.
- `packages/cli/src/gunshi/complete.ts:76-103` — the
  `completion({ config: { entry: { args: … } } })` block already supplies
  per-arg extras (value lists for `--reporter`/`--fail-on` etc.); this is the
  precedent for supplying per-arg overrides to the plugin.
- Reproductions against `packages/cli/dist/bin.js` at `ddcf62d0` (rebuild
  first if dist is stale):

  ```
  $ node packages/cli/dist/bin.js complete -- install --
  --client	Comma-separated: vite-plugin,vite-hooks,claude-skill,...
  (skips the interactive picker; the picker groups these by category —
  Vite integration, Agent Skills & rules, CI, Config file)
  ...        ← ~33 prose lines, each emitted as a candidate
  $ node packages/cli/dist/bin.js complete -- --no
  --no-suppressions	suppressions
  --no-color	color
  --no-animation	animation
  ```

- Existing test file to extend: `packages/cli/test/gunshi-complete.test.ts` —
  it already exercises the candidate protocol in-process and has three
  dist-backed cases (`it.skipIf`). Model new tests on its in-process cases.
- Repo conventions: comments state constraints only (see AGENTS.md
  "Comments and docs are for the next reader"); test names state behavior.

## Commands you will need

| Purpose   | Command                                                                    | Expected on success |
| --------- | -------------------------------------------------------------------------- | ------------------- |
| Install   | `pnpm install`                                                             | exit 0              |
| Build     | `pnpm build`                                                               | exit 0              |
| Typecheck | `pnpm typecheck`                                                           | exit 0              |
| Tests     | `pnpm test` (root; builds first if Plan 048 landed)                        | all pass            |
| One file  | `pnpm --filter svelte-vitals exec vitest run test/gunshi-complete.test.ts` | all pass            |
| Lint      | `pnpm lint`                                                                | exit 0              |
| Repro     | `node packages/cli/dist/bin.js complete -- install --`                     | see Done criteria   |

## Scope

**In scope** (the only files you should modify):

- `packages/cli/src/gunshi/complete.ts`
- `packages/cli/test/gunshi-complete.test.ts`
- `.changeset/<new>.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/gunshi/install.ts` — the multi-line descriptions are
  correct for `--help`; do not flatten them at the source.
- `packages/cli/src/gunshi/analyze.ts` — the camelCase+`toKebab` workaround
  is deliberate and documented; leave `ROOT_ARGS` alone.
- The generated docs pipeline (`gen:cli-reference`) — it reads the arg
  declarations, not `forCompletion`; no regeneration is needed. If
  `packages/cli/test/cli-reference.test.mjs` fails after your change, you
  broke something out of scope — STOP.

## Git workflow

- Branch: `advisor/049-completion-candidate-stream`
- Conventional commits, e.g. `fix(cli): emit one completion candidate per
flag — collapse multi-line descriptions and restore --no-* text`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Capture the pre-change help output

Before editing anything: `pnpm build && node packages/cli/dist/bin.js install --help > /tmp/install-help-before.txt` — the last done criterion diffs against this capture.

### Step 1: Pin the bugs with failing tests

In `packages/cli/test/gunshi-complete.test.ts`, add (in-process, modeled on
the file's existing candidate-protocol cases):

1. a test asserting that for the `install` surface, every candidate's
   description contains no `\n` and every emitted candidate line starts with
   `-` or is a positional — derive the expected flag set from `INSTALL_ARGS`
   (non-hidden entries), don't hardcode the count;
2. a test asserting the three `--no-*` root flags carry their real
   descriptions (assert a distinctive substring of each, e.g. `ANSI color`
   for `--no-color`, taken from `ROOT_ARGS` at runtime rather than pasted).

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/gunshi-complete.test.ts`
→ the two new tests FAIL, everything else passes.

### Step 2: Collapse descriptions in `forCompletion`

In `forCompletion`, stop passing the schema by reference; clone it with a
single-line description:

```ts
const single = schema.description?.replace(/\s*\n\s*/g, ' ');
out[...] = single === schema.description ? schema : { ...schema, description: single };
```

(Exact shape up to you; the requirement is: completion sees no `\n` in any
description, and `--help` output is unchanged because it never goes through
`forCompletion`.)

If a full flattened description is unreasonably long for a completion menu,
`schema.description?.split('\n')[0]` (first line only) is the acceptable
alternative — pick one, and make the test from Step 1 match it.

**Verify**: the Step-1 multi-line test now passes.

### Step 3: Restore the `--no-*` descriptions

Try remedies in this order and keep the first that works empirically:

1. Supply the description through the plugin's per-arg `config` map in the
   `completion({ config: { entry: { args: … } } })` block (the same
   mechanism `complete.ts:76-103` already uses for value lists), sourcing
   the text from `ROOT_ARGS` so there is no second copy of the strings.
2. If the plugin's config map cannot carry a description, check empirically
   whether the stripping only fires when the base flag (e.g. `color`) is
   absent from the args record, and if so document and exploit that.

**Verify**: the Step-1 `--no-*` test passes, and manually:
`pnpm build && node packages/cli/dist/bin.js complete -- --no` → three lines,
each with its real description text.

### Step 4: Changeset

Run `pnpm changeset`: `svelte-vitals` **patch**. Suggested wording:
"Shell completion now emits exactly one candidate per flag: multi-line flag
descriptions no longer leak prose fragments into the candidate list, and
`--no-color`/`--no-animation`/`--no-suppressions` show their real
descriptions."

**Verify**: a new file exists in `.changeset/` naming `svelte-vitals: patch`.

## Test plan

- New tests (Step 1) in `packages/cli/test/gunshi-complete.test.ts`:
  - install surface: no `\n` in any candidate description; candidate set ==
    non-hidden `INSTALL_ARGS` flags.
  - `--no-suppressions`/`--no-color`/`--no-animation` descriptions match
    their `ROOT_ARGS` text (or its first line).
- Pattern: the existing in-process candidate tests in the same file.
- Verification: `pnpm build && pnpm test` → all pass including the new ones.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all exit 0
- [ ] `node packages/cli/dist/bin.js complete -- install -- | grep -c '^--'`
      equals the number of non-hidden `INSTALL_ARGS` flags (6 at planning
      time), and the total line count before the `:4` directive equals that
      same number
- [ ] `node packages/cli/dist/bin.js complete -- --no` shows three lines,
      none of whose descriptions is a bare stripped key (`color`,
      `animation`, `suppressions`)
- [ ] `--help` output for `install` is byte-identical to before your change
      (`node packages/cli/dist/bin.js install --help | diff /tmp/install-help-before.txt -`
      → empty; capture made in Step 0)
- [ ] Changeset file exists (`svelte-vitals: patch`)
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `forCompletion` no longer matches the excerpt above.
- Neither remedy in Step 3 restores the `--no-*` descriptions — the fix then
  needs an upstream issue against `@gunshi/plugin-completion@0.37.1` or a
  gunshi bump, both out of scope.
- Fixing the candidates requires editing `INSTALL_ARGS`/`ROOT_ARGS`
  themselves.
- The help-golden snapshots (`packages/cli/test/__snapshots__/`) change —
  your change leaked outside the completion path.

## Maintenance notes

- Any future multi-line arg description is now safe for completion
  automatically; nothing per-flag to remember.
- Reviewer: check Step 3's chosen mechanism doesn't duplicate description
  strings — they must remain sourced from the `*_ARGS` declarations.
- Deferred: the completion candidate protocol has no dist-backed e2e in
  `scripts/cli-e2e.mjs` (audit finding 260812-TEST-05 notes the dist-backed
  vitest cases self-skip when dist is missing). Out of scope here.
