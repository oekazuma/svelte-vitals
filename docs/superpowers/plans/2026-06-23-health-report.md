# Combined Health Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single weighted **Health** score (equal default weights across the present categories) surfaced as the JSON top-level `score`, a console/agent headline, and the MCP `analyze` output, plus an optional `--min-health` CI gate.

**Architecture:** A new `computeHealth(results, config)` in core averages the existing `scoresByCategory` output by configurable weights (default equal). `buildJsonReport` exposes it as the top-level `score` (replacing the old SEO-only score) with a `weights` field; console/agent print a Health headline; the CLI's `run()` adds a `--min-health` gate on top of the unchanged severity-based exit. MCP gets it for free (it returns `buildJsonReport`).

**Tech Stack:** TypeScript (ESM-only), `vitest`, `tsup`, pnpm workspaces.

## Global Constraints

- **ESM-only**, `tsup` `format: ['esm']`, `target: 'es2022'`; never add CJS.
- **core stays runtime-agnostic** (no `node:` imports / no I/O in `@svelte-vitals/core`).
- **Default weights are equal** (each present category weight `1`); effective weight `config.weights?.[cat] ?? 1`. No `--weights` CLI flag in this increment.
- **Health over present categories only**: `scoresByCategory` returns only categories with findings/seeds; a suppressed/absent category is excluded and weights re-normalize. No present categories → Health `100`.
- **Exit codes stay severity-based** (`hasFailureAtOrAbove`); `--min-health` adds an _additional_ gate, off unless set.
- **JSON top-level `score` = Health** (was SEO) and top-level `scoreModel` is **removed** — a deliberate breaking change for `1.0`; per-category data stays in `categories`.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `Config.weights` + `computeHealth`

**Files:**

- Modify: `packages/core/src/types.ts` (add `weights?` to `Config`)
- Modify: `packages/core/src/scoring/score.ts` (add `HealthResult` + `computeHealth`)
- Modify: `packages/core/src/index.ts` (export `computeHealth`, `HealthResult`)
- Test: `packages/core/test/health.test.ts` (new)

**Interfaces:**

- Consumes: `scoresByCategory`, `ScoreResult`, `Category`, `Config`, `Result` (all existing in core).
- Produces:
  - `Config.weights?: Partial<Record<Category, number>>`
  - `interface HealthResult { health: number; categories: Partial<Record<Category, ScoreResult>>; weights: Partial<Record<Category, number>> }`
  - `function computeHealth(results: Result[], config: Config): HealthResult`

- [ ] **Step 1: Write the failing test** — `packages/core/test/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeHealth, defineConfig, type Result } from '../src/index.js';

const seoFail = (route: string): Result => ({
  id: 'SEO001',
  category: 'seo',
  severity: 'critical',
  detection: { presence: 'none', value: 'absent' },
  route,
  message: 'Missing <title>'
});
const pass = (id: string, category: Result['category'], route: string): Result => ({
  id,
  category,
  severity: 'warning',
  detection: { presence: 'own', value: 'static' },
  route,
  message: 'ok'
});

describe('computeHealth', () => {
  it('averages present category scores with equal default weights', () => {
    // SEO: one route, critical missing → low; performance + a11y: clean seeds → 100.
    const results = [seoFail('/a'), pass('performance', 'performance', '/a'), pass('a11y', 'a11y', '/a')];
    const { health, categories, weights } = computeHealth(results, defineConfig({}));
    expect(categories.seo).toBeDefined();
    expect(categories.performance!.score).toBe(100);
    expect(categories.a11y!.score).toBe(100);
    // equal weights → mean of the three category scores
    const mean = Math.round((categories.seo!.score + 100 + 100) / 3);
    expect(health).toBe(mean);
    expect(weights).toEqual({ seo: 1, performance: 1, a11y: 1 });
  });

  it('honors Config.weights overrides', () => {
    const results = [seoFail('/a'), pass('performance', 'performance', '/a')];
    const equal = computeHealth(results, defineConfig({})).health;
    const seoHeavy = computeHealth(results, defineConfig({ weights: { seo: 3, performance: 1 } })).health;
    // weighting the low SEO score more heavily pulls Health below the equal-weight mean
    expect(seoHeavy).toBeLessThan(equal);
  });

  it('excludes absent categories and re-normalizes (only SEO present)', () => {
    const results = [pass('SEO001', 'seo', '/a')];
    const { health, categories, weights } = computeHealth(results, defineConfig({}));
    expect(Object.keys(categories)).toEqual(['seo']);
    expect(weights).toEqual({ seo: 1 });
    expect(health).toBe(100);
  });

  it('returns 100 when there are no results', () => {
    expect(computeHealth([], defineConfig({})).health).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- health`
