# CLI rich console output (colors + hierarchy + spinner)

**Date:** 2026-07-03
**Status:** Draft — awaiting review (author away mid-brainstorm; sensible defaults chosen, flagged below)
**Packages:** `@svelte-vitals/core` (console reporter — palette injection), `@svelte-vitals/cli` (real palette, gating, spinner, flags)

## Context

Sub-project **A** of "catch up to [react.doctor](https://www.react.doctor/)'s interactive & rich CLI." svelte-vitals already matches react.doctor on features (0–100 Health score; SEO/Performance/Correctness/Security/Architecture categories; `--diff`/`--staged`/`--min-health`/`--rules`/`--ignore`; json/github/sarif/agent reporters; MCP; rule docs). The real gaps are UX:

- **A (this spec): rich console output** — the console reporter is currently plain text (no ANSI color, no visual hierarchy, no progress indicator).
- **B (next sub-project): interactive `init`/`install` wizard** — agent (Claude Code/Cursor/Codex) + MCP setup. Separate spec.

The user chose "both, A → B order"; this spec covers A only.

## Goal

Make the default `--reporter console` output visually rich — severity/score/category **colors**, a clearer **visual hierarchy**, and an **"Analyzing…" spinner** during the scan — while (1) keeping `@svelte-vitals/core` **pure and dependency-free**, (2) auto-disabling all of it under non-TTY / `NO_COLOR` / non-console reporters / CI-agent, and (3) not loosening any existing test.

## Open decisions (chosen by best-judgment; adjust at review)

1. **Scope = color + hierarchy + spinner** (the fullest "rich"). The spinner is the most separable piece — if undesired, drop §4 and its tests; the rest stands alone.
2. **No new dependency** — hand-roll a tiny ANSI helper and spinner in the CLI (the repo is dep-minimal: core is dep-free, CLI uses only `mri`). Alternative: `picocolors` (0-dep, battle-tested TTY/NO_COLOR handling) — swap in if preferred.

## Design

### 1. Palette injection (keeps core pure & dep-free)

Color must not make the core reporter impure or dependency-bearing. Inject a **palette** of string→string functions; default to identity.

New `packages/core/src/reporter/palette.ts`:

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

/** Default: no decoration (identity) — output is byte-identical to today. */
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

`formatConsoleReport` (in `console.ts`) gains one option:

```ts
export interface ConsoleReportOptions {
  byRoute?: boolean;
  mode?: string;
  palette?: Palette; // default noColorPalette
}
```

Apply the palette at these spots (all via `const p = options.palette ?? noColorPalette`):

- Header `Svelte Vitals · <mode>` → `p.bold`.
- `Health: N/100` → the number via `scoreColor(p, health)`, label `p.bold`.
- Each category `… Score: N/100` → the number via `scoreColor(p, score)`.
- Severity section titles: `Critical (n)` → `p.red`+`p.bold`; `Warnings (n)` → `p.yellow`+`p.bold`; `Info (n)` → `p.dim`.
- Finding marker `✗` → `p.red`; passed `✓` → `p.green`; `↯ dynamic` → `p.cyan`.
- `RULE` dividers and the `location`/`route` sub-lines → `p.dim`.
- `by-route` tree: score via `scoreColor`, `✗` red.

Because the default is identity, **every existing console test stays green unchanged** (they call `formatConsoleReport` without a palette).

### 2. CLI real palette + gating

New `packages/cli/src/color.ts` (hand-rolled ANSI, no dep):

