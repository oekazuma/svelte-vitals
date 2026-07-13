# Compact-by-default Console Reporter + Score-Reveal Animation Implementation Plan

> **Status: SHIPPED (verified 2026-07-13 reconcile).** Landed on main via PR #167 (plus the agent/CI animation-suppression fix `233d817`) — the checkboxes below were never ticked during execution and are NOT open work. Judge state by the code, not the boxes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `svelte-vitals`'s console output stay readable on large projects (group failures by rule, cap what's shown by default, add a `--verbose` escape hatch) and give the Health score a short svelte-vitals-themed pulse-line reveal animation on an interactive terminal.

**Architecture:** `packages/core/src/reporter/console.ts`'s `formatConsoleReport` (a pure string-in/string-out function) gains a `verbose` option that switches between today's full listing and a new capped/grouped default, plus an `omitHeader` option the CLI uses when it has already animated the header itself. A new `packages/cli/src/pulse-animation.ts` module owns the animation (frame data, redraw loop) and its own TTY/CI/agent gating function, mirroring the existing `spinner.ts`/`spinnerEnabled` pattern. `packages/cli/src/index.ts`'s console-reporter call site wires the two together.

**Tech Stack:** TypeScript, Vitest, hand-rolled ANSI (no new dependency — matches every other CLI/UI surface in this codebase).

## Global Constraints

- `packages/core` is runtime-agnostic: no `node:` imports, no I/O, no runtime-specific globals in `packages/core/src/**` (`packages/core/CLAUDE.md`). `console.ts` stays a pure function; only `packages/cli` does any writing to a stream.
- No new external dependency anywhere in this plan.
- Every other reporter (json/html/md/github/sarif/agent) is untouched — this plan only touches `console.ts` and its CLI caller.
- `-v` is already `--version`'s short alias (`packages/cli/src/bin.ts`) — the new `--verbose` flag is long-form only, no short alias.
- `--no-animation` follows the existing `--no-color` naming convention (a `--no-*` boolean).
- `MAX_RULE_GROUPS_PER_BUCKET = 5`, `MAX_ROUTES_BY_ROUTE = 10` (named constants, easy to retune later).
- Both `@svelte-vitals/core` and `svelte-vitals` (CLI) release **minor**; both need a changeset (`AGENTS.md`).
- Tests are Vitest, colocated in each package's `test/` directory, following existing naming (`packages/core/test/console-report.test.ts`, `packages/cli/test/*.test.ts`).

Reference spec: `docs/superpowers/specs/2026-07-10-console-reporter-compact-and-animated-design.md`.

---

## Existing code this plan builds on

Read these before starting — every task below assumes this shape:

