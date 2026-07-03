# CLI rich console output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `--reporter console` output rich — severity/score/category colors, visual hierarchy, and an "Analyzing…" spinner — while keeping `@svelte-vitals/core` pure & dependency-free and auto-disabling under non-TTY / `NO_COLOR` / non-console reporters.

**Architecture:** Core's `formatConsoleReport` takes an injected `Palette` (string→string fns) defaulting to identity, so existing plain output/tests are unchanged. The CLI supplies a hand-rolled ANSI palette gated on TTY/`NO_COLOR`/`FORCE_COLOR`/reporter, plus a stderr spinner. No new dependency.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@svelte-vitals/core`, `@svelte-vitals/cli`), Changesets.

## Global Constraints

- `@svelte-vitals/core` stays dependency-free and pure: color is an **injected `Palette`** with an **identity default** (`noColorPalette`). No ANSI codes or TTY/env reads in core.
- CLI hand-rolls ANSI + spinner (no new dependency; repo uses only `mri` in the CLI).
- Color/spinner auto-disable when: reporter ≠ `console`, stdout/stderr not a TTY, `NO_COLOR` set, or `--no-color`. `FORCE_COLOR` (non-empty, ≠ `0`) forces on. Spinner also disabled under an auto-detected agent env.
- Spinner writes to **stderr** (stdout / piped report stays clean). No `Date.now()`/`new Date()` (use `setInterval`).
- Score color thresholds: green ≥ 90, yellow ≥ 70, red otherwise.
- No existing test assertion is loosened (identity default keeps current output byte-identical).
- Spec: `docs/superpowers/specs/2026-07-03-cli-rich-console-output-design.md`.
- Branch: `feat/cli-rich-console` (created; spec committed).
- Run commands from the repo root.

---

## File Structure

- Create: `packages/core/src/reporter/palette.ts` — `Palette`, `noColorPalette`, `scoreColor`.
- Modify: `packages/core/src/reporter/console.ts` — accept `options.palette`, apply it.
- Modify: `packages/core/src/index.ts` — export the palette API.
- Modify: `packages/core/test/console-report.test.ts` (or the existing console reporter test) — add palette tests.
- Create: `packages/cli/src/color.ts` — `ansiPalette`, `colorEnabled`, `paletteFor`.
- Create: `packages/cli/src/spinner.ts` — `startSpinner`.
- Modify: `packages/cli/src/index.ts` — hoist reporter/env resolution; wire palette + spinner; add `noColor`/`stdoutIsTTY`/`stderrIsTTY` to `RunOptions`.
- Modify: `packages/cli/src/bin.ts` — `--no-color` flag; help tagline fix.
- Create: `packages/cli/test/color.test.ts`, `packages/cli/test/spinner.test.ts`.
- Create: `.changeset/cli-rich-console.md`.

---

### Task 1: Core palette injection

**Files:**
- Create: `packages/core/src/reporter/palette.ts`
- Modify: `packages/core/src/reporter/console.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/console-palette.test.ts` (create)

**Interfaces:**
- Produces: `interface Palette`, `const noColorPalette: Palette`, `function scoreColor(p, score)`; `ConsoleReportOptions.palette?`.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/console-palette.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatConsoleReport, noColorPalette, scoreColor, type Palette } from '../src/index.js';
import { defineConfig } from '../src/types.js';
import type { Result } from '../src/types.js';

const config = defineConfig({});
// Marker palette: wraps text so we can assert where color is applied.
const mark: Palette = {
  bold: (s) => `[b]${s}[/b]`,
  dim: (s) => `[d]${s}[/d]`,
  red: (s) => `[r]${s}[/r]`,
  yellow: (s) => `[y]${s}[/y]`,
  green: (s) => `[g]${s}[/g]`,
  cyan: (s) => `[c]${s}[/c]`
};
const fail: Result = {
  id: 'SEO001',
  category: 'seo',
  severity: 'critical',
  detection: { presence: 'none', value: 'absent' },
  route: '/',
  message: 'Missing <title>'
};

