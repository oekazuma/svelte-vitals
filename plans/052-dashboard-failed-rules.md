# Plan 052: Stop the dev dashboard scoring crashed rules as clean (finish PR #464 on the third path)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Branch setup (run first)**: this plan builds on Plan 050's branch. In
> your worktree, run `git merge advisor/050-terminal-safe-stderr` (local
> branch, shared refs — this fast-forwards you onto commit `3edb4ffc`,
> which includes the `terminalSafe` core export Step 5 needs). Then run the
> drift check: `git diff --stat 3edb4ffc..HEAD -- packages/vite/src packages/core/src/config-apply.ts packages/core/src/index.ts packages/cli/src/index.ts packages/vite/test/`
> If any in-scope file changed beyond that commit, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches the ingest payload shape (plugin ↔ dashboard are
  the same package version, but the middleware must stay tolerant of
  payloads without the new field).
- **Depends on**: plans/050-terminal-safe-stderr.md (DONE — its branch
  `advisor/050-terminal-safe-stderr` is this plan's base; see Branch setup)
- **Category**: bug
- **Planned at**: main `f4b33ba9` + branch `advisor/050-terminal-safe-stderr`
  (`3edb4ffc`), 2026-08-12 (originally drafted at `ddcf62d0`; Current state
  refreshed for the upstream dedup refactor PR #469)

## Why this matters

PR #464 made a crashed rule count as "did not run" instead of "ran clean":
the CLI and the vite **build** path both apply `withFailedRulesOff(config,
failedIds)` before scoring, because — quoting
`packages/core/src/config-apply.ts:22-27` — leaving it in the inventory
"would score it as if it had run clean, silently inflating Health". The
**dev dashboard**, the most-watched surface, got neither half: the
whole-project analysis runner discards everything but `results`, the live
per-route ingest never forwards `failedRules`, and the middleware builds
every report/score from the plugin's own unadjusted `config`. A crashed
rule therefore silently inflates the dashboard's Health score, and the CLI
and dashboard disagree on the same project. Bonus debt: the
"rule … failed and was skipped" message is now copy-pasted in three places
and the third copy already diverged (it drops the first-line cap, so a
multi-line stack trace can flood the terminal).

## Current state

- `packages/core/src/config-apply.ts` — exports `withFailedRulesOff`
  (already public via core's index; `packages/cli/src/index.ts:21` and
  `packages/vite/src/analyze.ts:7` import it).
- The two already-fixed paths (pattern to replicate):
  - `packages/cli/src/index.ts:270-271` (message builder) and `:339-341`
    (scoring config) — note the message cap:

    ```ts
    function failedRuleWarnings(failedRules: { id: string; message: string }[]): string[] {
      return failedRules.map((f) => `rule ${f.id} failed and was skipped: ${f.message.split('\n')[0]}`);
    }
    ```

  - `packages/vite/src/analyze.ts:121-128` — inline copy of the same string
    plus:

    ```ts
    const scoringConfig = withFailedRulesOff(
      config,
      failedRules.map((f) => f.id)
    );
    ```

- The broken path, three files:
  - `packages/vite/src/hooks/handle.ts:85-98` — dev-mode SSR analysis:
    destructures `failedRules` from `runRules`, but only debug-logs it
    (`SVELTE_VITALS_DEBUG`), **without** the first-line cap, and never
    forwards it:

    ```ts
    const { results: ruleResults, failedRules } = await runRules(rules, {...});
    ...
    if (failedRules.length > 0 && globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
      for (const f of failedRules) console.warn(`[svelte-vitals] rule ${f.id} failed and was skipped: ${f.message}`);
    }
    ```

    The POST happens at `handle.ts:106`:
    `if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results);`
  - `packages/vite/src/ui/analysis.ts` — the whole-project runner. Since
    the upstream dedup refactor (PR #469) it imports `analyzeProject`
    **statically** and binds it as the default:

    ```ts
    import { analyzeProject, type ParseCache } from 'svelte-vitals';
    ...
    const analyze = opts.analyze ?? analyzeProject;
    ...
    async function runOnce(): Promise<void> {
      ...
      const { results } = await analyze({
        cwd: opts.root, treatDynamicAs: ..., metaComponents: ...,
        rules: ..., failOn: ..., parseCache
      });
      if (!stopped) opts.onResults(results);
    ```

    It keeps only `{ results }`; its `AnalyzeFn` type (top of file) returns
    `Promise<{ results: Result[] }>`. `analyzeProject` ALREADY returns the
    failure-adjusted config (see `packages/cli/src/index.ts` — the
    `withFailedRulesOff` call and the returned `config`) — the runner just
    drops it. There is no `getAnalyze()` helper any more; do not reintroduce
    one.
  - `packages/vite/src/ui/middleware.ts:104-116` (ingest: validates with
    `isResultLike`, calls `store.set(route, results.filter(isResultLike))`)
    and `:138`/`:151` — `buildSnapshot(store, config, { version,
    coreVersion })` with the **unadjusted** plugin config;
    `packages/vite/src/ui/snapshot.ts:36` feeds it straight into
    `buildJsonReport`.
  - `packages/vite/src/ui/store.ts` — `FindingsStore` interface (`set`,
    `setStatic`, `setAnalyzing`, `snapshot`, `badges`, `sequence`,
    `subscribe`); no notion of failed rules.
- Ingest payload compatibility: the POST body is currently
  `{ route, results }`; the middleware ignores malformed payloads
  ("dev tooling must not crash the dev server", `middleware.ts:116`). The
  new field must be optional and defensively validated the same way.

## Commands you will need

| Purpose    | Command                                             | Expected on success |
|------------|-----------------------------------------------------|---------------------|
| Install    | `pnpm install`                                      | exit 0              |
| Build      | `pnpm build`                                        | exit 0              |
| Typecheck  | `pnpm typecheck`                                    | exit 0              |
| Tests      | `pnpm test`                                         | all pass            |
| Vite only  | `pnpm --filter @svelte-vitals/vite test`            | all pass            |
| Lint       | `pnpm lint`                                         | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `packages/core/src/config-apply.ts` (or a sibling core module) — add
  `formatFailedRuleWarning`
- `packages/core/src/index.ts` — export it
- `packages/cli/src/index.ts` — replace the local `failedRuleWarnings`
  body with the shared formatter
- `packages/vite/src/analyze.ts` — use the shared formatter
- `packages/vite/src/hooks/handle.ts` — shared formatter + forward failed
  ids in the ingest POST
- `packages/vite/src/ui/analysis.ts`, `store.ts`, `middleware.ts`,
  `snapshot.ts` — thread failed-rule ids into scoring
- `packages/vite/test/` and `packages/core/test/` — new/updated tests
- `.changeset/<new>.md` (create)

**Out of scope** (do NOT touch, even though they look related):
- Rendering failed-rule ids in the dashboard UI
  (`packages/core/src/reporter/app-shell.ts`) — deferred follow-up; this
  plan fixes the **score**, not the display.
- `packages/core/src/engine.ts` (`runRules`) — the isolation mechanism is
  correct; only its consumers change.
- The CLI's scoring wiring (`index.ts:339-348`) beyond swapping the message
  builder.

## Git workflow

- Branch: `advisor/052-dashboard-failed-rules`
- Conventional commits, e.g. `fix(vite): score crashed rules as not-run on
  the dev dashboard, matching CLI and build mode`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Shared warning formatter in core

Add to `packages/core/src/config-apply.ts` (next to `withFailedRulesOff`,
so the pair travels together):

```ts
/** One-line "rule failed and was skipped" warning; capped to the message's first line so a stack trace can't flood a terminal. */
export function formatFailedRuleWarning(f: { id: string; message: string }): string {
  return `rule ${f.id} failed and was skipped: ${f.message.split('\n')[0]}`;
}
```

Export it from `packages/core/src/index.ts` beside `withFailedRulesOff`.
Then replace the three copies:
- `packages/cli/src/index.ts:270-271` — `failedRuleWarnings` maps over the
  shared formatter.
- `packages/vite/src/analyze.ts:121` — the inline loop uses it.
- `packages/vite/src/hooks/handle.ts:97` — the debug warn uses it (this
  also fixes the missing first-line cap).

**Verify**: `pnpm build && pnpm typecheck` → exit 0;
`grep -rn "failed and was skipped" packages/cli/src packages/vite/src packages/core/src` → the template string literal appears **only** in core.

### Step 2: Thread static-layer failed rules through the runner

In `packages/vite/src/ui/analysis.ts`:
- Widen `AnalyzeFn`'s return type to
  `Promise<{ results: Result[]; config?: Config }>` where `config` is the
  failure-adjusted config. (`analyzeProject` already returns `config` with
  failed rules set to `'off'` — see `packages/cli/src/index.ts:344-346` —
  so no new data needs computing, only threading.)
- In `runOnce()`, capture `const { results, config } = await analyze({...})`
  and change `opts.onResults(results)` to
  `opts.onResults(results, config)` (second param optional).
- In the plugin's runner wiring (find the `createAnalysisRunner({ ...,
  onResults })` call site in `packages/vite/src/plugin.ts` around line
  ~263-290), store the received adjusted config in a closure variable the
  middleware can read (see Step 4).

**Verify**: `pnpm typecheck` → exit 0 (the injectable-`analyze` test
doubles in `packages/vite/test/` may need their return values extended —
optional param means most should compile unchanged).

### Step 3: Thread live-layer failed rules through ingest

- `packages/vite/src/hooks/handle.ts`: change `postIngest(origin, route,
  results)` to also send `failedRuleIds: failedRules.map((f) => f.id)` in
  the POST body (adjust `postIngest`'s signature in the same file).
- `packages/vite/src/ui/middleware.ts:104-116`: read the optional
  `failedRuleIds` field; validate it is an array of strings (filter
  non-strings, same defensive posture as `isResultLike`); pass it to the
  store: `store.set(route, results.filter(isResultLike), failedIds)`.
- `packages/vite/src/ui/store.ts`: extend `FindingsStore`:
  - `set(route, results, failedRuleIds?: string[])` — replace that route's
    live-layer failed set (an omitted/empty array clears it, so a route
    re-analyzed with no failures recovers);
  - `failedRuleIds(): string[]` — union across routes.

  The static layer does NOT go through the store: the plugin's
  `onResults(results, config)` handler (Step 2) keeps the adjusted config
  in a closure variable and hands it to the middleware, which combines it
  with the store's live-layer union in Step 4. `setStatic` keeps its
  current signature.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Apply `withFailedRulesOff` where the snapshot is built

In `packages/vite/src/ui/middleware.ts` (both `buildSnapshot` call sites,
lines ~138 and ~151) or inside `buildSnapshot` itself
(`packages/vite/src/ui/snapshot.ts:27-40` — preferred, single site):
compute the scoring config before `buildJsonReport`:

```ts
const scoringConfig = withFailedRulesOff(staticAdjustedConfig ?? config, store.failedRuleIds());
```

where `staticAdjustedConfig` is the closure variable from Step 2 (undefined
until the first whole-project run completes) and `store.failedRuleIds()` is
the live-layer union from Step 3.

**Verify**: `pnpm --filter @svelte-vitals/vite test` → existing dashboard
tests pass unchanged (no rule fails in their fixtures, so scores must not
move — if any score assertion changes, your threading altered the
no-failure path: STOP).

### Step 5: Sanitize the vite warn boundary (needs Plan 050's export)

Wrap the plugin's terminal sinks with `terminalSafe` (imported from
`@svelte-vitals/core`), at the boundary, not per interpolation:
- `packages/vite/src/plugin.ts` — the `console.warn(`svelte-vitals: ${w}`)`
  loops (~line 232 build path, ~line 280 dev path) and the
  `skipped — analysis failed: ${err…}` warn (~line 229).
- `packages/vite/src/hooks/handle.ts` — the two debug `console.warn`
  sites.

Smallest shape: a local `const warn = (line: string) =>
console.warn(terminalSafe(line));` per file, used by those sites.

**Verify**: `pnpm typecheck` → exit 0; `pnpm --filter @svelte-vitals/vite test` green.

### Step 6: Tests

In `packages/vite/test/` (model on the existing dashboard/store tests —
find the file that already tests `composeSnapshot`/`buildSnapshot` and the
one that drives the middleware with a mock server):

1. **Live path**: ingest a payload with `failedRuleIds: ['seo/some-rule']`
   → `buildSnapshot(...)`'s report scores that rule as not-run (assert via
   the report's rules/score against a control snapshot without the field —
   the two must differ, and the failed variant must match what
   `withFailedRulesOff` produces).
2. **Static path**: injectable `analyze` returns an adjusted config with
   one rule `'off'` → snapshot score reflects it.
3. **Tolerance**: ingest payload with `failedRuleIds: 'nonsense'` (not an
   array) and one with the field absent → no crash, treated as no failures.
4. **Formatter**: one core test in `packages/core/test/` pinning
   `formatFailedRuleWarning({ id: 'x', message: 'boom\nstack' })` →
   `'rule x failed and was skipped: boom'`.

**Verify**: `pnpm test` → all pass including the new ones.

### Step 7: Changeset

Run `pnpm changeset`:
- `@svelte-vitals/core` **minor** — new export `formatFailedRuleWarning`.
- `@svelte-vitals/vite` **patch** — "the dev dashboard now scores a crashed
  rule as not-run (matching the CLI and build mode) instead of silently
  inflating Health; plugin warnings strip terminal escape sequences."

**Verify**: a new `.changeset/*.md` names both packages.

## Test plan

See Step 6. Regression net: the full vite suite — especially the SSE/
staleness and whole-project dashboard integration tests — must pass with
zero score changes on fixtures without failing rules.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all exit 0
- [ ] `grep -rn "failed and was skipped" packages/cli/src packages/vite/src`
      shows only imports/uses of `formatFailedRuleWarning`, no string
      literals
- [ ] New tests from Step 6 exist and pass
- [ ] `grep -n 'withFailedRulesOff' packages/vite/src/ui/snapshot.ts packages/vite/src/ui/middleware.ts`
      shows at least one call on the snapshot path
- [ ] Changeset file exists (`@svelte-vitals/core: minor`,
      `@svelte-vitals/vite: patch`)
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 050 has not landed and you have reached Step 5 (`terminalSafe` not
  exported from core) — deliver Steps 1-4+6-7 and report.
- Any existing vite test's score assertion changes — the no-failure path
  must be bit-identical.
- The store extension forces a change to `composeSnapshot`'s merge
  semantics — that function is design-doc-governed
  (2026-07-08-dev-dashboard-whole-project-design.md §2); report instead of
  altering it.
- `analyzeProject`'s return shape at `packages/cli/src/index.ts:339-348`
  does not include the failure-adjusted `config` — the Current state is
  wrong and the static-layer half needs a different source.

## Maintenance notes

- Plugin and dashboard ship in one package, but third-party POSTs to
  `/ingest` exist in tests — the optional-field tolerance (Step 3) is a
  contract; a future required field needs a payload version.
- Follow-up deliberately deferred: surface the failed-rule ids in the
  dashboard UI (warnings strip) so the score correction is visible, and
  audit finding 260812-INV-04 (CLI JSON report's `ruleIds`/`examined` still
  list failure-disabled rules) — both are display/reporting consistency,
  not score bugs.
- Reviewer: scrutinize Step 3's chosen storage mechanism for the union —
  the simplest correct shape wins; per-route replacement must clear a
  recovered route's entry.
