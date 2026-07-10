# CLI Mascot Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `svelte-vitals`' CLI a small hand-drawn mascot that (1) replaces
the braille spinner during analysis with an idle blink loop, and (2) reacts
with one of five poses at the Health-score reveal — plus a confetti bonus
for a perfect 100 — so the reveal moment reads as a short, legible,
shareable video clip.

**Architecture:** A new `packages/cli/src/mascot.ts` module owns all mascot
data (frame strings, the pure `(score, hasCritical) => MascotState`
function) and rendering (via the new `log-update` dependency, replacing the
hand-rolled ANSI cursor-math redraw). `spinner.ts` stays untouched as the
fallback when the mascot is disabled. `pulse-animation.ts` is extended
in-place to hand off to the mascot's reaction render on its final frame.

**Tech Stack:** `log-update` (sindresorhus, MIT, ESM, requires Node >=22 —
matches this repo's existing `>=22.13.0` floor exactly). Every other line of
the mascot itself (frame art, state logic, confetti) is hand-authored, zero
additional dependencies.

## Global Constraints

- **Scope:** `packages/cli` only. No `@svelte-vitals/core` changes — the
  mascot never appears in any reporter's output besides the console
  reporter's interactive TTY path.
- **`--no-animation` is the only switch.** No new CLI flag. It now also
  gates the analysis-phase mascot (previously it only affected the
  score-reveal animation) — when set, or when `spinnerEnabled`/
  `scoreAnimationEnabled`'s existing conditions are false, or the terminal
  is narrower than 40 columns, the CLI falls back to today's plain braille
  spinner / plain pulse animation. The progress indicator itself is never
  removed — only the mascot specifically is.
- **Narrow-terminal fallback:** below 40 columns, skip the mascot art
  entirely (pulse-only / braille-only), not just shrink it.
- **No RNG anywhere** (confetti included) — every frame is deterministic,
  so tests and repeated recordings are reproducible.
- **The mascot has no name**, anywhere — not in code comments' prose
  (identifiers use the functional term `mascot`), not in CLI output, not in
  docs. This is intentional (see the design spec's "Naming / branding
  stance").
- **Every dependency is catalog-pinned** (`pnpm-workspace.yaml`'s
  `catalog:` block) with no exceptions in this repo — `log-update` follows
  that convention.
- **Changeset required** (user-facing CLI behavior change) — minor bump for
  `svelte-vitals` only; `@svelte-vitals/core` is untouched.
- Full spec: `docs/superpowers/specs/2026-07-10-cli-mascot-animation-design.md`.

## File Structure

- `packages/cli/src/mascot.ts` (new) — `MascotState` type, `mascotStateFor`
  (pure state-selection function), `mascotFitsWidth`, frame-rendering
  functions (idle/anticipating/reaction/confetti), and
  `startMascotSpinner` (the analysis-phase render loop, `log-update`-based).
- `packages/cli/src/spinner.ts` — unchanged, kept as the braille fallback.
- `packages/cli/src/pulse-animation.ts` — `playScoreAnimation` extended to
  take `hasCritical`, render the mascot (via `mascot.ts`) alongside the
  wave/score, and play the confetti bonus on a perfect score; its redraw
  mechanism switches from hand-rolled `\x1b[2A` math to `log-update`.
  `scoreAnimationEnabled` is unchanged.
- `packages/cli/src/index.ts` — analysis-phase spinner selection now
  chooses between `startMascotSpinner` and `startSpinner`; score-reveal
  call site computes and passes `hasCritical`; `RunOptions` gains a
  `stderrStream` override (mirrors the existing `stdoutStream`, for tests).
- `packages/cli/package.json`, `pnpm-workspace.yaml` — new `log-update`
  catalog dependency.
- `packages/cli/test/mascot.test.ts` (new), `packages/cli/test/pulse-animation.test.ts`,
  `packages/cli/test/run.test.ts` — test coverage for all of the above.
- `packages/cli/README.md`, `docs/src/content/docs/guides/cli.md` (en/ja) —
  document the mascot and its two appearances.
- `.changeset/*.md` (new).

---

### Task 1: Add the `log-update` dependency

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `packages/cli/package.json`

**Interfaces:**

- Consumes: nothing.
- Produces: `log-update`'s `createLogUpdate(stream, options?)` export,
  consumed by Task 2.

- [ ] **Step 1: Add to the catalog**

In `pnpm-workspace.yaml`, add to the `catalog:` block (alphabetical, next to
the existing entries — find `tinyglobby: ^0.2.17` and insert nearby):

```yaml
log-update: ^8.0.0
```

- [ ] **Step 2: Add to `packages/cli/package.json`**

Add to `dependencies` (alphabetical position):

```json
    "log-update": "catalog:",
```

- [ ] **Step 3: Install and verify**

```bash
pnpm install --frozen-lockfile
```

Expected: succeeds, `pnpm-lock.yaml` updates, no other package's
dependencies change.

```bash
node -e "import('log-update').then(m => console.log(typeof m.createLogUpdate))" --input-type=module
```

Run from `packages/cli/`. Expected: prints `function`.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml packages/cli/package.json pnpm-lock.yaml
git commit -m "chore(cli): add log-update dependency for the mascot animation"
```

---

### Task 2: `packages/cli/src/mascot.ts` — state, art, and rendering

**Files:**

- Create: `packages/cli/src/mascot.ts`
- Test: `packages/cli/test/mascot.test.ts`

**Interfaces:**

- Consumes: `Palette` from `@svelte-vitals/core` (already used by
  `pulse-animation.ts`); `createLogUpdate` from `log-update` (Task 1).
- Produces: `MascotState`, `mascotStateFor(score, hasCritical)`,
  `mascotFitsWidth(columns)`, `renderMascotIdleFrame(frameIndex, palette)`,
  `renderMascotAnticipating(palette)`, `renderMascotReaction(state, palette)`,
  `renderConfettiFrame(offset, mascotBlock, palette)`, `startMascotSpinner`
  (+ `MascotSpinner` interface) — all consumed by Task 3 (analysis phase)
  and Task 4 (score-reveal phase).

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/mascot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  mascotStateFor,
  mascotFitsWidth,
  renderMascotIdleFrame,
  renderMascotAnticipating,
  renderMascotReaction,
  renderConfettiFrame,
  startMascotSpinner
} from '../src/mascot.js';
import { noColorPalette, ansiPalette } from '../src/color.js';

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('mascotStateFor', () => {
  it('is ecstatic at exactly 100', () => {
    expect(mascotStateFor(100, false)).toBe('ecstatic');
  });
  it('is happy from 90 up to (not including) 100', () => {
    expect(mascotStateFor(90, false)).toBe('happy');
    expect(mascotStateFor(99, false)).toBe('happy');
  });
  it('is alarmed whenever a critical finding is present, regardless of score, below 90', () => {
    expect(mascotStateFor(79, true)).toBe('alarmed');
    expect(mascotStateFor(0, true)).toBe('alarmed');
  });
  it('is content from 70 to 89 with no critical finding', () => {
    expect(mascotStateFor(70, false)).toBe('content');
    expect(mascotStateFor(89, false)).toBe('content');
  });
  it('is discouraged below 70 with no critical finding', () => {
    expect(mascotStateFor(69, false)).toBe('discouraged');
    expect(mascotStateFor(0, false)).toBe('discouraged');
  });
  it('a critical finding at a boundary still reads as alarmed, not content/discouraged', () => {
    expect(mascotStateFor(80, true)).toBe('alarmed');
    expect(mascotStateFor(69, true)).toBe('alarmed');
  });
});

describe('mascotFitsWidth', () => {
  it('fits at 80 columns (the default) and anything at or above 40', () => {
    expect(mascotFitsWidth(80)).toBe(true);
    expect(mascotFitsWidth(40)).toBe(true);
  });
  it('does not fit below 40 columns', () => {
    expect(mascotFitsWidth(39)).toBe(false);
    expect(mascotFitsWidth(1)).toBe(false);
  });
  it('treats an unknown width (undefined columns) as fitting (defaults to 80)', () => {
    expect(mascotFitsWidth(undefined)).toBe(true);
  });
});

describe('mascot rendering', () => {
  it('renders 4-line frames for idle, anticipating, and every reaction state', () => {
    expect(renderMascotIdleFrame(0, noColorPalette).split('\n')).toHaveLength(4);
    expect(renderMascotAnticipating(noColorPalette).split('\n')).toHaveLength(4);
    for (const state of ['ecstatic', 'happy', 'alarmed', 'content', 'discouraged'] as const) {
      expect(renderMascotReaction(state, noColorPalette).split('\n')).toHaveLength(4);
    }
  });
  it('the idle frame alternates an open-eyed and a blinking face', () => {
    const open = renderMascotIdleFrame(0, noColorPalette);
    const blink = renderMascotIdleFrame(4, noColorPalette); // index 4 is the blink in the 5-tick cycle
    expect(open).not.toBe(blink);
  });
  it('colors the reaction face with the palette (ansiPalette produces ANSI codes, noColorPalette does not)', () => {
    const colored = renderMascotReaction('happy', ansiPalette);
    const plain = renderMascotReaction('happy', noColorPalette);
    expect(colored).toContain('\x1b[32m'); // green
    expect(plain).not.toContain('\x1b[');
  });
  it('alarmed and discouraged both render red; content renders yellow; ecstatic/happy render green', () => {
    expect(renderMascotReaction('alarmed', ansiPalette)).toContain('\x1b[31m');
    expect(renderMascotReaction('discouraged', ansiPalette)).toContain('\x1b[31m');
    expect(renderMascotReaction('content', ansiPalette)).toContain('\x1b[33m');
    expect(renderMascotReaction('ecstatic', ansiPalette)).toContain('\x1b[32m');
    expect(renderMascotReaction('happy', ansiPalette)).toContain('\x1b[32m');
  });
  it('confetti wraps the given mascot block with a particle row above and below, deterministically', () => {
    const mascotBlock = renderMascotReaction('ecstatic', noColorPalette);
    const frame = renderConfettiFrame(0, mascotBlock, noColorPalette);
    const lines = frame.split('\n');
    expect(lines).toHaveLength(6); // 1 confetti row + 4 mascot lines + 1 confetti row
    expect(lines[0]).not.toBe(''); // top confetti row has content
    expect(lines[lines.length - 1]).not.toBe('');
    // Deterministic: same offset always produces the same row (no RNG).
    expect(renderConfettiFrame(0, mascotBlock, noColorPalette)).toBe(frame);
  });
});

describe('startMascotSpinner', () => {
  it('writes nothing when disabled and returns a working stop()', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: false, palette: noColorPalette, stream });
    spin.stop();
    expect(writes).toEqual([]);
  });
  it('writes a frame immediately when enabled, containing the status text', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, palette: noColorPalette, stream });
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain('Analyzing…');
    spin.stop();
  });
  it('clears the block on stop (no leftover mascot art)', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, palette: noColorPalette, stream });
    spin.stop();
    const last = writes[writes.length - 1]!;
    expect(last).not.toContain('Analyzing…');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- mascot`
Expected: FAIL — `../src/mascot.js` does not exist yet.

- [ ] **Step 3: Implement `packages/cli/src/mascot.ts`**

```ts
import type { Palette } from '@svelte-vitals/core';
import { createLogUpdate } from 'log-update';

export type MascotState = 'ecstatic' | 'happy' | 'alarmed' | 'content' | 'discouraged';

/**
 * Reaction state for the score-reveal pose, evaluated in this exact order (design:
 * docs/superpowers/specs/2026-07-10-cli-mascot-animation-design.md). Note that
 * `CRITICAL_CAP` in packages/core/src/scoring/score.ts caps any score with a critical
 * finding at <=79, so 'ecstatic'/'happy' and hasCritical:true can never both hold in
 * practice — this function still checks in the stated order for clarity, not because
 * the branches can collide.
 */
export function mascotStateFor(score: number, hasCritical: boolean): MascotState {
  if (score === 100) return 'ecstatic';
  if (score >= 90) return 'happy';
  if (hasCritical) return 'alarmed';
  if (score >= 70) return 'content';
  return 'discouraged';
}

const MIN_MASCOT_COLUMNS = 40;

/** Whether the terminal is wide enough for the mascot art; below this, callers fall back to a plain (mascot-free) animation. */
export function mascotFitsWidth(columns: number | undefined): boolean {
  return (columns ?? 80) >= MIN_MASCOT_COLUMNS;
}

// Svelte's brand accent (#ff3e00) as 24-bit truecolor. Mascot-only: not part of the
// shared core Palette (packages/core/src/reporter/palette.ts), which core's console
// reporter never uses this mascot in, so it never needs an 'orange' entry.
const svelteOrange = (s: string): string => `\x1b[38;2;255;62;0m${s}\x1b[39m`;

const TOP = ' .---. ';
const TOP_ARMS_UP = '\\.---./';
const BOTTOM = " '---' ";

function renderFace(top: string, eyes: string, mouth: string, faceColor: (s: string) => string): string {
  return [
    svelteOrange(top),
    svelteOrange('(') + faceColor(eyes) + svelteOrange(')'),
    svelteOrange(' \\') + faceColor(mouth) + svelteOrange('/ '),
    svelteOrange(BOTTOM)
  ].join('\n');
}

// Mostly-open with a brief blink, matching a ~1s full cycle at IDLE_TICK_MS (160ms x 5 = 800ms).
const IDLE_FRAME_SEQUENCE = [0, 0, 0, 0, 1];

/** One frame of the analysis-phase idle loop. `frameIndex` is taken mod the sequence length. */
export function renderMascotIdleFrame(frameIndex: number, palette: Palette): string {
  const isBlink = IDLE_FRAME_SEQUENCE[frameIndex % IDLE_FRAME_SEQUENCE.length] === 1;
  return renderFace(TOP, isBlink ? ' -   - ' : ' o   o ', '  ---  ', palette.cyan);
}

/** The neutral "watching the score count up" pose shown before the reveal cut. */
export function renderMascotAnticipating(palette: Palette): string {
  return renderFace(TOP, ' o   o ', '   o   ', palette.dim);
}

const REACTION_FACES: Record<
  MascotState,
  { top: string; eyes: string; mouth: string; colorKey: 'green' | 'yellow' | 'red' }
> = {
  ecstatic: { top: TOP_ARMS_UP, eyes: ' ^   ^ ', mouth: '  \\_/  ', colorKey: 'green' },
  happy: { top: TOP, eyes: ' ^   ^ ', mouth: '  \\_/  ', colorKey: 'green' },
  alarmed: { top: TOP, eyes: ' O   O ', mouth: '   o   ', colorKey: 'red' },
  content: { top: TOP, eyes: ' o   o ', mouth: '  ---  ', colorKey: 'yellow' },
  discouraged: { top: TOP, eyes: ' -   - ', mouth: '  ,-,  ', colorKey: 'red' }
};

/** The settled pose for the given reaction state — the "payoff" frame of the reveal. */
export function renderMascotReaction(state: MascotState, palette: Palette): string {
  const f = REACTION_FACES[state];
  return renderFace(f.top, f.eyes, f.mouth, palette[f.colorKey]);
}

const CONFETTI_CHARS = ['*', '.', '·', '+'];
const CONFETTI_WIDTH = 24;

function confettiRow(offset: number, palette: Palette): string {
  const colors: Array<(s: string) => string> = [palette.green, palette.yellow, palette.cyan, palette.red];
  let out = '';
  for (let col = 0; col < CONFETTI_WIDTH; col++) {
    if ((col + offset) % 5 === 0) {
      const glyph = CONFETTI_CHARS[(col + offset) % CONFETTI_CHARS.length]!;
      out += colors[(col + offset) % colors.length]!(glyph);
    } else {
      out += ' ';
    }
  }
  return out;
}

/**
 * Wraps `mascotBlock` (a `renderMascotReaction` output) with a particle row above and
 * below. `offset` shifts the deterministic particle pattern between successive calls
 * for a "twinkling" effect — no RNG, so the same offset always renders the same frame.
 */
export function renderConfettiFrame(offset: number, mascotBlock: string, palette: Palette): string {
  return [confettiRow(offset, palette), mascotBlock, confettiRow(offset + 2, palette)].join('\n');
}

export interface MascotSpinner {
  stop(): void;
}

const IDLE_TICK_MS = 160;

/**
 * The analysis-phase progress indicator: a small idle-blink loop rendered via
 * `log-update` (chosen over spinner.ts's hand-rolled `\x1b[nA` redraw specifically
 * because it correctly tracks wrapped/actual line count — see the design spec's
 * "Library decision"). Mirrors `startSpinner`'s `{enabled, stream}` contract and
 * no-op-when-disabled behavior exactly, so callers can use either interchangeably.
 */
export function startMascotSpinner(
  text: string,
  opts: { enabled: boolean; palette: Palette; stream?: NodeJS.WriteStream }
): MascotSpinner {
  if (!opts.enabled) return { stop() {} };
  const stream = opts.stream ?? process.stderr;
  const render = createLogUpdate(stream);
  let i = 0;
  const tick = (): void => {
    render(`${renderMascotIdleFrame(i, opts.palette)}\n${text}`);
    i++;
  };
  tick();
  const timer = setInterval(tick, IDLE_TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    stop() {
      clearInterval(timer);
      render.clear();
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- mascot`
Expected: PASS.

- [ ] **Step 5: Visual sanity check**

There is no automated check for "does the art look right" (matching this
project's existing stance for `pulse-animation.ts`'s `WAVE_FRAMES` and
`spinner.ts`'s braille frames). From a real interactive terminal:

```bash
node -e "
import('./dist/mascot.js').then(async (m) => {
  const { noColorPalette, ansiPalette } = await import('./dist/color.js');
  for (const s of ['ecstatic','happy','alarmed','content','discouraged']) {
    console.log('---', s, '---');
    console.log(m.renderMascotReaction(s, ansiPalette));
  }
});
" --input-type=module
```

(Run `pnpm --filter svelte-vitals build` first so `dist/` exists.) Expected:
five clearly-differentiated 4-line faces, orange body, face color matching
the state (green/green/red/yellow/red for
ecstatic/happy/alarmed/content/discouraged respectively).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/mascot.ts packages/cli/test/mascot.test.ts
git commit -m "feat(cli): add the mascot module (state selection, art, log-update rendering)"
```

---

### Task 3: Wire the mascot into the analysis phase

**Files:**

- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/run.test.ts`

**Interfaces:**

- Consumes: `startMascotSpinner`, `mascotFitsWidth` (Task 2);
  `startSpinner` (existing, `spinner.ts`, unchanged); `spinnerEnabled`
  (existing, unchanged conditions).
- Produces: nothing new (behavior change only).

- [ ] **Step 1: Write the failing tests**

Add to `packages/cli/test/run.test.ts`, inside (or near) the existing
`describe('run() --verbose and animation', ...)` block:

```ts
it('shows the mascot idle loop on stderr during analysis on a wide interactive terminal', async () => {
  const cap = capture();
  const stderrWrites: string[] = [];
  const stderrStream = { write: (s: string) => stderrWrites.push(s) } as unknown as NodeJS.WriteStream;
  await run({
    cwd: fixtureDir,
    log: cap.log,
    errorLog: cap.errorLog,
    env: CLEAN_ENV,
    stderrIsTTY: true,
    stderrStream,
    stdoutIsTTY: false // isolate: only exercise the analysis-phase mascot here
  });
  expect(stderrWrites.length).toBeGreaterThan(0);
  // The mascot's orange truecolor escape is a reliable "this is mascot art, not the
  // plain braille spinner" marker — the braille spinner never emits color.
  expect(stderrWrites.join('')).toContain('\x1b[38;2;255;62;0m');
});

it('falls back to the plain braille spinner when --no-animation is set, even on a wide interactive terminal', async () => {
  const cap = capture();
  const stderrWrites: string[] = [];
  const stderrStream = { write: (s: string) => stderrWrites.push(s) } as unknown as NodeJS.WriteStream;
  await run({
    cwd: fixtureDir,
    log: cap.log,
    errorLog: cap.errorLog,
    env: CLEAN_ENV,
    stderrIsTTY: true,
    stderrStream,
    stdoutIsTTY: false,
    noAnimation: true
  });
  expect(stderrWrites.length).toBeGreaterThan(0); // a progress indicator still shows...
  expect(stderrWrites.join('')).not.toContain('\x1b[38;2;255;62;0m'); // ...just not the mascot
});

it('falls back to the plain braille spinner on a narrow terminal', async () => {
  const cap = capture();
  const stderrWrites: string[] = [];
  const stderrStream = { write: (s: string) => stderrWrites.push(s) } as unknown as NodeJS.WriteStream;
  Object.defineProperty(stderrStream, 'columns', { value: 30 });
  await run({
    cwd: fixtureDir,
    log: cap.log,
    errorLog: cap.errorLog,
    env: CLEAN_ENV,
    stderrIsTTY: true,
    stderrStream,
    stdoutIsTTY: false
  });
  expect(stderrWrites.join('')).not.toContain('\x1b[38;2;255;62;0m');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- run`
Expected: FAIL — `stderrStream` is not a recognized `RunOptions` field yet
(TypeScript error) and the mascot never renders.

- [ ] **Step 3: Add `stderrStream` to `RunOptions` and wire the mascot choice**

In `packages/cli/src/index.ts`, add to the `RunOptions` interface (near the
existing `stdoutStream`):

```ts
  /** Override the stream the analysis-phase progress indicator writes to (tests). Defaults to process.stderr. */
  stderrStream?: NodeJS.WriteStream;
```

Add the import:

```ts
import { startMascotSpinner, mascotFitsWidth } from './mascot.js';
```

Replace the spinner-selection block:

```ts
const spinner = startSpinner('Analyzing…', {
  enabled:
    !opts.score &&
    spinnerEnabled({
      reporter,
      rawReporter: opts.reporter,
      stderrIsTTY: opts.stderrIsTTY ?? !!process.stderr.isTTY,
      env,
      noColorFlag: opts.noColor
    })
});
```

with:

```ts
const stderrStream = opts.stderrStream ?? process.stderr;
const spinnerBaseEnabled =
  !opts.score &&
  spinnerEnabled({
    reporter,
    rawReporter: opts.reporter,
    stderrIsTTY: opts.stderrIsTTY ?? !!process.stderr.isTTY,
    env,
    noColorFlag: opts.noColor
  });
const useMascotSpinner = spinnerBaseEnabled && !opts.noAnimation && mascotFitsWidth(stderrStream.columns);
const spinner = useMascotSpinner
  ? startMascotSpinner('Analyzing…', { enabled: true, palette: paletteFor(true), stream: stderrStream })
  : startSpinner('Analyzing…', { enabled: spinnerBaseEnabled, stream: stderrStream });
```

Notes:

- `spinnerBaseEnabled` unchanged in meaning from before (same conditions,
  just hoisted to a named variable so it's reusable for the fallback
  branch).
- `paletteFor(true)` for the mascot spinner: `spinnerBaseEnabled` already
  implies `colorEnabled(...)` was true (see `spinnerEnabled`'s own body —
  it calls `colorEnabled` internally), so color is always on whenever
  `useMascotSpinner` is true; no need to recompute `colorOn` here.
- `mascotFitsWidth(stderrStream.columns)`: read `.columns` directly, with
  **no** `opts.stderrIsTTY ? ... : undefined` guard. That guard looks
  reasonable but is a real bug: in production `opts.stderrIsTTY` is never
  set by a caller (it exists purely for tests), so a guard keyed on it
  would read `undefined` — and therefore "fits" — on every real run
  regardless of actual terminal width, silently disabling the
  narrow-terminal fallback outside of tests. `.columns` is simply
  `undefined` on any non-TTY stream already (Node only sets it on real
  TTYs), so reading it unconditionally is both simpler and correct.
- The braille-spinner fallback branch now takes `stderrStream` too
  (previously always `process.stderr` implicitly) — this is what makes
  Task 3's second and third new tests able to observe it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- run`
Expected: PASS.

- [ ] **Step 5: Run the full CLI test suite**

Run: `pnpm --filter svelte-vitals test`
Expected: PASS — including all pre-existing spinner/run tests, unaffected
by this change's default behavior (nothing changes for `CLEAN_ENV` +
non-TTY, which most existing tests use).

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/test/run.test.ts
git commit -m "feat(cli): show the mascot idle loop during analysis, replacing the spinner"
```

---

### Task 4: Wire the mascot and confetti into the score-reveal phase

**Files:**

- Modify: `packages/cli/src/pulse-animation.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/test/pulse-animation.test.ts`

**Interfaces:**

- Consumes: `mascotStateFor`, `mascotFitsWidth`, `renderMascotAnticipating`,
  `renderMascotReaction`, `renderConfettiFrame` (Task 2); `summarize` from
  `@svelte-vitals/core` (already imported in `index.ts`).
- Produces: `playScoreAnimation`'s new `hasCritical` parameter — its only
  caller is `index.ts`, updated in the same task.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `packages/cli/test/pulse-animation.test.ts`
with:

```ts
import { describe, it, expect } from 'vitest';
import { scoreAnimationEnabled, playScoreAnimation } from '../src/pulse-animation.js';
import { noColorPalette, ansiPalette } from '../src/color.js';

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('scoreAnimationEnabled', () => {
  const base = {
    reporter: 'console' as const,
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
  it('is off in a detected agent env, even when console is requested explicitly', () => {
    expect(scoreAnimationEnabled({ ...base, env: { CLAUDECODE: '1' } })).toBe(false);
  });
  it('is off in CI, even on an allocated TTY', () => {
    expect(scoreAnimationEnabled({ ...base, env: { CI: 'true' } })).toBe(false);
  });
});

describe('playScoreAnimation', () => {
  it('writes multiple frames ending on the final score', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 82, hasCritical: false, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes.length).toBeGreaterThan(1);
    expect(writes[writes.length - 1]).toContain('82/100');
  });

  it('colors the final Health score using scoreColor thresholds', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 95, hasCritical: false, palette: ansiPalette, stream, frameDelayMs: 0 });
    expect(writes[writes.length - 1]).toContain('\x1b[32m'); // green, score >= 90
  });

  it('shows the mascot reaction matching the final state on the last frame', async () => {
    const { writes, stream } = fakeStream();
    // content: 70-89, no critical -> yellow face
    await playScoreAnimation({ score: 75, hasCritical: false, palette: ansiPalette, stream, frameDelayMs: 0 });
    const last = writes[writes.length - 1]!;
    expect(last).toContain('\x1b[38;2;255;62;0m'); // svelte-orange body present
    expect(last).toContain('\x1b[33m'); // content's yellow face
  });

  it('shows the alarmed (red) reaction when a critical finding is present, even at a middling score', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 75, hasCritical: true, palette: ansiPalette, stream, frameDelayMs: 0 });
    const last = writes[writes.length - 1]!;
    expect(last).toContain('\x1b[31m'); // alarmed's red face, not content's yellow
  });

  it('plays a confetti bonus after a perfect 100, but not for any other score', async () => {
    const perfect = fakeStream();
    await playScoreAnimation({
      score: 100,
      hasCritical: false,
      palette: ansiPalette,
      stream: perfect.stream,
      frameDelayMs: 0
    });
    // Confetti frames add particle rows around the mascot; look for the deterministic
    // particle glyph set that only confetti frames introduce.
    expect(perfect.writes.some((w) => w.includes('*') || w.includes('·'))).toBe(true);

    const high = fakeStream();
    await playScoreAnimation({
      score: 99,
      hasCritical: false,
      palette: ansiPalette,
      stream: high.stream,
      frameDelayMs: 0
    });
    expect(high.writes.some((w) => w.includes('*') || w.includes('·'))).toBe(false);
  });

  it('omits the mascot entirely on a narrow terminal, still completing the wave/score reveal', async () => {
    const { writes, stream } = fakeStream();
    Object.defineProperty(stream, 'columns', { value: 30 });
    await playScoreAnimation({ score: 82, hasCritical: false, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes[writes.length - 1]).toContain('82/100');
    expect(writes.join('')).not.toContain('.---.'); // no mascot body art anywhere
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals test -- pulse-animation`
Expected: FAIL — `playScoreAnimation` doesn't accept `hasCritical` yet
(TypeScript error), no mascot/confetti output exists.

- [ ] **Step 3: Rewrite `playScoreAnimation` in `packages/cli/src/pulse-animation.ts`**

Replace the imports at the top of the file:

```ts
import { scoreColor, type Palette } from '@svelte-vitals/core';
import { createLogUpdate } from 'log-update';
import { colorEnabled } from './color.js';
import { isAgentEnv, isCiEnv, type ReporterName } from './reporter-resolve.js';
import {
  mascotFitsWidth,
  mascotStateFor,
  renderMascotAnticipating,
  renderMascotReaction,
  renderConfettiFrame
} from './mascot.js';
```

Replace `ScoreAnimationOptions` and `playScoreAnimation` (keep
`WAVE_FRAMES`, `FRAME_COUNT`, `FRAME_DELAY_MS`, `sleep`, and
`scoreAnimationEnabled` exactly as they are — only these two are changed):

```ts
const REACTION_HOLD_MS = 500;
const CONFETTI_FRAME_COUNT = 4;
const CONFETTI_FRAME_DELAY_MS = 220;

export interface ScoreAnimationOptions {
  score: number;
  /** Whether any critical-severity finding is present — determines the 'alarmed' reaction regardless of score. */
  hasCritical: boolean;
  palette: Palette;
  stream: NodeJS.WriteStream;
  /** Override for tests — real playback uses FRAME_DELAY_MS/REACTION_HOLD_MS/CONFETTI_FRAME_DELAY_MS; 0 runs every phase near-instantly. */
  frameDelayMs?: number;
}

/**
 * Plays the pulse-line score-reveal animation: the wave + counting Health score
 * (unchanged from before), plus — on a wide-enough terminal (`mascotFitsWidth`) — a
 * mascot that watches neutrally while the score counts up, then snaps to its reaction
 * pose on the final frame, held briefly, followed by a confetti bonus if the score is
 * a perfect 100. Redraws via `log-update` (see mascot.ts's `startMascotSpinner` doc
 * comment for why: hand-rolled `\x1b[nA` cursor math doesn't track wrapped lines, and
 * this block is now up to 8 lines tall with the mascot + confetti).
 */
export async function playScoreAnimation(opts: ScoreAnimationOptions): Promise<void> {
  const frameDelayMs = opts.frameDelayMs ?? FRAME_DELAY_MS;
  const holdMs = opts.frameDelayMs ?? REACTION_HOLD_MS;
  const confettiDelayMs = opts.frameDelayMs ?? CONFETTI_FRAME_DELAY_MS;
  const render = createLogUpdate(opts.stream);
  const showMascot = mascotFitsWidth(opts.stream.columns);
  const state = mascotStateFor(opts.score, opts.hasCritical);

  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const progress = frame / (FRAME_COUNT - 1);
    const displayScore = Math.round(opts.score * progress);
    const isFinalFrame = frame === FRAME_COUNT - 1;
    const wave = WAVE_FRAMES[frame]!;
    const scoreText = isFinalFrame
      ? scoreColor(opts.palette, opts.score)(`${displayScore}/100`)
      : opts.palette.dim(`${displayScore}/100`);
    const waveBlock = `  ${wave}\n  Health: ${scoreText}`;
    const mascotBlock = showMascot
      ? (isFinalFrame ? renderMascotReaction(state, opts.palette) : renderMascotAnticipating(opts.palette)) + '\n'
      : '';
    render(`${mascotBlock}${waveBlock}`);
    if (!isFinalFrame) await sleep(frameDelayMs);
  }

  if (holdMs > 0) await sleep(holdMs);

  if (showMascot && state === 'ecstatic') {
    const mascotBlock = renderMascotReaction('ecstatic', opts.palette);
    for (let i = 0; i < CONFETTI_FRAME_COUNT; i++) {
      const waveBlock = `  ${WAVE_FRAMES[FRAME_COUNT - 1]!}\n  Health: ${scoreColor(opts.palette, opts.score)('100/100')}`;
      render(`${renderConfettiFrame(i, mascotBlock, opts.palette)}\n${waveBlock}`);
      if (i < CONFETTI_FRAME_COUNT - 1 && confettiDelayMs > 0) await sleep(confettiDelayMs);
    }
  }

  render.done();
}
```

Note on the `\x1b[K` trailing-character-clearing comment from the previous
implementation: `log-update` handles this itself (it diffs and clears
per-line via its own `\x1b[2K` erase-line sequences — see its source),
so none of the old manual `\x1b[K` handling is needed anymore.

- [ ] **Step 4: Update `index.ts`'s call site**

In `packages/cli/src/index.ts`, the console-reporter branch currently has:

```ts
const animate = scoreAnimationEnabled({
  reporter,
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
```

Change to (add the `hasCritical` computation and thread it through):

```ts
const animate = scoreAnimationEnabled({
  reporter,
  stdoutIsTTY,
  env,
  noColorFlag: opts.noColor,
  noAnimationFlag: opts.noAnimation
});
if (animate) {
  await playScoreAnimation({
    score: computeHealth(results, config).health,
    hasCritical: summarize(results, config).critical > 0,
    palette,
    stream: opts.stdoutStream ?? process.stdout,
    frameDelayMs: opts.animationFrameDelayMs
  });
}
```

`summarize` is already imported at the top of `index.ts` (used later for
`const summary = summarize(results, config);` at the end of `run()`) — no
new import needed. This does call `summarize` twice (once here, once at
the bottom of the function); that mirrors the existing tolerated
redundancy of `computeHealth` already being called both here and inside
`formatConsoleReport`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals test -- pulse-animation`
Expected: PASS.

- [ ] **Step 6: Run the full CLI test suite**

Run: `pnpm --filter svelte-vitals test`
Expected: PASS — including `run.test.ts`'s existing animation tests (e.g.
`'animates the header on an interactive stdout...'`), which don't assert
on the exact redraw bytes and should be unaffected by the `log-update`
swap. If any existing `run.test.ts` assertion does break because it
checked a literal `\x1b[2A`-style byte sequence, update it to check for
content (contains `'Health:'`, contains `'Critical'`, etc.) instead of the
specific escape sequence, matching this task's own new tests' style.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/pulse-animation.ts packages/cli/src/index.ts packages/cli/test/pulse-animation.test.ts
git commit -m "feat(cli): mascot reactions and a 100/100 confetti bonus on the score reveal"
```

---

### Task 5: Documentation and changeset

**Files:**

- Modify: `packages/cli/README.md`
- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`
- Create: `.changeset/cli-mascot-animation.md`

**Interfaces:**

- Consumes: nothing (documentation only).
- Produces: nothing (leaf task).

- [ ] **Step 1: Update `packages/cli/README.md`**

Find the existing paragraph (added in the compact-console-reporter work)
that begins "By default, console output groups failures by rule...". Add a
new paragraph immediately after it:

```markdown
On an interactive terminal, a small mascot appears alongside both the
analysis spinner and the Health-score reveal, reacting to the result (a
critical finding always reads as concerned, regardless of the numeric
score; a perfect 100 gets a confetti flourish). `--no-animation` disables
it, falling back to the plain spinner and plain score animation.
```

- [ ] **Step 2: Update `docs/src/content/docs/guides/cli.md`**

Find the `### \`--no-animation\`` section. Its current body:

```markdown
Disable the Health-score reveal animation. The animation only ever plays on an interactive terminal with color enabled (never in CI, a piped/redirected output, or an AI-agent shell), so this flag is only needed to opt out of it specifically while still on an interactive terminal.
```

Replace with:

```markdown
Disable the Health-score reveal animation and the analysis-phase mascot. Both only ever play on an interactive terminal with color enabled (never in CI, a piped/redirected output, or an AI-agent shell) and wide enough to fit the mascot's art (40+ columns); this flag is only needed to opt out of them specifically while still on a terminal that would otherwise show them. Falls back to a plain spinner during analysis and a plain (mascot-free) score animation.
```

- [ ] **Step 3: Update `docs/src/content/docs/ja/guides/cli.md`**

Find the corresponding `### \`--no-animation\`` section (same heading, same
position in the file) and replace its body with the Japanese equivalent:

```markdown
Health スコア発表時のアニメーションと、解析中に表示されるマスコットを無効にします。どちらもインタラクティブな端末で色が有効な場合のみ再生され(CI・パイプ/リダイレクトされた出力・AI エージェントのシェルでは再生されません)、マスコットの絵が収まる十分な幅(40 カラム以上)がある場合に限られます。このフラグは、それ以外の条件を満たす端末上で個別に無効化したいときにのみ必要です。解析中はプレーンなスピナーに、スコア発表はマスコットなしのアニメーションにフォールバックします。
```

- [ ] **Step 4: Add the changeset**

```bash
pnpm changeset
```

When prompted: select `svelte-vitals` only (not `@svelte-vitals/core`),
choose **minor**, and enter a summary. If you prefer to write the file
directly instead of the interactive prompt, create
`.changeset/cli-mascot-animation.md`:

```markdown
---
'svelte-vitals': minor
---

Add a small mascot to the CLI's interactive terminal output: it replaces the analysis spinner with an idle loop, then reacts to the Health-score reveal (critical findings always read as concerned; a perfect 100 gets a confetti bonus). Disable with `--no-animation`, same as the existing score-reveal animation.
```

- [ ] **Step 5: Verify docs build and lint**

```bash
pnpm --filter docs build
pnpm lint
```

Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/README.md docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md .changeset/
git commit -m "docs(cli): document the mascot animation and add a changeset"
```

---