describe('console palette', () => {
  it('is identity by default (output unchanged)', () => {
    const out = formatConsoleReport([fail], config);
    expect(out).not.toContain('[');
    expect(out).toContain('✗ SEO001');
  });
  it('applies the palette to markers and severity titles when provided', () => {
    const out = formatConsoleReport([fail], config, { palette: mark });
    expect(out).toContain('[r]✗[/r]'); // failure marker red
    expect(out).toContain('[r]'); // critical title colored
    expect(out).toContain('[b]'); // header/title bold
  });
  it('scoreColor picks green/yellow/red by threshold', () => {
    expect(scoreColor(mark, 90)('9')).toBe('[g]9[/g]');
    expect(scoreColor(mark, 70)('7')).toBe('[y]7[/y]');
    expect(scoreColor(mark, 69)('6')).toBe('[r]6[/r]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @svelte-vitals/core test console-palette`
Expected: FAIL — `noColorPalette`/`scoreColor` not exported.

- [ ] **Step 3: Create the palette module**

Create `packages/core/src/reporter/palette.ts`:

```ts
/** String decorators for the console reporter. Injected so core stays pure/dep-free. */
export interface Palette {
  bold: (s: string) => string;
  dim: (s: string) => string;
  red: (s: string) => string;
  yellow: (s: string) => string;
  green: (s: string) => string;
  cyan: (s: string) => string;
}

/** Default: no decoration (identity) — output is byte-identical to plain text. */
export const noColorPalette: Palette = {
  bold: (s) => s,
  dim: (s) => s,
  red: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  cyan: (s) => s
};

/** Green ≥ 90, yellow ≥ 70, red otherwise — for a 0–100 score. */
export function scoreColor(p: Palette, score: number): (s: string) => string {
  if (score >= 90) return p.green;
  if (score >= 70) return p.yellow;
  return p.red;
}
```

- [ ] **Step 4: Apply the palette in `console.ts`**

In `packages/core/src/reporter/console.ts`:

Add the import at the top:

```ts
import { noColorPalette, scoreColor, type Palette } from './palette.js';
```

Add `palette` to the options interface:

```ts
export interface ConsoleReportOptions {
  byRoute?: boolean;
  /** Mode label shown in the header (default 'static mode'). */
  mode?: string;
  /** Color decorators; defaults to no color. */
  palette?: Palette;
}
```

Change `scoreLine` to take and apply the palette:

```ts
function scoreLine(p: Palette, label: string, { score, scoreModel }: ScoreResult): string {
  const parts = [`route avg ${scoreModel.routeAverage}`];
  if (scoreModel.sitePenalty > 0) parts.push(`site −${scoreModel.sitePenalty}`);
  if (scoreModel.criticalCap !== null) parts.push(`capped at ${scoreModel.criticalCap}: critical present`);
  return `${label} Score: ${scoreColor(p, score)(`${score}/100`)}   ${p.dim(`(${parts.join(' · ')})`)}`;
}
```

Change `byRouteTree` to take the palette and color the score + failure marker:

```ts
function byRouteTree(p: Palette, results: Result[], config: Config): string[] {
  const routes = new Map<string, Result[]>();
  for (const r of results) {
    if (r.route === undefined) continue;
    if (!routes.has(r.route)) routes.set(r.route, []);
    routes.get(r.route)!.push(r);
  }
  const lines: string[] = [p.bold('By route'), p.dim(RULE)];
  for (const [route, rs] of [...routes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { score } = computeScore(rs, config, { applyCriticalCap: false });
    lines.push(`${route.padEnd(28)} ${scoreColor(p, score)(`${score}`)}`);
    for (const r of rs.filter((x) => classify(x, config) === 'fail')) {
      lines.push(`    ${p.red('✗')} ${r.id}  ${r.message}`);
    }
  }
  lines.push('');
  return lines;
}
```

In `formatConsoleReport`, add `const p = options.palette ?? noColorPalette;` at the top, then color the header/sections. Replace the header + section-title + marker construction so it reads:

```ts
  const p = options.palette ?? noColorPalette;
  const summary = summarize(results, config);
  const { health, categories: byCat } = computeHealth(results, config);
  const present = CATEGORY_ORDER.filter((c) => byCat[c] !== undefined);
  const header: string[] = [
    p.bold(`Svelte Vitals  ·  ${options.mode ?? 'static mode'}`),
    '',
    `${p.bold('Health:')} ${scoreColor(p, health)(`${health}/100`)}`
  ];
  for (const c of present) {
    header.push(scoreLine(p, CATEGORY_LABEL[c] ?? c, byCat[c]!));
  }
  const lines: string[] = [...header, ''];

  const SEVERITY_COLOR: Record<Severity, (s: string) => string> = {
    critical: (s) => p.red(p.bold(s)),
    warning: (s) => p.yellow(p.bold(s)),
    info: (s) => p.dim(s)
  };

  const failures = results.filter((r) => classify(r, config) === 'fail');
  for (const severity of ['critical', 'warning', 'info'] as const) {
    const bucket = failures.filter((r) => effectiveSeverity(r, config) === severity);
    if (bucket.length === 0) continue;
    lines.push(SEVERITY_COLOR[severity](`${SEVERITY_TITLE[severity]} (${bucket.length})`), p.dim(RULE));
    for (const r of bucket) {
      lines.push(`${p.red('✗')} ${r.id}  ${r.message}`);
      if (r.route) lines.push(p.dim(`            ${r.route}`));
      if (r.location) lines.push(p.dim(`            ${r.location}${r.line ? `:${r.line}` : ''}`));
    }
    lines.push('');
  }

  const passed = results.filter((r) => classify(r, config) !== 'fail');
  if (passed.length > 0) {
    lines.push(p.bold(`Passed (${passed.length})`), p.dim(RULE));
    for (const r of passed) {
      const marker = classify(r, config) === 'dynamic' ? p.cyan('  ↯ dynamic') : '';
      const route = r.route ? `  ${r.route}` : '';
      lines.push(`${p.green('✓')} ${r.id}  ${r.message}${marker}${route}`);
    }
    lines.push('');
  }

  if (options.byRoute) lines.push(...byRouteTree(p, results, config));
  if (summary.dynamic > 0) lines.push(p.dim('↯ = set dynamically (verified at runtime).'));

  return lines.join('\n').replace(/\n+$/, '\n');
```

(The `SEVERITY_TITLE`, `CATEGORY_LABEL`, `CATEGORY_ORDER`, `RULE` constants and the early `import` lines are unchanged.)

- [ ] **Step 5: Export the palette API from core**

In `packages/core/src/index.ts`, next to the console reporter export (line ~90-91), add:

```ts
export { noColorPalette, scoreColor } from './reporter/palette.js';
export type { Palette } from './reporter/palette.js';
```

- [ ] **Step 6: Run the palette tests + the existing console tests + typecheck**

Run: `pnpm --filter @svelte-vitals/core test console`
Expected: PASS — new `console-palette` tests pass AND the pre-existing console reporter tests are unchanged (identity default).
Run: `pnpm --filter @svelte-vitals/core typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/reporter/palette.ts packages/core/src/reporter/console.ts packages/core/src/index.ts packages/core/test/console-palette.test.ts
git commit -m "feat(core): inject a Palette into the console reporter (identity default)"
```

---

### Task 2: CLI color palette + `--no-color` + tagline

**Files:**
- Create: `packages/cli/src/color.ts`
- Modify: `packages/cli/src/index.ts` (`RunOptions`; hoist reporter/env; console branch)
- Modify: `packages/cli/src/bin.ts` (`--no-color` flag; help)
- Test: `packages/cli/test/color.test.ts` (create)

**Interfaces:**
- Consumes: `Palette`, `noColorPalette` from `@svelte-vitals/core` (Task 1); `resolveReporter` (existing).
- Produces: `ansiPalette`, `colorEnabled(opts)`, `paletteFor(enabled)`; `RunOptions.noColor?`, `RunOptions.stdoutIsTTY?`.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/color.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { colorEnabled, paletteFor, ansiPalette } from '../src/color.js';

const base = { reporter: 'console', isTTY: true, env: {} as NodeJS.ProcessEnv };

describe('colorEnabled', () => {
  it('is on for a console reporter on a TTY', () => {
    expect(colorEnabled(base)).toBe(true);
  });
  it('is off when not a TTY', () => {
    expect(colorEnabled({ ...base, isTTY: false })).toBe(false);
  });
  it('is off for a non-console reporter', () => {
    expect(colorEnabled({ ...base, reporter: 'json' })).toBe(false);
  });
  it('is off when NO_COLOR is set', () => {
    expect(colorEnabled({ ...base, env: { NO_COLOR: '1' } })).toBe(false);
  });
  it('is off with --no-color', () => {
    expect(colorEnabled({ ...base, noColorFlag: true })).toBe(false);
  });
  it('FORCE_COLOR forces on even off-TTY', () => {
    expect(colorEnabled({ ...base, isTTY: false, env: { FORCE_COLOR: '1' } })).toBe(true);
  });
});

describe('paletteFor', () => {
  it('applies ANSI when enabled, identity when not', () => {
    expect(paletteFor(true).red('x')).toBe(ansiPalette.red('x'));
    expect(paletteFor(true).red('x')).toContain('\x1b[31m');
    expect(paletteFor(false).red('x')).toBe('x');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals test color`
Expected: FAIL — `../src/color.js` does not exist.

- [ ] **Step 3: Create `color.ts`**

Create `packages/cli/src/color.ts`:

```ts
import { noColorPalette, type Palette } from '@svelte-vitals/core';

const wrap =
  (open: number, close = 0) =>
  (s: string): string =>
    `\x1b[${open}m${s}\x1b[${close}m`;

/** Hand-rolled ANSI palette (no dependency). */
export const ansiPalette: Palette = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  yellow: wrap(33, 39),
  green: wrap(32, 39),
  cyan: wrap(36, 39)
};

/** Whether ANSI color is enabled, following the de-facto env conventions. */
export function colorEnabled(opts: {
  reporter: string;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
}): boolean {
  if (opts.noColorFlag) return false;
  if (opts.env.NO_COLOR !== undefined && opts.env.NO_COLOR !== '') return false;
  const fc = opts.env.FORCE_COLOR;
  if (fc !== undefined && fc !== '' && fc !== '0') return true;
  return opts.reporter === 'console' && opts.isTTY;
}

export const paletteFor = (enabled: boolean): Palette => (enabled ? ansiPalette : noColorPalette);
```

- [ ] **Step 4: Wire the palette into `run()`**

In `packages/cli/src/index.ts`:

Add to `RunOptions` (after `staged?: boolean;`):

```ts
  /** Disable ANSI color in console output. */
  noColor?: boolean;
  /** Override stdout TTY detection (tests). */
  stdoutIsTTY?: boolean;
  /** Override stderr TTY detection (tests). */
  stderrIsTTY?: boolean;
```

Add the import at the top of the file:

```ts
import { colorEnabled, paletteFor } from './color.js';
```

In `run()`, the console branch currently reads:

```ts
    } else {
      log(formatConsoleReport(results, config, { byRoute: opts.byRoute ?? false }));
    }
```

Replace with (uses the already-resolved `reporter` and `env` in that scope):

```ts
    } else {
      const colorOn = colorEnabled({
        reporter,
        isTTY: opts.stdoutIsTTY ?? !!process.stdout.isTTY,
        env,
        noColorFlag: opts.noColor
      });
      log(formatConsoleReport(results, config, { byRoute: opts.byRoute ?? false, palette: paletteFor(colorOn) }));
    }
```

- [ ] **Step 5: Add the `--no-color` flag and fix the tagline in `bin.ts`**

In `packages/cli/src/bin.ts`:

- Add `'no-color'` to the `boolean` array in the `mri` call.
- After computing `minHealth`, pass it through: change `const code = await run({ ...options, minHealth });` to `const code = await run({ ...options, minHealth, noColor: argv['no-color'] });`.
- In `HELP`, add a line under Options: `  --no-color                  Disable ANSI color in console output`.
- Change the first HELP line from `svelte-vitals — a SvelteKit SEO checker (static mode)` to:
  `svelte-vitals — a deterministic SvelteKit code-health scanner (SEO · performance · correctness · security · architecture)`

  (If `resolveArgs`/`resolve-args.ts` validates/whitelists known flags, add `no-color` there too so it isn't reported as unknown. Check `resolve-args.ts`; if it passes `argv` through untouched, no change is needed.)

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter svelte-vitals test color`
Expected: PASS.
Run: `pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals typecheck`
Expected: no errors (core rebuilt first — cli imports the new `Palette`/`noColorPalette` from core's dist).

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/color.ts packages/cli/src/index.ts packages/cli/src/bin.ts packages/cli/test/color.test.ts
git commit -m "feat(cli): colorize console output (gated on TTY/NO_COLOR); --no-color; fix tagline"
```

---

### Task 3: Analysis spinner

**Files:**
- Create: `packages/cli/src/spinner.ts`
- Modify: `packages/cli/src/index.ts` (wrap the analysis phase)
- Test: `packages/cli/test/spinner.test.ts` (create)

**Interfaces:**
- Consumes: `colorEnabled` (Task 2) for gating.
- Produces: `startSpinner(text, opts): Spinner`.

- [ ] **Step 1: Write the failing test**

Create `packages/cli/test/spinner.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { startSpinner } from '../src/spinner.js';

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('startSpinner', () => {
  it('writes nothing when disabled and returns a working stop()', () => {
    const { writes, stream } = fakeStream();
    const spin = startSpinner('Analyzing…', { enabled: false, stream });
    spin.stop();
    expect(writes).toEqual([]);
  });
  it('writes a frame immediately when enabled and clears on stop', () => {
    const { writes, stream } = fakeStream();
    const spin = startSpinner('Analyzing…', { enabled: true, stream });
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain('Analyzing…');
    spin.stop();
    expect(writes[writes.length - 1]).toContain('\x1b[K'); // clears the line
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals test spinner`
Expected: FAIL — `../src/spinner.js` does not exist.

- [ ] **Step 3: Create `spinner.ts`**

Create `packages/cli/src/spinner.ts`:

```ts
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface Spinner {
  stop(): void;
}

/** A minimal stderr spinner. When `enabled` is false it is a no-op. */
export function startSpinner(text: string, opts: { enabled: boolean; stream?: NodeJS.WriteStream }): Spinner {
  const stream = opts.stream ?? process.stderr;
  if (!opts.enabled) return { stop() {} };
  let i = 0;
  const tick = (): void => {
    stream.write(`\r${FRAMES[i % FRAMES.length]} ${text}`);
    i++;
  };
  tick();
  const timer = setInterval(tick, 80);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop() {
      clearInterval(timer);
      stream.write('\r\x1b[K');
    }
  };
}
```

- [ ] **Step 4: Wrap the analysis phase in `run()`**

In `packages/cli/src/index.ts`, `run()` currently resolves the reporter *after* `analyzeProject`. To gate the spinner (which runs *during* analysis) we resolve `env`/`reporter` up front.

Immediately after the `minHealth` validation block and before `let analysis: AnalyzeResult;`, add:

```ts
  const env = opts.env ?? process.env;
  const reporter = resolveReporter(opts.reporter, env);
  const spinnerEnabled =
    reporter === 'console' &&
    !isAutoDetectedAgent(opts.reporter, env) &&
    colorEnabled({
      reporter,
      isTTY: opts.stderrIsTTY ?? !!process.stderr.isTTY,
      env,
      noColorFlag: opts.noColor
    });
  const spinner = startSpinner('Analyzing…', { enabled: spinnerEnabled });
```

Add the import at the top: `import { startSpinner } from './spinner.js';`

In the analyze `try { … } catch (err) { … }` block, stop the spinner on both paths: add `spinner.stop();` as the **first line** of the `catch (err) {` block, and add `spinner.stop();` on the line **immediately after** the analyze `try/catch` (before `try { const { config, version } = analysis; …`).

Then, in the output section, the existing `const env = opts.env ?? process.env;` and `const reporter = resolveReporter(opts.reporter, env);` lines are now **duplicates** — delete those two lines (the hoisted `env`/`reporter` are in scope). The `isAutoDetectedAgent`/`isAutoDetectedGithub` warning emissions and everything else stay unchanged.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter svelte-vitals test spinner`
Expected: PASS.
Run: `pnpm --filter svelte-vitals typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/spinner.ts packages/cli/src/index.ts packages/cli/test/spinner.test.ts
git commit -m "feat(cli): stderr 'Analyzing…' spinner during static analysis (TTY-gated)"
```

---

### Task 4: Changeset + full verification

**Files:**
- Create: `.changeset/cli-rich-console.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/cli-rich-console.md`:

```md
---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

Rich console output: the default `console` reporter now colorizes the Health/category
scores, severity sections, and pass/fail markers, and shows an "Analyzing…" spinner
during the scan. All of it auto-disables under `NO_COLOR`, a non-TTY stdout, a
non-`console` reporter, or `--no-color` (and honors `FORCE_COLOR`). Color is an
injected `Palette` (identity by default), so `@svelte-vitals/core` stays
dependency-free and other reporters are unchanged.
```

- [ ] **Step 2: Full verification**

Run:
```bash
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm --filter docs build
```
Expected: all green. Core test count rises by 3 (`console-palette`); cli by ~8 (`color` + `spinner`).

- [ ] **Step 3: If lint reports formatting, fix and re-run**

Run: `pnpm exec prettier --write . && pnpm lint`
Expected: clean.

- [ ] **Step 4: Manual smoke check (optional, informative)**

Run: `node packages/cli/dist/bin.js --help` (confirm the new tagline + `--no-color`).
Run the CLI against a fixture with a TTY to eyeball colors; `NO_COLOR=1 …` and `… | cat` to confirm color/spinner disappear. (Informational; not a gating test.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: changeset for rich console output"
```

---

## Self-Review

**Spec coverage:**
- Palette injection, identity default, `scoreColor` thresholds → Task 1. ✓
- Color applied to health/category/severity/markers/dividers → Task 1 Step 4. ✓
- CLI ANSI palette + `colorEnabled` gating (TTY/NO_COLOR/FORCE_COLOR/reporter/--no-color) → Task 2. ✓
- `--no-color` flag + tagline fix → Task 2 Step 5. ✓
- stderr spinner, gated, `setInterval` (no Date.now), stop on all paths → Task 3. ✓
- core stays dep-free (color injected; ANSI only in CLI) → Tasks 1-2. ✓
- No existing assertion loosened (identity default) → Task 1 Step 6. ✓
- Changeset (core + cli minor) → Task 4. ✓
- Out of scope (install wizard = sub-project B; themes; truecolor) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `Palette` defined in Task 1, imported by Task 2's `color.ts`. `colorEnabled` signature identical in Task 2 def, its test, and Task 3's spinner gating. `paletteFor`/`ansiPalette`/`noColorPalette` consistent. `RunOptions.noColor`/`stdoutIsTTY`/`stderrIsTTY` added in Task 2/3 and consumed in the console branch/spinner gating. ✓