```ts
import { noColorPalette, type Palette } from '@svelte-vitals/core';

const wrap = (open: number, close = 0) => (s: string) => `\x1b[${open}m${s}\x1b[${close}m`;
const ansiPalette: Palette = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  yellow: wrap(33, 39),
  green: wrap(32, 39),
  cyan: wrap(36, 39)
};

/** Decide whether ANSI color is enabled, following the de-facto env conventions. */
export function colorEnabled(opts: {
  reporter: string;
  isTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
}): boolean {
  if (opts.noColorFlag) return false;
  if (opts.env.NO_COLOR !== undefined && opts.env.NO_COLOR !== '') return false;
  if (opts.env.FORCE_COLOR !== undefined && opts.env.FORCE_COLOR !== '' && opts.env.FORCE_COLOR !== '0') return true;
  return opts.reporter === 'console' && opts.isTTY;
}

export const paletteFor = (enabled: boolean): Palette => (enabled ? ansiPalette : noColorPalette);
```

`Palette`, `noColorPalette`, `scoreColor` are re-exported from `@svelte-vitals/core`'s index.

`run()` (in `packages/cli/src/index.ts`), console branch: compute `enabled = colorEnabled({ reporter, isTTY: !!process.stdout.isTTY, env, noColorFlag: opts.noColor })` and pass `{ byRoute, palette: paletteFor(enabled) }` to `formatConsoleReport`. Add `noColor?: boolean` to `RunOptions` (and a `stdoutIsTTY?: boolean` override for tests, mirroring the existing `env` override).

### 3. `--no-color` flag + help tagline

In `bin.ts`:

- Add `no-color` to the boolean flags; pass `noColor: argv['no-color']` into `run`.
- Document `--no-color` in help.
- Fix the stale tagline: `svelte-vitals — a SvelteKit SEO checker (static mode)` → `svelte-vitals — a deterministic SvelteKit code-health scanner (SEO · performance · correctness · security · architecture)`.

### 4. Spinner (separable)

New `packages/cli/src/spinner.ts` (hand-rolled, writes to **stderr** so stdout/piped output stays clean):

```ts
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface Spinner {
  stop(): void;
}

/** A minimal stderr spinner. No-op (returns a stop()) when not enabled. */
export function startSpinner(text: string, opts: { enabled: boolean; stream?: NodeJS.WriteStream }): Spinner {
  const stream = opts.stream ?? process.stderr;
  if (!opts.enabled) return { stop() {} };
  let i = 0;
  const tick = () => stream.write(`\r${FRAMES[i++ % FRAMES.length]} ${text}`);
  tick();
  const timer = setInterval(tick, 80);
  return {
    stop() {
      clearInterval(timer);
      stream.write('\r\x1b[K'); // clear the line
    }
  };
}
```

Enable only when: `reporter === 'console'` AND `process.stderr.isTTY` AND color is enabled (same env gating) AND not an auto-detected agent env. In `run()`, wrap the analysis phase: `const spin = startSpinner('Analyzing…', { enabled }); try { …collect+check… } finally { spin.stop(); }`, stopping before any output is printed. Note: `Date.now()`-free (uses `setInterval`); no timestamps.

### 5. Non-goals for this spec

- No change to json/agent/sarif/github/html reporters (they never get a palette or spinner).
- No box-drawing/table layout rework beyond the existing line structure (YAGNI).
- The `init`/`install` wizard is sub-project **B** (separate spec).

## Testing

- **core** (`console` reporter): existing tests unchanged (identity default). New: with a **marker palette** (e.g. `bold: s => `[b]${s}[/b]``, `red: s => `[r]${s}[/r]``), assert the Health number, `Critical` title, and `✗` carry the expected markers; `scoreColor` returns green/yellow/red fn at 90/70 boundaries.
- **cli**: `colorEnabled` truth table — `--no-color` off; `NO_COLOR` off; `FORCE_COLOR` on; console+TTY on; non-TTY off; non-console reporter off. `startSpinner({enabled:false})` writes nothing and returns a working `stop()`; enabled writes frames to the injected stream and `stop()` clears.
- Full suite + typecheck + lint + `docs build` green; no assertions loosened.

## Out of scope (YAGNI / deferred)

- Sub-project **B**: interactive `init`/`install` wizard (agent + MCP setup).
- Configurable color themes; 256-color/truecolor; hyperlink escapes (OSC 8).
- A watch/TUI mode (the vite live UI already covers browser-based live viewing).