- `packages/core/src/reporter/console.ts` — `formatConsoleReport(results, config, options)`: builds a header (brand line, `Health:` line, per-category `scoreLine`s), then for each severity in `['critical','warning','info']` filters `failures` to that severity and prints every failing result individually, then prints every passing result individually under `Passed (N)`, then optionally `byRouteTree(...)` under `--by-route` (alphabetically sorted today). Exports `ConsoleReportOptions { byRoute?, mode?, palette? }`.
- `packages/core/src/reporter/palette.ts` — `Palette` interface (`bold`/`dim`/`red`/`yellow`/`green`/`cyan`), `noColorPalette` (identity), `scoreColor(p, score)` (green ≥90, yellow ≥70, red otherwise), all exported from `@svelte-vitals/core`'s public index.
- `packages/cli/src/spinner.ts` — `startSpinner(text, { enabled, stream? })`: the existing precedent for a hand-rolled, injectable-stream, `\r`-redrawing terminal animation. `stream` defaults to `process.stderr`, overridable for tests.
- `packages/cli/src/index.ts` — `spinnerEnabled(opts)` (stderr-TTY-gated: `reporter==='console' && stderrIsTTY && !isAutoDetectedAgent(...) && colorEnabled(...)`), and the console-reporter call site (the final `else` branch that computes `colorOn` then calls `log(formatConsoleReport(...))`), and `RunOptions` (the public options interface `run()` accepts — has `byRoute?`, `noColor?`, `stdoutIsTTY?`, `stderrIsTTY?`, etc., all threaded from `bin.ts`/`resolve-args.ts`).
- `packages/cli/src/color.ts` — `colorEnabled(opts)`, `paletteFor(enabled)`, `ansiPalette` (hand-rolled ANSI wrap functions).
- `packages/cli/src/reporter-resolve.ts` — `type ReporterName`, `isAutoDetectedAgent(explicit, env)`.
- `packages/cli/src/bin.ts` — parses argv with `mri`, builds `HELP`, calls `resolveArgs(argv)` then `run({ ...options, minHealth, noColor: argv['no-color'], selectApp })`.
- `packages/cli/src/resolve-args.ts` — `resolveArgs(argv): ResolvedArgs` normalizes parsed argv into `RunOptions` (pure, unit-tested independently of `bin.ts`'s I/O).

---

### Task 1: Group failing results by rule, cap per severity bucket

**Files:**

- Modify: `packages/core/src/reporter/console.ts`
- Test: `packages/core/test/console-report.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `ConsoleReportOptions.verbose?: boolean` (default `false`). Tasks 2 and 3 reuse this same field on the same interface — do not introduce a second flag.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/console-report.test.ts` (inside the existing `describe('formatConsoleReport', ...)` block, after the last existing `it`):

```ts
it('collapses a rule that fires on multiple routes into one group with an "…and N more" line', () => {
  const multi: Result[] = [
    {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      route: '/a',
      message: 'Missing <title>'
    },
    {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      route: '/b',
      message: 'Missing <title>'
    },
    {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      route: '/c',
      message: 'Missing <title>'
    }
  ];
  const out = formatConsoleReport(multi, config);
  expect(out).toContain('Critical (3)');
  // Only the first route's line is shown by default, plus a collapse line — not all three routes.
  expect(out).toContain('✗ SEO001  Missing <title>');
  expect(out).toContain('/a');
  expect(out).not.toContain('/b');
  expect(out).not.toContain('/c');
  expect(out).toContain('…and 2 more');
});

it('caps rule groups per severity bucket at 5 by default, with a trailer line', () => {
  const many: Result[] = Array.from({ length: 7 }, (_, i) => ({
    id: `SEO0${i}`,
    severity: 'critical' as const,
    detection: { presence: 'none', value: 'absent' } as const,
    route: `/r${i}`,
    message: `Rule ${i} failed`
  }));
  const out = formatConsoleReport(many, config);
  expect(out).toContain('Critical (7)');
  expect(out).toContain('SEO00');
  expect(out).toContain('SEO04'); // 5th shown group (0-indexed: SEO00..SEO04)
  expect(out).not.toContain('SEO05');
  expect(out).not.toContain('SEO06');
  expect(out).toContain('…and 2 more rules affected — run with --verbose to see all');
});

it("verbose:true restores today's full per-result listing, uncapped and ungrouped", () => {
  const multi: Result[] = [
    {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      route: '/a',
      message: 'Missing <title>'
    },
    {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      route: '/b',
      message: 'Missing <title>'
    }
  ];
  const out = formatConsoleReport(multi, config, { verbose: true });
  expect(out).toContain('/a');
  expect(out).toContain('/b');
  expect(out).not.toContain('…and');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: FAIL — the two new-behavior tests fail because grouping/capping doesn't exist yet (today every result prints individually, so `/b`/`/c` WOULD appear and there's no "…and" text); the `verbose:true` test fails because `formatConsoleReport` doesn't accept a `verbose` option yet (TypeScript error) — fix the type first if needed to get a runtime failure, or note the type error as the expected-fail signal.

- [ ] **Step 3: Implement the grouping/capping**

In `packages/core/src/reporter/console.ts`, add a constant and a pure grouping helper near the top (after the existing `CATEGORY_ORDER` constant):

```ts
const MAX_RULE_GROUPS_PER_BUCKET = 5;

interface RuleGroup {
  id: string;
  results: Result[];
}

/** Groups results by rule id, ranked by descending group size (most-affected rule first); ties broken by id for determinism. */
function groupByRule(results: Result[]): RuleGroup[] {
  const groups = new Map<string, Result[]>();
  for (const r of results) {
    const bucket = groups.get(r.id);
    if (bucket) bucket.push(r);
    else groups.set(r.id, [r]);
  }
  return [...groups.entries()]
    .map(([id, rs]) => ({ id, results: rs }))
    .sort((a, b) => b.results.length - a.results.length || a.id.localeCompare(b.id));
}
```

Add `verbose?: boolean` to `ConsoleReportOptions`:

```ts
export interface ConsoleReportOptions {
  byRoute?: boolean;
  /** Mode label shown in the header (default 'static mode'). */
  mode?: string;
  /** Color decorators; defaults to no color. */
  palette?: Palette;
  /** Show every failing/passed/route entry uncapped and ungrouped, exactly as before this option existed. Default false (capped, grouped by rule). */
  verbose?: boolean;
}
```

Replace the severity-bucket loop body inside `formatConsoleReport`:

```ts
for (const severity of ['critical', 'warning', 'info'] as const) {
  const bucket = failures.filter((r) => effectiveSeverity(r, config) === severity);
  if (bucket.length === 0) continue;
  lines.push(SEVERITY_COLOR[severity](`${SEVERITY_TITLE[severity]} (${bucket.length})`), p.dim(RULE));

  if (options.verbose) {
    for (const r of bucket) {
      lines.push(`${p.red('✗')} ${r.id}  ${r.message}`);
      if (r.route) lines.push(p.dim(`            ${r.route}`));
      if (r.location) lines.push(p.dim(`            ${r.location}${r.line ? `:${r.line}` : ''}`));
    }
  } else {
    const groups = groupByRule(bucket);
    const shownGroups = groups.slice(0, MAX_RULE_GROUPS_PER_BUCKET);
    for (const group of shownGroups) {
      const r = group.results[0]!;
      lines.push(`${p.red('✗')} ${r.id}  ${r.message}`);
      if (r.route) lines.push(p.dim(`            ${r.route}`));
      if (r.location) lines.push(p.dim(`            ${r.location}${r.line ? `:${r.line}` : ''}`));
      if (group.results.length > 1) {
        lines.push(p.dim(`            …and ${group.results.length - 1} more`));
      }
    }
    if (groups.length > MAX_RULE_GROUPS_PER_BUCKET) {
      const remaining = groups.length - MAX_RULE_GROUPS_PER_BUCKET;
      lines.push(
        p.dim(`…and ${remaining} more rule${remaining > 1 ? 's' : ''} affected — run with --verbose to see all`)
      );
    }
  }
  lines.push('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: PASS (all tests in the file, old and new).

- [ ] **Step 5: Run the full core test suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS — confirms no other test in the package asserted the old uncapped/ungrouped default (the plan's investigation found none, but verify).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/console.ts packages/core/test/console-report.test.ts
git commit -m "feat(core): group console findings by rule, cap top 5 per severity bucket"
```

---

### Task 2: Collapse the Passed section to a count by default

**Files:**

- Modify: `packages/core/src/reporter/console.ts`
- Test: `packages/core/test/console-report.test.ts`

**Interfaces:**

- Consumes: `ConsoleReportOptions.verbose` (Task 1).
- Produces: nothing new (behavior change only).

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/console-report.test.ts`:

```ts
it('collapses the Passed section to a bare count by default (no per-item lines)', () => {
  const passing: Result[] = [
    {
      id: 'SEO003',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      route: '/a',
      message: 'Has <title>'
    },
    {
      id: 'SEO004',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      route: '/b',
      message: 'Has <meta description>'
    }
  ];
  const out = formatConsoleReport(passing, config);
  expect(out).toContain('Passed (2)');
  expect(out).not.toContain('✓ SEO003');
  expect(out).not.toContain('✓ SEO004');
});

it('lists every passed item under verbose:true, exactly as before', () => {
  const passing: Result[] = [
    {
      id: 'SEO003',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      route: '/a',
      message: 'Has <title>'
    }
  ];
  const out = formatConsoleReport(passing, config, { verbose: true });
  expect(out).toContain('✓ SEO003  Has <title>');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: FAIL on the first new test — today's code always lists every passed item, so `✓ SEO003` is present regardless of `verbose`.

- [ ] **Step 3: Implement the collapse**

In `packages/core/src/reporter/console.ts`, replace the passed-results block inside `formatConsoleReport`:

```ts
const passed = results.filter((r) => classify(r, config) !== 'fail');
if (passed.length > 0) {
  lines.push(p.bold(`Passed (${passed.length})`), p.dim(RULE));
  if (options.verbose) {
    for (const r of passed) {
      const marker = classify(r, config) === 'dynamic' ? p.cyan('  ↯ dynamic') : '';
      const route = r.route ? `  ${r.route}` : '';
      lines.push(`${p.green('✓')} ${r.id}  ${r.message}${marker}${route}`);
    }
  }
  lines.push('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: PASS.

- [ ] **Step 5: Run the full core test suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/console.ts packages/core/test/console-report.test.ts
git commit -m "feat(core): collapse the Passed section to a bare count by default"
```

---

### Task 3: `--by-route` — worst-first sort and cap at 10

**Files:**

- Modify: `packages/core/src/reporter/console.ts`
- Test: `packages/core/test/console-report.test.ts`

**Interfaces:**

- Consumes: `ConsoleReportOptions.verbose` (Task 1).
- Produces: nothing new (behavior change only — `byRouteTree`'s internal signature changes but it's not exported).

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/console-report.test.ts`:

```ts
it('sorts --by-route worst-score-first, not alphabetically', () => {
  const mixed: Result[] = [
    {
      id: 'SEO001',
      severity: 'critical',
      detection: { presence: 'none', value: 'absent' },
      route: '/z-bad',
      message: 'Missing <title>'
    },
    {
      id: 'SEO003',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      route: '/a-good',
      message: 'Has <title>'
    }
  ];
  const out = formatConsoleReport(mixed, config, { byRoute: true });
  const byRouteSection = out.split('By route')[1]!;
  // The worse route ('/z-bad', has a critical finding) must appear before the
  // better one ('/a-good') even though 'a' sorts before 'z' alphabetically.
  expect(byRouteSection.indexOf('/z-bad')).toBeLessThan(byRouteSection.indexOf('/a-good'));
});

it('caps --by-route at 10 routes by default, with an "…and N more" trailer', () => {
  const manyRoutes: Result[] = Array.from({ length: 12 }, (_, i) => ({
    id: 'SEO003',
    severity: 'info' as const,
    detection: { presence: 'own', value: 'static' } as const,
    route: `/r${i}`,
    message: 'Has <title>'
  }));
  const out = formatConsoleReport(manyRoutes, config, { byRoute: true });
  const byRouteSection = out.split('By route')[1]!;
  expect(byRouteSection).toContain('…and 2 more route');
  expect(byRouteSection).toContain('run with --verbose to see all');
});

it('--by-route with verbose:true shows every route, still worst-first', () => {
  const manyRoutes: Result[] = Array.from({ length: 12 }, (_, i) => ({
    id: 'SEO003',
    severity: 'info' as const,
    detection: { presence: 'own', value: 'static' } as const,
    route: `/r${i}`,
    message: 'Has <title>'
  }));
  const out = formatConsoleReport(manyRoutes, config, { byRoute: true, verbose: true });
  const byRouteSection = out.split('By route')[1]!;
  for (let i = 0; i < 12; i++) expect(byRouteSection).toContain(`/r${i}`);
  expect(byRouteSection).not.toContain('…and');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: FAIL — today's `byRouteTree` sorts alphabetically (so `/a-good` comes first) and never caps.

- [ ] **Step 3: Implement the sort + cap**

In `packages/core/src/reporter/console.ts`, replace the `byRouteTree` function:

```ts
const MAX_ROUTES_BY_ROUTE = 10;

function byRouteTree(p: Palette, results: Result[], config: Config, verbose: boolean): string[] {
  const routes = new Map<string, Result[]>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routes.has(r.route)) routes.set(r.route, []);
    routes.get(r.route)!.push(r);
  }
  const scored = [...routes.entries()].map(([route, rs]) => ({
    route,
    rs,
    score: computeScore(rs, config, { applyCriticalCap: false }).score
  }));
  // Worst first (ascending score) — the routes most in need of attention lead, which is
  // also what makes a cap meaningful: the routes cut off are the healthiest ones.
  scored.sort((a, b) => a.score - b.score || a.route.localeCompare(b.route));

  const shown = verbose ? scored : scored.slice(0, MAX_ROUTES_BY_ROUTE);
  const lines: string[] = [p.bold('By route'), p.dim(RULE)];
  for (const { route, rs, score } of shown) {
    lines.push(`${route.padEnd(28)} ${scoreColor(p, score)(`${score}`)}`);
    for (const r of rs.filter((x) => classify(x, config) === 'fail')) {
      lines.push(`    ${p.red('✗')} ${r.id}  ${r.message}`);
    }
  }
  if (!verbose && scored.length > MAX_ROUTES_BY_ROUTE) {
    const remaining = scored.slice(MAX_ROUTES_BY_ROUTE);
    const avgScore = Math.round(remaining.reduce((sum, r) => sum + r.score, 0) / remaining.length);
    lines.push(
      p.dim(
        `…and ${remaining.length} more route${remaining.length > 1 ? 's' : ''} (avg score ${avgScore}) — run with --verbose to see all`
      )
    );
  }
  lines.push('');
  return lines;
}
```

Update the call site inside `formatConsoleReport` (currently `if (options.byRoute) lines.push(...byRouteTree(p, results, config));`):

```ts
if (options.byRoute) lines.push(...byRouteTree(p, results, config, options.verbose ?? false));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: PASS.

- [ ] **Step 5: Run the full core test suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS — including the existing `'renders a per-route tree under --by-route'` test (single-route fixture, unaffected by sort/cap changes).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/console.ts packages/core/test/console-report.test.ts
git commit -m "feat(core): sort --by-route worst-first and cap at 10 routes by default"
```

---

### Task 4: `omitHeader` option

**Files:**

- Modify: `packages/core/src/reporter/console.ts`
- Test: `packages/core/test/console-report.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `ConsoleReportOptions.omitHeader?: boolean` (default `false`). Task 6 (CLI) depends on this exact option name.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/test/console-report.test.ts`:

```ts
it('omitHeader:true skips the brand/Health/category lines, returning only the body', () => {
  const out = formatConsoleReport(results, config, { omitHeader: true });
  expect(out).not.toContain('Svelte Vitals');
  expect(out).not.toContain('Health:');
  expect(out).not.toContain('SEO Score:');
  expect(out).toContain('Critical (1)'); // body content still present
});

it('omitHeader is false by default — header still prints', () => {
  const out = formatConsoleReport(results, config);
  expect(out).toContain('Svelte Vitals');
  expect(out).toContain('Health:');
});
```

- [ ] **Step 2: Run tests to verify the first one fails**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: FAIL on `'omitHeader:true skips...'` — `omitHeader` isn't a recognized option yet, so the header always prints (and TypeScript will flag the unknown option if strict — treat that as the expected-fail signal too).

- [ ] **Step 3: Implement `omitHeader`**

Add `omitHeader?: boolean` to `ConsoleReportOptions`:

```ts
export interface ConsoleReportOptions {
  byRoute?: boolean;
  mode?: string;
  palette?: Palette;
  verbose?: boolean;
  /** Internal: set by the CLI when it has already animated the Health header itself — skips the brand/Health/category lines, returning only the findings/passed/by-route body. Default false. */
  omitHeader?: boolean;
}
```

Replace the header-building section at the top of `formatConsoleReport` (currently builds a `header` array unconditionally then does `const lines: string[] = [...header, '']`):

```ts
const lines: string[] = [];
if (!options.omitHeader) {
  lines.push(
    p.bold(`Svelte Vitals  ·  ${options.mode ?? 'static mode'}`),
    '',
    `${p.bold('Health:')} ${scoreColor(p, health)(`${health}/100`)}`
  );
  for (const c of present) {
    lines.push(scoreLine(p, CATEGORY_LABEL[c] ?? c, byCat[c]!));
  }
}
lines.push('');
```

(This replaces both the `const header: string[] = [...]` block and the `const lines: string[] = [...header, ''];` line — there is now only one `lines` array, built directly.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @svelte-vitals/core test -- console-report`
Expected: PASS.

- [ ] **Step 5: Run the full core test suite**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reporter/console.ts packages/core/test/console-report.test.ts
git commit -m "feat(core): add omitHeader option to formatConsoleReport"
```

---

### Task 5: Pulse-line score animation module

**Files:**

- Create: `packages/cli/src/pulse-animation.ts`
- Test: Create `packages/cli/test/pulse-animation.test.ts`

**Interfaces:**

- Consumes: `Palette`, `scoreColor` from `@svelte-vitals/core`; `type ReporterName`, `isAutoDetectedAgent` from `./reporter-resolve.js`; `colorEnabled` from `./color.js`.
- Produces: `scoreAnimationEnabled(opts): boolean`, `playScoreAnimation(opts): Promise<void>`. Task 6 depends on both exact names/signatures.

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/pulse-animation.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { scoreAnimationEnabled, playScoreAnimation } from '../src/pulse-animation.js';
import { noColorPalette, ansiPalette } from '../src/color.js';

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('scoreAnimationEnabled', () => {
  const base = {
    reporter: 'console' as const,
    rawReporter: undefined,
    stdoutIsTTY: true,
    env: {} as NodeJS.ProcessEnv
  };
  it('is on for a console reporter on an interactive stdout', () => {
    expect(scoreAnimationEnabled(base)).toBe(true);
  });
  it('is off when stdout is not a TTY', () => {
    expect(scoreAnimationEnabled({ ...base, stdoutIsTTY: false })).toBe(false);
  });
  it('is off for a non-console reporter', () => {
    expect(scoreAnimationEnabled({ ...base, reporter: 'json' })).toBe(false);
  });
  it('is off with --no-color / NO_COLOR', () => {
    expect(scoreAnimationEnabled({ ...base, noColorFlag: true })).toBe(false);
    expect(scoreAnimationEnabled({ ...base, env: { NO_COLOR: '1' } })).toBe(false);
  });
  it('is off with --no-animation', () => {
    expect(scoreAnimationEnabled({ ...base, noAnimationFlag: true })).toBe(false);
  });
  it('is off when the agent reporter was auto-detected from the env', () => {
    expect(scoreAnimationEnabled({ ...base, env: { CLAUDECODE: '1' } })).toBe(false);
  });
});

describe('playScoreAnimation', () => {
  it('writes 6 frames ending on the final score, using frameDelayMs:0 to run instantly', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 82, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes).toHaveLength(6);
    expect(writes[writes.length - 1]).toContain('82/100');
  });

  it('colors the final frame using scoreColor thresholds', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 });
    expect(writes[writes.length - 1]).toContain('\x1b[32m'); // green, score >= 90
  });

  it('redraws in place: every frame after the first starts with a cursor-up escape', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 50, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes[0]).not.toContain('\x1b[2A');
    for (let i = 1; i < writes.length; i++) expect(writes[i]).toContain('\x1b[2A');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- pulse-animation`

(Confirmed: `packages/cli/package.json`'s `"name"` field is `svelte-vitals` — that's the correct `--filter` target for every command in this task, not `@svelte-vitals/vite` or `@svelte-vitals/cli`.)

Expected: FAIL — `Cannot find module '../src/pulse-animation.js'`.

- [ ] **Step 3: Implement `pulse-animation.ts`**

Create `packages/cli/src/pulse-animation.ts`:

```ts
import { scoreColor, type Palette } from '@svelte-vitals/core';
import { colorEnabled } from './color.js';
import { isAutoDetectedAgent, type ReporterName } from './reporter-resolve.js';

const FRAME_COUNT = 6;
const FRAME_DELAY_MS = 200;

// Pulse waveform, one string per frame — an erratic heartbeat line that settles flat
// as the score locks in (svelte-vitals' own animation motif: "vitals" as in a pulse
// monitor).
const WAVE_FRAMES = [
  '────────────╱╲──────────',
  '──────────╱╲──╱╲────────',
  '────────╱╲──────╱╲──────',
  '──────╱╲──────────╲─────',
  '────╱──────────────╲────',
  '─────────────────────────'
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ScoreAnimationOptions {
  score: number;
  palette: Palette;
  stream: NodeJS.WriteStream;
  /** Override for tests — real playback uses FRAME_DELAY_MS (200ms); 0 runs the same frame loop near-instantly. */
  frameDelayMs?: number;
}

/**
 * Plays the pulse-line score-reveal animation in place on `stream`: two lines (wave +
 * Health score), redrawn each frame via `\r` + a 2-line ANSI cursor-up escape, matching
 * the redraw technique `spinner.ts` already uses for its single-line spinner. The score
 * counts up linearly across the frames; the final frame colors it via `scoreColor`,
 * matching every other colored score in the console reporter.
 */
export async function playScoreAnimation(opts: ScoreAnimationOptions): Promise<void> {
  const frameDelayMs = opts.frameDelayMs ?? FRAME_DELAY_MS;
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const progress = frame / (FRAME_COUNT - 1);
    const displayScore = Math.round(opts.score * progress);
    const isFinalFrame = frame === FRAME_COUNT - 1;
    const wave = WAVE_FRAMES[frame]!;
    const scoreText = isFinalFrame
      ? scoreColor(opts.palette, opts.score)(`${displayScore}/100`)
      : opts.palette.dim(`${displayScore}/100`);
    const cursorUp = frame === 0 ? '' : '\x1b[2A';
    // \x1b[K after each line clears any leftover characters from a longer previous
    // frame — the wave strings are not all the same length, and without this a
    // shorter frame would leave stray trailing characters from the one before it.
    opts.stream.write(`${cursorUp}\r  ${wave}\x1b[K\n\r  Health: ${scoreText}\x1b[K\n`);
    if (!isFinalFrame) await sleep(frameDelayMs);
  }
}

/**
 * Mirrors `spinnerEnabled` (packages/cli/src/index.ts) but checks stdout, not stderr —
 * the animation writes the actual report content, unlike the spinner's stderr status
 * line. `--score` mode never reaches the console-reporter call site at all, so it
 * needs no explicit check here.
 */
export function scoreAnimationEnabled(opts: {
  reporter: ReporterName;
  rawReporter: ReporterName | undefined;
  stdoutIsTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
  noAnimationFlag?: boolean;
}): boolean {
  return (
    opts.reporter === 'console' &&
    opts.stdoutIsTTY &&
    !opts.noAnimationFlag &&
    !isAutoDetectedAgent(opts.rawReporter, opts.env) &&
    colorEnabled({ reporter: opts.reporter, isTTY: opts.stdoutIsTTY, env: opts.env, noColorFlag: opts.noColorFlag })
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- pulse-animation`
Expected: PASS.

- [ ] **Step 5: Run the full cli test suite and typecheck**

Run: `pnpm --filter svelte-vitals test && pnpm --filter svelte-vitals typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/pulse-animation.ts packages/cli/test/pulse-animation.test.ts
git commit -m "feat(cli): add the pulse-line score-reveal animation module"
```

---

### Task 6: Wire `--verbose`/`--no-animation` and the animation into the CLI

**Files:**

- Modify: `packages/cli/src/bin.ts`
- Modify: `packages/cli/src/resolve-args.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/resolve-args.test.ts`
- Test: `packages/cli/test/run.test.ts`

**Interfaces:**

- Consumes: `ConsoleReportOptions.verbose`/`omitHeader` (Tasks 1-4), `scoreAnimationEnabled`/`playScoreAnimation` (Task 5).
- Produces: `RunOptions.verbose?: boolean`, `RunOptions.noAnimation?: boolean`, `RunOptions.stdoutStream?: NodeJS.WriteStream` (test injection point, mirrors `stdoutIsTTY`/`stderrIsTTY`), `RunOptions.animationFrameDelayMs?: number` (test injection point, threaded straight into `playScoreAnimation`'s `frameDelayMs`).

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/test/resolve-args.test.ts` — first add `'verbose'` to the `boolean` array in the file's local `resolve()` helper (it currently reads `boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'score']`):

```ts
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'score', 'verbose'],
```

Then add a new test to the `describe('resolveArgs', ...)` block:

```ts
it('threads --verbose into options.verbose', () => {
  const { options } = resolve('--verbose');
  expect(options?.verbose).toBe(true);
});

it('verbose defaults to false (undefined) when not passed', () => {
  const { options } = resolve();
  expect(options?.verbose).toBeUndefined();
});
```

Add to `packages/cli/test/run.test.ts` a new `describe` block after the existing ones:

```ts
describe('run() --verbose and animation', () => {
  it('passes verbose:true through to the console report body', async () => {
    const cap = capture();
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      verbose: true
    });
    // basic-project's single critical finding still renders the same either way,
    // but verbose:true must not throw and must still produce console output.
    expect(cap.out.join('\n')).toContain('Critical');
  });

  it('animates the header on an interactive stdout and omits it from the printed body', async () => {
    const cap = capture();
    const animWrites: string[] = [];
    const stdoutStream = { write: (s: string) => animWrites.push(s) } as unknown as NodeJS.WriteStream;
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: true,
      stdoutStream,
      animationFrameDelayMs: 0
    });
    // Animation wrote frames to the injected stream...
    expect(animWrites.length).toBeGreaterThan(0);
    expect(animWrites.join('')).toContain('Health:');
    // ...and the printed report body has no duplicate header (Svelte Vitals brand line
    // and Health: line only ever came from the animation, not from formatConsoleReport).
    const report = cap.out.join('\n');
    expect(report).not.toContain('Svelte Vitals');
    expect(report).not.toContain('Health:');
    expect(report).toContain('Critical');
  });

  it('does not animate when stdout is not a TTY — header prints inline as before', async () => {
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: false
    });
    expect(code).toBe(1);
    expect(cap.out.join('\n')).toContain('Health:');
  });

  it('--no-animation suppresses the animation even on an interactive stdout', async () => {
    const cap = capture();
    const animWrites: string[] = [];
    const stdoutStream = { write: (s: string) => animWrites.push(s) } as unknown as NodeJS.WriteStream;
    await run({
      cwd: fixtureDir,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV,
      stdoutIsTTY: true,
      stdoutStream,
      noAnimation: true
    });
    expect(animWrites).toEqual([]);
    expect(cap.out.join('\n')).toContain('Health:'); // header printed inline instead
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- resolve-args`
Expected: FAIL — `options?.verbose` is `undefined` for `--verbose` (not yet threaded).

Run: `pnpm --filter svelte-vitals test -- run`
Expected: FAIL — `RunOptions` doesn't accept `verbose`/`stdoutStream`/`animationFrameDelayMs`/`noAnimation` yet (TypeScript errors), and no animation ever fires.

- [ ] **Step 3: Add `--verbose` to `resolve-args.ts`**

In `packages/cli/src/resolve-args.ts`, inside `resolveArgs`'s returned `options` object (in the object literal that currently ends with `...(baselineRef !== undefined ? { baseline: baselineRef } : {})`), add one line:

```ts
      byRoute: Boolean(argv['by-route']),
      verbose: Boolean(argv['verbose']),
```

(Insert immediately after the existing `byRoute: Boolean(argv['by-route']),` line — same style as that line, a plain boolean coercion with no validation needed.)

- [ ] **Step 4: Add flags to `bin.ts`**

In `packages/cli/src/bin.ts`, add `'verbose'` and `'no-animation'` to the `boolean` array passed to `mri`:

```ts
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'no-color', 'score', 'verbose', 'no-animation'],
```

Add two lines to the `HELP` string, in the `Options:` block, right after the existing `--no-color` line:

```
  --no-color                  Disable ANSI color in console output
  --no-animation               Disable the Health-score reveal animation on an interactive terminal
  --verbose                    Show every finding uncapped and ungrouped (default: capped, grouped by rule)
```

Update the `run(...)` call at the bottom of `main()` to also thread `noAnimation`:

```ts
const code = await run({
  ...options,
  minHealth,
  noColor: argv['no-color'],
  noAnimation: argv['no-animation'],
  selectApp
});
```

(`verbose` is already inside `options` via Step 3's change to `resolveArgs`, so it doesn't need a separate line here — it flows through `...options` the same way `byRoute` does.)

- [ ] **Step 5: Extend `RunOptions` and the console-reporter call site in `index.ts`**

In `packages/cli/src/index.ts`, add three fields to the `RunOptions` interface, near the existing `noColor?`/`stdoutIsTTY?` fields:

```ts
  /** Show every finding uncapped and ungrouped in console output (default false — capped, grouped by rule). */
  verbose?: boolean;
  /** Disable the Health-score reveal animation even on an interactive stdout. */
  noAnimation?: boolean;
  /** Override the stream the score animation writes to (tests). Defaults to process.stdout. */
  stdoutStream?: NodeJS.WriteStream;
  /** Override the animation's per-frame delay in ms (tests — 0 runs the real frame loop near-instantly). Defaults to the animation module's own constant. */
  animationFrameDelayMs?: number;
```

Add the import at the top of the file, alongside the other local imports:

```ts
import { playScoreAnimation, scoreAnimationEnabled } from './pulse-animation.js';
```

Replace the console-reporter branch (currently the final `else` in the reporter chain):

```ts
      } else {
        const stdoutIsTTY = opts.stdoutIsTTY ?? !!process.stdout.isTTY;
        const colorOn = colorEnabled({
          reporter,
          isTTY: stdoutIsTTY,
          env,
          noColorFlag: opts.noColor
        });
        const palette = paletteFor(colorOn);
        const animate = scoreAnimationEnabled({
          reporter,
          rawReporter: opts.reporter,
          stdoutIsTTY,
          env,
          noColorFlag: opts.noColor,
          noAnimationFlag: opts.noAnimation
        });
        if (animate) {
          await playScoreAnimation({
            score: computeHealth(results, config).health,
            palette,
            stream: opts.stdoutStream ?? process.stdout,
            frameDelayMs: opts.animationFrameDelayMs
          });
        }
        log(
          formatConsoleReport(results, config, {
            byRoute: opts.byRoute ?? false,
            verbose: opts.verbose ?? false,
            palette,
            omitHeader: animate
          })
        );
      }
```

`computeHealth` is already imported at the top of `index.ts` (used elsewhere in the file for `--min-health` gating) — no new import needed for it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- resolve-args`
Expected: PASS.

Run: `pnpm --filter svelte-vitals test -- run`
Expected: PASS.

- [ ] **Step 7: Run the full cli test suite and typecheck**

Run: `pnpm --filter svelte-vitals test && pnpm --filter svelte-vitals typecheck`
Expected: PASS.

- [ ] **Step 8: Manual smoke check**

Run: `pnpm --filter svelte-vitals build && node packages/cli/dist/bin.js --help`
Expected: the help text includes the new `--verbose` and `--no-animation` lines.

Then, from a real interactive terminal (not through this tool's non-TTY shell — note this for whoever executes the plan interactively), run `svelte-vitals` against any SvelteKit project and confirm: the pulse animation plays once, settles on the correctly-colored score, and the findings below are capped/grouped as designed. Re-run with `--verbose` and confirm the old uncapped behavior returns. Re-run with `--no-animation` and confirm the header prints statically with no animation. Pipe the output to a file (`svelte-vitals > out.txt`) and confirm `out.txt` contains no ANSI escape codes or animation artifacts.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/bin.ts packages/cli/src/resolve-args.ts packages/cli/src/index.ts packages/cli/test/resolve-args.test.ts packages/cli/test/run.test.ts
git commit -m "feat(cli): wire --verbose/--no-animation and the score animation into run()"
```

---

### Task 7: Documentation (en/ja)

**Files:**

- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Update the English CLI guide**

In `docs/src/content/docs/guides/cli.md`, find the `### `--by-route`` entry (a two-line entry: heading then one sentence). Immediately after it, insert two new entries following the exact same format:

```md
### `--verbose`

Show every finding uncapped and ungrouped, matching the console output from before this option existed. By default, console output groups failures by rule (showing the top 5 rules per severity, each with one example location and an "…and N more" count), collapses the Passed section to a bare count, and caps `--by-route` to the 10 worst-scoring routes.

### `--no-animation`

Disable the Health-score reveal animation. The animation only ever plays on an interactive terminal with color enabled (never in CI, a piped/redirected output, or an AI-agent shell), so this flag is only needed to opt out of it specifically while still on an interactive terminal.
```

- [ ] **Step 2: Update the Japanese CLI guide**

In `docs/src/content/docs/ja/guides/cli.md`, find the `--by-route` entry (locate by searching for `by-route` — confirm the exact heading text/format used in this file before inserting, since it may differ slightly in phrasing from the English file's structure though the heading itself, `` `--by-route` ``, is not translated). Insert two new entries in the same position/format as the English file:

```md
### `--verbose`

すべての指摘を、集約・グループ化なしで表示します(このオプションが導入される前の挙動と同じです)。デフォルトのコンソール出力では、失敗した指摘をルールごとにグループ化し(severityごとに上位5ルールのみ表示、それぞれ代表1件の場所+「他N件」という件数表示)、Passedセクションは件数のみに集約し、`--by-route`はスコアが低い順に上位10ルートまでに制限します。

### `--no-animation`

Healthスコアの演出アニメーションを無効にします。このアニメーションはインタラクティブな端末かつカラー表示が有効な場合にのみ再生されます(CI・パイプ/リダイレクト出力・AIエージェントのシェルでは再生されません)ので、インタラクティブな端末上でアニメーションだけを個別に無効化したい場合にこのフラグを使います。
```

- [ ] **Step 3: Verify the docs build**

Run: `pnpm --filter docs build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md
git commit -m "docs: document --verbose and --no-animation (en/ja)"
```

---

### Task 8: Changesets

**Files:**

- Create: `.changeset/<generated-name>.md`

**Interfaces:** none.

- [ ] **Step 1: Add the changeset**

Create the changeset file directly (non-interactive — `pnpm changeset`'s interactive prompts don't work through a non-interactive shell; this produces an identical result since Changesets only reads the file's frontmatter/body). Check `.changeset/config.json` first to confirm this repo's exact frontmatter format, then create `.changeset/console-reporter-compact-animated.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Console output now groups findings by rule and caps what's shown by default (top 5 rules per severity, the Passed section collapsed to a count, `--by-route` capped to the worst 10 routes) — pass `--verbose` for the old uncapped listing. The Health score also gets a short pulse-line reveal animation on an interactive terminal (disable with `--no-animation`).
```

- [ ] **Step 2: Verify with `changeset status`**

Run: `pnpm changeset status`
Expected: reports a minor bump for both `@svelte-vitals/core` and `svelte-vitals`, no errors.

- [ ] **Step 3: Run the full monorepo verify suite**

Run these in order (per `AGENTS.md`):

```bash
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm check:publish
```

Expected: all PASS. (Note: `check:publish`'s `attw --pack` step has previously failed in a sandboxed environment with no `npm` binary on `PATH` — an environment limitation, not a code defect; `publint` passing is the meaningful signal there. If this environment has the same gap, note it rather than treating it as a blocker.)

- [ ] **Step 4: Commit**

```bash
git add .changeset
git commit -m "chore: add changeset for the compact console reporter + score animation"
```

---

## Manual verification (not automated — do after Task 8)

Per Task 6 Step 8, the animation's actual look-and-feel needs a real interactive terminal (not this plan's automated test suite, which injects fake streams). Before considering this plan done:

- Run `svelte-vitals` in a real terminal against a project with many findings across several rules and confirm the capped/grouped output reads well and the "…and N more" / "…and N more rules affected" / "…and N more routes" lines are legible.
- Confirm the pulse animation looks good — timing (should feel snappy, not sluggish, at ~1.1s total), the wave settling, the score color-matching the final band.
- Confirm `--no-color` also disables the animation (it should, since `scoreAnimationEnabled` requires `colorEnabled(...)`).
- Confirm running inside this Claude Code session itself (an agent environment) never animates or shows ANSI codes, since `CLAUDECODE` is set — this validates the `isAutoDetectedAgent` gate without needing a separate CI environment to test in.

---

## Self-review

**Spec coverage:**

- Rule-grouping + top-5 cap per severity bucket, "…and N more"/"…and N more rules affected" trailers → Task 1.
- Passed section collapse → Task 2.
- `--by-route` worst-first sort + cap at 10 with avg-score trailer → Task 3.
- `verbose` option (single flag controlling all three) → Tasks 1-3 share the one field; Task 6 threads `--verbose`.
- `omitHeader` option → Task 4.
- Pulse-line animation (6 frames, ~1.1s at 200ms/frame, cursor-up redraw, `scoreColor` final-frame coloring) → Task 5.
- `scoreAnimationEnabled` gating (stdout TTY, not agent, color enabled, not `--no-animation`) mirroring `spinnerEnabled` → Task 5.
- `--no-animation` flag → Task 6.
- `-v` already taken by `--version`, so `--verbose` is long-form only → Task 6 Step 4 (no short alias added).
- No new dependency → verified; `pulse-animation.ts` only imports from `@svelte-vitals/core` and this package's own `color.ts`/`reporter-resolve.ts`.
- Other reporters untouched → verified; no task modifies `json.ts`/`html.ts`/`markdown.ts`/`github.ts`/`sarif.ts`/`agent.ts`.
- Both packages minor + changesets → Task 8.
- en/ja docs → Task 7.

**Placeholder scan:** no "TBD"/"TODO"/vague instructions; every step has complete code or an exact command.

**Type consistency:** `ConsoleReportOptions` fields (`verbose`, `omitHeader`) are named identically across Tasks 1-4 and consumed identically in Task 6's `index.ts` changes. `scoreAnimationEnabled`/`playScoreAnimation` (Task 5) are imported and called with matching parameter names in Task 6. `RunOptions.stdoutStream`/`animationFrameDelayMs`/`verbose`/`noAnimation` (Task 6) match the fields the Task 6 tests inject.

**One deliberate behavior change flagged for the human, not just noted in passing:** `--by-route`'s sort order changes from alphabetical to worst-score-first (Task 3) — this is called out explicitly in the spec and in Task 3's test names, not a silent side effect.