Expected: FAIL — `computeHealth` is not a function.

- [ ] **Step 3: Add `weights` to `Config`** in `packages/core/src/types.ts` — add the optional field to the interface (after `failOn`):

```ts
export interface Config {
  treatDynamicAs: TreatDynamicAs;
  /** Component names treated as meta sources of unknown content (design §11 layer 4). */
  metaComponents: string[];
  /** Per-rule overrides keyed by rule id (design §6). */
  rules: Record<string, RuleSetting>;
  /** Minimum severity that fails the run / CI (design §6). */
  failOn: Severity;
  /** Per-category weights for the combined Health score (default: equal, 1 each) (#10). */
  weights?: Partial<Record<Category, number>>;
}
```

> `defaultConfig` leaves `weights` unset (it's optional → equal). `defineConfig` already spreads a `Partial<Config>`, so `defineConfig({ weights })` works with no change.

- [ ] **Step 4: Add `computeHealth`** in `packages/core/src/scoring/score.ts` — append after `scoresByCategory`:

```ts
export interface HealthResult {
  /** Weighted overall score across present categories (0–100). */
  health: number;
  categories: Partial<Record<Category, ScoreResult>>;
  /** Effective weight used per present category. */
  weights: Partial<Record<Category, number>>;
}

/** Combined weighted Health score over the categories present in `results` (#10). */
export function computeHealth(results: Result[], config: Config): HealthResult {
  const categories = scoresByCategory(results, config);
  const weights: Partial<Record<Category, number>> = {};
  let weighted = 0;
  let total = 0;
  for (const cat of Object.keys(categories) as Category[]) {
    const w = config.weights?.[cat] ?? 1;
    weights[cat] = w;
    weighted += categories[cat]!.score * w;
    total += w;
  }
  const health = total > 0 ? Math.round(weighted / total) : 100;
  return { health, categories, weights };
}
```

> `score.ts` already imports `Category, Config, Result, Severity` and defines `ScoreResult`; no new imports needed.

- [ ] **Step 5: Export** from `packages/core/src/index.ts` — extend the scoring export line:

```ts
export { computeScore, scoresByCategory, computeHealth } from './scoring/score.js';
export type { ScoreModel, ScoreResult, ScoreOptions, HealthResult } from './scoring/score.js';
```

> Check the existing scoring export lines in `index.ts` and merge these names in (don't duplicate the line). `ScoreModel`/`ScoreResult`/`ScoreOptions` are already exported there — add `HealthResult` to the type export and `computeHealth` to the value export.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test -- health` then `pnpm --filter @svelte-vitals/core test` and `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS (new health tests + all existing unchanged — `Config.weights` is additive/optional).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/scoring/score.ts packages/core/src/index.ts packages/core/test/health.test.ts
git commit -m "feat(core): add Config.weights and computeHealth (#10)"
```

---

### Task 2: JSON report — top-level `score` = Health, add `weights`, drop `scoreModel`

**Files:**

- Modify: `packages/core/src/reporter/json.ts`
- Test: `packages/core/test/json-report.test.ts` (update existing)

**Interfaces:**

- Consumes: `computeHealth` (Task 1), existing `computeScore`, `scoresByCategory`, `Category`.
- Produces: `JsonReport` with `score: number` (= Health), `weights: Partial<Record<Category, number>>`, no top-level `scoreModel`; `categories` unchanged.

- [ ] **Step 1: Read** `packages/core/test/json-report.test.ts` to see which assertions reference top-level `score`/`scoreModel`.

- [ ] **Step 2: Update the test** — change top-level expectations to Health + `weights`, and move the `scoreModel` shape assertion into `categories.seo`:

```ts
it('emits the documented shape with only penalized findings', () => {
  const json = JSON.parse(formatJsonReport(results, config, { version: '0.1.0' }));
  expect(json.version).toBe('0.1.0');
  expect(typeof json.score).toBe('number'); // score is now the combined Health
  expect(json.weights).toBeDefined();
  expect(json.scoreModel).toBeUndefined(); // top-level scoreModel removed
  expect(json.categories.seo.scoreModel).toHaveProperty('routeAverage');
  expect(json.summary.critical).toBe(1);
  const routeA = json.routes.find((r: { route: string }) => r.route === '/a');
  expect(routeA.issues).toHaveLength(1);
  expect(routeA.issues[0].id).toBe('SEO002');
  expect(routeA.issues[0].detection).toEqual({ presence: 'none', value: 'absent' });
  expect(routeA.issues[0].docsUrl).toBe('https://svelte-vitals.dev/rules/SEO002');
  expect(json.siteIssues).toHaveLength(1);
  expect(json.siteIssues[0].id).toBe('SEO006');
});

it('top-level score equals the combined Health', () => {
  const report = buildJsonReport(results, config, { version: '9.9.9' });
  expect(report.score).toBe(computeHealth(results, config).health);
  expect(report.weights).toEqual(computeHealth(results, config).weights);
});
```

> Add `computeHealth` to the imports of this test file: `import { buildJsonReport, formatJsonReport, computeHealth, defineConfig, type Result } from '../src/index.js';`. Keep the existing `buildJsonReport returns the object formatJsonReport stringifies` test — it still holds.

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test -- json-report`
Expected: FAIL — `json.scoreModel` still present / `json.weights` undefined / `json.score` is the SEO score not Health.

- [ ] **Step 4: Update `buildJsonReport`** in `packages/core/src/reporter/json.ts`.

Update imports (add `computeHealth`, keep `computeScore`; add `Category` type; `ScoreModel` still used by `categories`):

```ts
import type { Category, Config, Result } from '../types.js';
import { computeScore, scoresByCategory, computeHealth, type ScoreModel } from '../scoring/score.js';
import { summarize, effectiveSeverity, type Summary } from '../summary.js';
import { isPenalized } from '../rule.js';
```

Update the `JsonReport` interface — replace `scoreModel` with `weights`:

```ts
export interface JsonReport {
  version: string;
  score: number; // combined Health score
  weights: Partial<Record<Category, number>>;
  categories: Record<string, { score: number; scoreModel: ScoreModel }>;
  summary: Summary;
  routes: Array<{ route: string; score: number; issues: JsonIssue[] }>;
  siteIssues: JsonIssue[];
}
```

In `buildJsonReport`, replace the SEO-subset score block with the Health computation (keep everything else — `categories`, `routes`, `siteIssues`, `summary` — as is):

```ts
export function buildJsonReport(results: Result[], config: Config, meta: { version: string }): JsonReport {
  const { health, categories: byCat, weights } = computeHealth(results, config);
  const summary = summarize(results, config);

  const categories = Object.fromEntries(
    Object.entries(byCat).map(([cat, sr]) => [cat, { score: sr.score, scoreModel: sr.scoreModel }])
  );
  // ... existing routeMap / routes / siteIssues code unchanged ...

  return { version: meta.version, score: health, weights, categories, summary, routes, siteIssues };
}
```

> Remove the old `const seoResults = …; const { score, scoreModel } = computeScore(seoResults, config);` and the separate `const byCat = scoresByCategory(...)` (computeHealth already returns the categories). `computeScore` is still imported and used for the per-route `routes[].score`. Keep the `issueOf`/`JsonIssue` definitions and the `routes`/`siteIssues` construction exactly as they are.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test -- json-report` then `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/json.ts packages/core/test/json-report.test.ts
git commit -m "feat(core): json top-level score = Health, add weights, drop scoreModel (#10)"
```

---

### Task 3: console + agent Health headline

**Files:**

- Modify: `packages/core/src/reporter/console.ts`
- Modify: `packages/core/src/reporter/agent.ts`
- Test: `packages/core/test/console-report.test.ts`, `packages/core/test/agent-report.test.ts`

**Interfaces:**

- Consumes: `computeHealth` (Task 1).
- Produces: console output with a `Health: N/100` line above the per-category score lines; agent output with a `Health: N/100` line after the heading.

- [ ] **Step 1: Write failing tests.**

`console-report.test.ts` — add:

```ts
it('shows a combined Health headline above the category scores', () => {
  const out = formatConsoleReport(results, config);
  expect(out).toMatch(/Health: \d+\/100/);
  expect(out).toMatch(/SEO Score: \d+\/100/); // per-category line still present
});
```

`agent-report.test.ts` — add:

```ts
it('shows the Health score in the heading area', () => {
  const md = formatAgentReport(results, config);
  expect(md).toMatch(/Health: \d+\/100/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- console-report agent-report`
Expected: FAIL — no `Health: N/100` line.

- [ ] **Step 3: Update `console.ts`** — import `computeHealth` and add the Health line to the header.

Change the import:

```ts
import { computeScore, scoresByCategory, computeHealth } from '../scoring/score.js';
```

In `formatConsoleReport`, build the header with the Health line first:

```ts
const summary = summarize(results, config);
const byCat = scoresByCategory(results, config);
const { health } = computeHealth(results, config);
const present = CATEGORY_ORDER.filter((c) => byCat[c] !== undefined);
const header: string[] = [`Svelte Vitals  ·  ${options.mode ?? 'static mode'}`, '', `Health: ${health}/100`];
for (const c of present) {
  header.push(scoreLine(CATEGORY_LABEL[c] ?? c, byCat[c]!));
}
const lines: string[] = [...header, ''];
```

> This inserts `Health: N/100` between the title line and the per-category `… Score: N/100` lines. Existing per-category assertions (`/SEO Score: \d+\/100/`) still pass.

- [ ] **Step 4: Update `agent.ts`** — import `computeHealth` and add a Health line after the H1, before the empty-state check so it shows in both branches.

```ts
import { computeHealth } from '../scoring/score.js';
```

Replace the opening lines of `formatAgentReport`:

```ts
const failing = results.filter((r) => classify(r, config) === 'fail');
const { health } = computeHealth(results, config);
const lines: string[] = ['# svelte-vitals — fixes', '', `Health: ${health}/100`, ''];

if (failing.length === 0) {
  lines.push('No issues to fix.', '');
  return lines.join('\n').replace(/\n+$/, '\n');
}
```

> Confirm the current `agent.ts` opening (heading `'# svelte-vitals — fixes'`, then the `failing.length === 0` branch) and splice in the Health line as shown, preserving the rest.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test -- console-report agent-report` then `pnpm --filter @svelte-vitals/core test` and `pnpm --filter @svelte-vitals/core typecheck`
Expected: PASS (new headline assertions + all existing reporter tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/console.ts packages/core/src/reporter/agent.ts packages/core/test/console-report.test.ts packages/core/test/agent-report.test.ts
git commit -m "feat(core): show combined Health headline in console and agent reports (#10)"
```

---

### Task 4: `--min-health` CI gate (CLI)

**Files:**

- Modify: `packages/cli/src/index.ts` (`RunOptions.minHealth` + `run()` gate)
- Modify: `packages/cli/src/bin.ts` (parse `--min-health`, help text)
- Test: `packages/cli/test/run.test.ts` (add gate cases)

**Interfaces:**

- Consumes: `computeHealth` from `@svelte-vitals/core`.
- Produces: `RunOptions.minHealth?: number`; `run()` returns `1` when Health < `minHealth` (in addition to the severity gate).

- [ ] **Step 1: Write the failing test** — add to `packages/cli/test/run.test.ts` (reuse `capture()`, `CLEAN_ENV`, `fixtureDir`):

```ts
it('--min-health fails (exit 1) when Health is below the threshold', async () => {
  const cap = capture();
  // 100 is unreachable for the fixture (it has SEO failures), so the gate trips.
  const code = await run({ cwd: fixtureDir, minHealth: 100, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
  expect(code).toBe(1);
});

it('--min-health passes (exit 0) when Health meets the threshold and no failing severity', async () => {
  const cap = capture();
  // 0 is always met; with default failOn=critical the fixture's criticals still gate,
  // so use a project-less assertion: a threshold of 0 must not be the cause of a failure.
  const code = await run({ cwd: fixtureDir, minHealth: 0, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
  // The fixture has a critical SEO finding, so severity still gates to 1; min-health=0 does not add a failure.
  // Assert min-health=0 alone never forces 1 by comparing to the baseline (no minHealth).
  const baseline = await run({ cwd: fixtureDir, log: capture().log, errorLog: capture().errorLog, env: CLEAN_ENV });
  expect(code).toBe(baseline);
});
```

> The fixture project has SEO criticals, so its severity gate already returns 1. These tests assert: (a) `minHealth: 100` returns 1 (Health < 100), and (b) `minHealth: 0` does not change the exit code vs no `minHealth` (the gate adds failures, never removes them). This isolates the `--min-health` behavior without needing a perfect-score fixture.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter svelte-vitals test -- run`
Expected: FAIL — `minHealth` is not an accepted `RunOptions` field / has no effect.

- [ ] **Step 3: Add `minHealth` to `RunOptions` and the gate in `run()`** in `packages/cli/src/index.ts`.

Add `computeHealth` to the `@svelte-vitals/core` import. Add the field to `RunOptions`:

```ts
export interface RunOptions {
  // ... existing fields ...
  /** Fail (exit 1) when the combined Health score is below this value (0–100). */
  minHealth?: number;
}
```

Update the exit computation (currently `const summary = summarize(results, config); return hasFailureAtOrAbove(summary, config.failOn) ? 1 : 0;`):

```ts
const summary = summarize(results, config);
const failBySeverity = hasFailureAtOrAbove(summary, config.failOn);
const failByHealth = opts.minHealth != null && computeHealth(results, config).health < opts.minHealth;
return failBySeverity || failByHealth ? 1 : 0;
```

- [ ] **Step 4: Parse `--min-health` in `bin.ts`** — add `'min-health'` to the `mri` `string` option list, parse + validate, pass into `run()`, and document it in `HELP`.

Add to the `string:` array in the `mri` call: `'min-health'`. After the `failOn` parsing block:

```ts
const minHealthRaw = argv['min-health'];
let minHealth: number | undefined;
if (minHealthRaw !== undefined) {
  const n = Number(minHealthRaw);
  if (Number.isFinite(n) && n >= 0 && n <= 100) {
    minHealth = n;
  } else {
    console.error(`svelte-vitals: invalid --min-health '${minHealthRaw}'; expected a number 0-100. Ignoring.`);
  }
}
```

Add `minHealth` to the `run({ ... })` options object. Add a line to the `HELP` string under Options:

```
  --min-health <0-100>        Fail (exit 1) when the combined Health score is below this value
```

- [ ] **Step 5: Run the CLI suite + typecheck**

Run: `pnpm --filter svelte-vitals test -- run` then `pnpm --filter svelte-vitals test` and `pnpm --filter svelte-vitals typecheck`
Expected: PASS (new gate tests + existing run tests unchanged — the severity gate is untouched).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/src/bin.ts packages/cli/test/run.test.ts
git commit -m "feat(cli): add --min-health CI gate on the combined Health score (#10)"
```

---

### Task 5: README, changeset, full verification

**Files:**

- Modify: `README.md` (roadmap)
- Create: `.changeset/health-report.md`
- Test: `packages/mcp/test/analyze-tool.test.ts` (add a Health assertion)

**Interfaces:** none (docs/release + one MCP assertion).

- [ ] **Step 1: Add an MCP assertion** that `analyze` surfaces Health — add to `packages/mcp/test/analyze-tool.test.ts`'s happy-path test (it already asserts `report.score` is a number; add weights):

```ts
expect(report).toHaveProperty('weights');
```

(Place it next to the existing `expect(typeof report.score).toBe('number')` assertion. `report.score` is now the Health value; the existing assertion still holds.)

- [ ] **Step 2: Run the MCP test**

Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals build && pnpm --filter @svelte-vitals/mcp test -- analyze-tool`
Expected: PASS. (MCP imports the built `dist` of core/cli, so build them first.)

- [ ] **Step 3: Update the README roadmap.** In `README.md`, under **Shipped**, add:

```md
- **Health Report** — a single weighted **Health** score combining SEO, Performance, and Accessibility (equal weights by default), shown as the headline in every reporter and the MCP `analyze` output; gate CI on it with `--min-health`.
```

Replace the **Upcoming** `#10` bullet (which mentions Upgrade) with:

```md
**Upcoming**

- **Toward `1.0`** — rule-reference docs, a config file, and polish. The Upgrade/deprecation category was dropped (covered by official Svelte tooling — the compiler, the Svelte MCP, and `sv migrate`).
```

- [ ] **Step 4: Add the changeset** — `.changeset/health-report.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Add the combined **Health Report** (#10): a single weighted Health score across the
SEO, Performance, and Accessibility categories (equal weights by default, overridable
via `Config.weights`), surfaced as the headline in the console/agent reporters and the
MCP `analyze` output, with an optional `--min-health <0-100>` CI gate.

**Breaking (JSON report):** the top-level `score` is now the combined Health score (it
was the SEO score); the top-level `scoreModel` is removed; a `weights` field is added.
Per-category scores remain under `categories` (e.g. `categories.seo.score` /
`categories.seo.scoreModel`).
```

- [ ] **Step 5: Full repo verification**

Run: `pnpm -r typecheck && pnpm -r test && pnpm build && pnpm lint && pnpm check:publint`
Expected: all green. (Run `pnpm format` first if prettier flags formatting. For attw, if the local root-owned npm cache blocks `check:publish`'s `npm pack`, verify attw via `npm_config_cache="$TMPDIR/npmcache" pnpm --workspace-concurrency=1 --filter @svelte-vitals/core --filter @svelte-vitals/vite --filter svelte-vitals --filter @svelte-vitals/mcp exec attw --pack . --profile esm-only`.) For any pnpm "no TTY" modules-dir error, prefix `CI=true`.

- [ ] **Step 6: Commit**

```bash
git add README.md .changeset/health-report.md packages/mcp/test/analyze-tool.test.ts
git commit -m "docs(health): ship Health Report, roadmap + changeset (#10)"
```

---

## Self-Review

**Spec coverage:**

- `computeHealth` (equal default weights, present-only, re-normalize, empty→100) + `Config.weights` → Task 1. ✅
- JSON `score`=Health, `weights` added, top-level `scoreModel` removed, `categories` intact → Task 2. ✅
- console + agent Health headline; sarif/github unchanged → Task 3 (sarif/github simply not touched). ✅
- `--min-health` gate + severity gate unchanged → Task 4. ✅
- MCP surfaces Health for free → Task 5 (assertion only; no MCP code change). ✅
- README roadmap (Health shipped, Upgrade dropped) + changeset (breaking JSON note) → Task 5. ✅
- Weights have no CLI flag (config-file deferred) → honored (Task 4 adds only `--min-health`). ✅

**Placeholder scan:** No "TBD"/"add error handling" placeholders; every code step shows full code. Task 4's test comments explain the baseline-comparison technique (the fixture has no perfect score), not a deferral.

**Type consistency:** `computeHealth(results, config): HealthResult` (Task 1) consumed in json (Task 2), console/agent (Task 3), and cli run() (Task 4). `Config.weights?: Partial<Record<Category, number>>` (Task 1) read by `computeHealth`. `JsonReport.weights` (Task 2) is the same `Partial<Record<Category, number>>`. `RunOptions.minHealth?: number` (Task 4) parsed from `--min-health` in bin (Task 4).
