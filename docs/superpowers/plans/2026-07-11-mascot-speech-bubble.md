# Mascot Speech Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the CLI's pixel-art fox mascot a bordered speech-bubble line of text next to it, at two moments: a random greeting at startup, and a random reaction line (matching the score band) at the Health-score reveal.

**Architecture:** A new, self-contained module `packages/cli/src/speech-bubble.ts` owns bubble rendering, message pools, random selection, and the greeting playback. `mascot.ts` is untouched. `pulse-animation.ts` and `index.ts` each gain a few lines to call into the new module at their existing mascot-rendering points.

**Tech Stack:** No new dependencies — plain Unicode box-drawing characters, the same `log-update` already used by `mascot.ts`/`pulse-animation.ts`.

## Global Constraints

- Speech bubble appears only at (a) CLI startup, before analysis begins, and (b) the Health-score reveal's final/reaction frame. It never appears during the analysis-phase idle loop (`startMascotSpinner` in `mascot.ts` — do not modify this function).
- New width gate `bubbleFitsWidth`: `MIN_BUBBLE_COLUMNS = 55`, same shape as `mascotFitsWidth`'s existing `MIN_MASCOT_COLUMNS = 40` (defaults `columns ?? 80`). Below 55 columns, render the fox alone (no bubble) — never hide the fox because the bubble doesn't fit.
- The startup greeting only plays when `bubbleFitsWidth` is also true (not just `mascotFitsWidth`) — a wordless greeting isn't worth a dedicated hold before the idle loop.
- Messages are English only, each ≤26 characters, matching the existing spinner copy ("Analyzing…") and `README.md` conventions.
- Message selection is uniformly random per pool via `pickMessage(pool, random = Math.random)` — `random` is only ever overridden in `speech-bubble.test.ts`'s own unit tests; production call sites and other test files never pass it, and instead assert "one of the pool's messages appears" to stay robust against actual randomness.
- Reaction messages are split per `MascotState` (`ecstatic`/`happy`/`content`, from `mascot.ts` — do not add new states). Greeting messages are one shared pool (score isn't known yet at startup).
- Greeting hold defaults to 800ms real playback; both the greeting (`playMascotGreeting`'s `holdMs`) and the score reveal (`playScoreAnimation`'s existing `frameDelayMs`) accept a test override that makes playback near-instant, following the pattern already established by `pulse-animation.ts`.
- Full spec: `docs/superpowers/specs/2026-07-11-mascot-speech-bubble-design.md`.

---

### Task 1: Speech bubble rendering + width gate

**Files:**

- Create: `packages/cli/src/speech-bubble.ts`
- Test: `packages/cli/test/speech-bubble.test.ts`

**Interfaces:**

- Produces: `bubbleFitsWidth(columns: number | undefined): boolean`, `renderSpeechBubble(text: string): string[]`, `withSpeechBubble(mascotBlock: string, bubbleLines: readonly string[]): string`

- [x] **Step 1: Write the failing tests**

Create `packages/cli/test/speech-bubble.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderSpeechBubble, withSpeechBubble, bubbleFitsWidth } from '../src/speech-bubble.js';
import { renderMascotReaction } from '../src/mascot.js';

describe('renderSpeechBubble', () => {
  it('returns exactly 3 lines: top border, text, bottom border', () => {
    const lines = renderSpeechBubble('Hi there!');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('┌')).toBe(true);
    expect(lines[0]!.endsWith('┐')).toBe(true);
    expect(lines[2]!.startsWith('└')).toBe(true);
    expect(lines[2]!.endsWith('┘')).toBe(true);
    expect(lines[1]).toBe('│ Hi there! │');
  });

  it('all 3 lines have equal width regardless of text length', () => {
    const lines = renderSpeechBubble('Welcome to Svelte Vitals!');
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });
});

describe('withSpeechBubble', () => {
  it('combines a 7-line mascot block with a 3-line bubble into 7 lines total', () => {
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined).toHaveLength(7);
  });

  it('vertically centers the bubble: blank on the outer rows, bubble content on the middle 3', () => {
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined[0]).not.toContain('┌');
    expect(combined[1]).not.toContain('┌');
    expect(combined[2]).toContain('┌');
    expect(combined[3]).toContain('Keep going!');
    expect(combined[4]).toContain('└');
    expect(combined[5]).not.toContain('└');
    expect(combined[6]).not.toContain('└');
  });
});

describe('bubbleFitsWidth', () => {
  it('fits at 55 columns and above', () => {
    expect(bubbleFitsWidth(55)).toBe(true);
    expect(bubbleFitsWidth(80)).toBe(true);
  });
  it('does not fit below 55 columns', () => {
    expect(bubbleFitsWidth(54)).toBe(false);
  });
  it('treats an unknown width (undefined columns) as fitting (defaults to 80)', () => {
    expect(bubbleFitsWidth(undefined)).toBe(true);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/speech-bubble.test.ts`
Expected: FAIL — `Cannot find module '../src/speech-bubble.js'`

- [x] **Step 3: Create `packages/cli/src/speech-bubble.ts`**

```ts
const MIN_BUBBLE_COLUMNS = 55;

/**
 * Whether the terminal is wide enough for the mascot + speech bubble combination —
 * a stricter gate than `mascotFitsWidth` (mascot.ts), which only covers the fox
 * sprite alone. Below this, callers render the mascot without a bubble (or skip a
 * bubble-only moment like the greeting entirely) rather than hiding the fox itself.
 */
export function bubbleFitsWidth(columns: number | undefined): boolean {
  return (columns ?? 80) >= MIN_BUBBLE_COLUMNS;
}

/**
 * Renders `text` inside a Unicode box-drawing border, sized to the text (1-space
 * padding on each side). Always exactly 3 lines: top border, text line, bottom
 * border. Plain terminal-default colors — unlike the fox sprite, this is readable
 * text, not pixel art, so it doesn't need a fixed color identity.
 */
export function renderSpeechBubble(text: string): string[] {
  const border = '─'.repeat(text.length + 2);
  return [`┌${border}┐`, `│ ${text} │`, `└${border}┘`];
}

/**
 * Places `bubbleLines` to the right of `mascotBlock`, vertically centered against
 * it. `mascotBlock` is a `renderPixelGrid` output (mascot.ts) — its lines already
 * end in an ANSI reset, so appending plain text after a space is safe (no color
 * bleed into the bubble).
 */
export function withSpeechBubble(mascotBlock: string, bubbleLines: readonly string[]): string {
  const mascotLines = mascotBlock.split('\n');
  const bubbleWidth = bubbleLines[0]?.length ?? 0;
  const blankBubbleLine = ' '.repeat(bubbleWidth);
  const padTop = Math.floor((mascotLines.length - bubbleLines.length) / 2);
  const padBottom = mascotLines.length - bubbleLines.length - padTop;
  const paddedBubble = [
    ...Array<string>(Math.max(padTop, 0)).fill(blankBubbleLine),
    ...bubbleLines,
    ...Array<string>(Math.max(padBottom, 0)).fill(blankBubbleLine)
  ];
  return mascotLines.map((line, i) => `${line} ${paddedBubble[i] ?? blankBubbleLine}`).join('\n');
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/speech-bubble.test.ts`
Expected: PASS (7 tests)

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/speech-bubble.ts packages/cli/test/speech-bubble.test.ts
git commit -m "feat(cli): add speech bubble rendering primitives"
```

---

### Task 2: Message pools, random selection, composition helper

**Files:**

- Modify: `packages/cli/src/speech-bubble.ts`
- Modify: `packages/cli/test/speech-bubble.test.ts`

**Interfaces:**

- Consumes: `withSpeechBubble`, `renderSpeechBubble` (Task 1, same file); `MascotState` (`packages/cli/src/mascot.ts`)
- Produces: `GREETING_MESSAGES: readonly string[]`, `REACTION_MESSAGES: Record<MascotState, readonly string[]>`, `pickMessage(pool, random?): string`, `renderMascotWithSpeech(mascotBlock: string, message: string): string`

- [x] **Step 1: Write the failing tests**

In `packages/cli/test/speech-bubble.test.ts`, replace the existing `import { renderSpeechBubble, withSpeechBubble, bubbleFitsWidth } from '../src/speech-bubble.js';` line (do not add a second import from the same path) with:

```ts
import {
  renderSpeechBubble,
  withSpeechBubble,
  bubbleFitsWidth,
  pickMessage,
  renderMascotWithSpeech,
  GREETING_MESSAGES,
  REACTION_MESSAGES
} from '../src/speech-bubble.js';
```

And append these new `describe` blocks at the end of the file:

```ts
describe('pickMessage', () => {
  it('picks the first item when random() returns 0', () => {
    expect(pickMessage(['a', 'b', 'c'], () => 0)).toBe('a');
  });
  it('picks the last item when random() returns just under 1', () => {
    expect(pickMessage(['a', 'b', 'c'], () => 0.999)).toBe('c');
  });
  it('defaults to Math.random and always returns a pool member', () => {
    const pool = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(pool).toContain(pickMessage(pool));
    }
  });
});

describe('message pools', () => {
  it('all greeting messages fit a compact bubble (<=26 chars)', () => {
    for (const m of GREETING_MESSAGES) expect(m.length).toBeLessThanOrEqual(26);
  });
  it('all reaction messages fit a compact bubble (<=26 chars)', () => {
    for (const pool of Object.values(REACTION_MESSAGES)) {
      for (const m of pool) expect(m.length).toBeLessThanOrEqual(26);
    }
  });
  it('has a reaction pool for every mascot state', () => {
    expect(Object.keys(REACTION_MESSAGES).sort()).toEqual(['content', 'ecstatic', 'happy']);
  });
});

describe('renderMascotWithSpeech', () => {
  it('composes a mascot pose and a message into a single bubbled block', () => {
    const block = renderMascotWithSpeech(renderMascotReaction('happy'), 'Nice work!');
    expect(block.split('\n')).toHaveLength(7);
    expect(block).toContain('Nice work!');
    expect(block).toContain('\x1b[38;2;255;62;0m'); // still the fox, orange present
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/speech-bubble.test.ts`
Expected: FAIL — `pickMessage`/`renderMascotWithSpeech`/`GREETING_MESSAGES`/`REACTION_MESSAGES` are not exported

- [x] **Step 3: Add to `packages/cli/src/speech-bubble.ts`**

Add this import at the very top of the file:

```ts
import type { MascotState } from './mascot.js';
```

Then append after `withSpeechBubble`:

```ts
export const GREETING_MESSAGES: readonly string[] = [
  'Welcome to Svelte Vitals!',
  "Let's check your project!",
  'Ready when you are!',
  "Hi there! Let's dig in."
];

export const REACTION_MESSAGES: Record<MascotState, readonly string[]> = {
  ecstatic: ['Perfect score!', 'Flawless!', 'You nailed it!'],
  happy: ['Nice work!', 'Looking great!', 'Almost perfect!'],
  content: ['Keep going!', 'Room to grow!', "Let's improve this!"]
};

/**
 * Picks one message uniformly at random from `pool`. `random` defaults to
 * `Math.random` — only overridden by this module's own unit tests below, for
 * deterministic selection; other call sites and their tests never pass it.
 */
export function pickMessage(pool: readonly string[], random: () => number = Math.random): string {
  return pool[Math.floor(random() * pool.length)]!;
}

/** Composes a mascot pose with a speech bubble to its right — the shared shape both the startup greeting and the score-reveal reaction use. */
export function renderMascotWithSpeech(mascotBlock: string, message: string): string {
  return withSpeechBubble(mascotBlock, renderSpeechBubble(message));
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/speech-bubble.test.ts`
Expected: PASS (13 tests)

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/speech-bubble.ts packages/cli/test/speech-bubble.test.ts
git commit -m "feat(cli): add speech bubble message pools and random selection"
```

---

### Task 3: Startup greeting playback

**Files:**

- Modify: `packages/cli/src/speech-bubble.ts`
- Modify: `packages/cli/test/speech-bubble.test.ts`

**Interfaces:**

- Consumes: `renderMascotAnticipating` (`packages/cli/src/mascot.ts`); `renderMascotWithSpeech`, `pickMessage`, `GREETING_MESSAGES` (Task 1/2, same file)
- Produces: `playMascotGreeting(opts: { enabled: boolean; stream: NodeJS.WriteStream; holdMs?: number }): Promise<void>`

- [x] **Step 1: Write the failing tests**

In `packages/cli/test/speech-bubble.test.ts`, add `playMascotGreeting` to the existing `../src/speech-bubble.js` import list (do not add a second import from the same path):

```ts
import {
  renderSpeechBubble,
  withSpeechBubble,
  bubbleFitsWidth,
  pickMessage,
  renderMascotWithSpeech,
  playMascotGreeting,
  GREETING_MESSAGES,
  REACTION_MESSAGES
} from '../src/speech-bubble.js';
```

Append at the end of the file:

```ts
function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('playMascotGreeting', () => {
  it('writes nothing when disabled', async () => {
    const { writes, stream } = fakeStream();
    await playMascotGreeting({ enabled: false, stream, holdMs: 0 });
    expect(writes).toEqual([]);
  });

  it('writes a frame containing the fox and one of the greeting messages, then clears', async () => {
    const { writes, stream } = fakeStream();
    await playMascotGreeting({ enabled: true, stream, holdMs: 0 });
    expect(writes.length).toBeGreaterThan(0);
    const allWrites = writes.join('');
    expect(allWrites).toContain('\x1b[38;2;255;62;0m'); // the fox
    expect(GREETING_MESSAGES.some((m) => allWrites.includes(m))).toBe(true);
    const last = writes[writes.length - 1]!;
    expect(GREETING_MESSAGES.some((m) => last.includes(m))).toBe(false); // cleared on the last write
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/speech-bubble.test.ts`
Expected: FAIL — `playMascotGreeting` is not exported

- [x] **Step 3: Add to `packages/cli/src/speech-bubble.ts`**

Replace the top-of-file import block (from Task 2's `import type { MascotState } from './mascot.js';`) with:

```ts
import { createLogUpdate } from 'log-update';
import { renderMascotAnticipating, type MascotState } from './mascot.js';
```

Then append at the end of the file:

```ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GREETING_HOLD_MS = 800;

/**
 * Plays a one-shot greeting: the fox's idle-open pose with a random greeting
 * message in a speech bubble, held for `holdMs`, then cleared — called once
 * before analysis starts (index.ts), never repeated within a single run. Uses
 * `log-update` for the same reason mascot.ts's `startMascotSpinner` and
 * pulse-animation.ts's `playScoreAnimation` do: accurate multi-line redraw/clear.
 */
export async function playMascotGreeting(opts: {
  enabled: boolean;
  stream: NodeJS.WriteStream;
  /** Override for tests — real playback uses GREETING_HOLD_MS; 0 completes near-instantly. */
  holdMs?: number;
}): Promise<void> {
  if (!opts.enabled) return;
  const holdMs = opts.holdMs ?? GREETING_HOLD_MS;
  const render = createLogUpdate(opts.stream);
  render(renderMascotWithSpeech(renderMascotAnticipating(), pickMessage(GREETING_MESSAGES)));
  if (holdMs > 0) await sleep(holdMs);
  render.clear();
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/speech-bubble.test.ts`
Expected: PASS (15 tests)

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/speech-bubble.ts packages/cli/test/speech-bubble.test.ts
git commit -m "feat(cli): add mascot startup greeting playback"
```

---

### Task 4: Score-reveal reaction bubble

**Files:**

- Modify: `packages/cli/src/pulse-animation.ts`
- Modify: `packages/cli/test/pulse-animation.test.ts`

**Interfaces:**

- Consumes: `bubbleFitsWidth`, `pickMessage`, `renderMascotWithSpeech`, `REACTION_MESSAGES` (`packages/cli/src/speech-bubble.ts`, Tasks 1-2)

- [x] **Step 1: Write the failing tests**

Add this import to `packages/cli/test/pulse-animation.test.ts`'s import block:

```ts
import { REACTION_MESSAGES } from '../src/speech-bubble.js';
```

Append inside the `describe('playScoreAnimation', ...)` block (after the existing `'omits the mascot entirely on a narrow terminal...'` test):

```ts
it('shows a reaction speech bubble matching the final state, on a wide enough terminal', async () => {
  const { writes, stream } = fakeStream();
  await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 }); // happy
  const allWrites = writes.join('');
  expect(REACTION_MESSAGES.happy.some((m) => allWrites.includes(m))).toBe(true);
});

it('omits the speech bubble (but keeps the fox) when the terminal fits the mascot but not the bubble', async () => {
  const { writes, stream } = fakeStream();
  Object.defineProperty(stream, 'columns', { value: 45 }); // >= 40 (mascot) but < 55 (bubble)
  await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 });
  const allWrites = writes.join('');
  expect(allWrites).toContain('\x1b[38;2;255;62;0m'); // fox still present
  for (const pool of Object.values(REACTION_MESSAGES)) {
    for (const m of pool) expect(allWrites).not.toContain(m);
  }
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/pulse-animation.test.ts`
Expected: FAIL — the first new test fails because no reaction message is ever written yet

- [x] **Step 3: Modify `packages/cli/src/pulse-animation.ts`**

Add this import after the existing `import { ... } from './mascot.js';` block:

```ts
import { bubbleFitsWidth, pickMessage, renderMascotWithSpeech, REACTION_MESSAGES } from './speech-bubble.js';
```

Replace the body of `playScoreAnimation` (from `const render = createLogUpdate(opts.stream);` through the confetti loop) with:

```ts
const render = createLogUpdate(opts.stream);
const showMascot = mascotFitsWidth(opts.stream.columns);
const state = mascotStateFor(opts.score);
const reactionMessage =
  showMascot && bubbleFitsWidth(opts.stream.columns) ? pickMessage(REACTION_MESSAGES[state]) : undefined;
const finalMascotBlock = reactionMessage
  ? renderMascotWithSpeech(renderMascotReaction(state), reactionMessage)
  : renderMascotReaction(state);

for (let frame = 0; frame < FRAME_COUNT; frame++) {
  const progress = frame / (FRAME_COUNT - 1);
  const displayScore = Math.round(opts.score * progress);
  const isFinalFrame = frame === FRAME_COUNT - 1;
  const wave = WAVE_FRAMES[frame]!;
  const scoreText = isFinalFrame
    ? scoreColor(opts.palette, opts.score)(`${displayScore}/100`)
    : opts.palette.dim(`${displayScore}/100`);
  const waveBlock = `  ${wave}\n  Health: ${scoreText}`;
  const mascotBlock = showMascot ? (isFinalFrame ? finalMascotBlock : renderMascotAnticipating()) + '\n' : '';
  render(`${mascotBlock}${waveBlock}`);
  if (!isFinalFrame) await sleep(frameDelayMs);
}

if (holdMs > 0) await sleep(holdMs);

if (showMascot && state === 'ecstatic') {
  for (let i = 0; i < CONFETTI_FRAME_COUNT; i++) {
    const waveBlock = `  ${WAVE_FRAMES[FRAME_COUNT - 1]!}\n  Health: ${scoreColor(opts.palette, opts.score)('100/100')}`;
    render(`${renderConfettiFrame(i, finalMascotBlock)}\n${waveBlock}`);
    if (i < CONFETTI_FRAME_COUNT - 1 && confettiDelayMs > 0) await sleep(confettiDelayMs);
  }
}
```

(The lines above and below this block — the `frameDelayMs`/`holdMs`/`confettiDelayMs` consts at the top, and the trailing `render.done();` — are unchanged.)

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/pulse-animation.test.ts`
Expected: PASS (14 tests)

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/pulse-animation.ts packages/cli/test/pulse-animation.test.ts
git commit -m "feat(cli): show a reaction speech bubble at the score reveal"
```

---

### Task 5: Startup greeting integration

**Files:**

- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/test/run.test.ts`

**Interfaces:**

- Consumes: `playMascotGreeting`, `bubbleFitsWidth`, `GREETING_MESSAGES` (`packages/cli/src/speech-bubble.ts`, Tasks 1-3)

- [x] **Step 1: Write the failing test**

Add this import to `packages/cli/test/run.test.ts`'s top import block:

```ts
import { GREETING_MESSAGES } from '../src/speech-bubble.js';
```

Update the existing test `'shows the mascot idle loop on stderr during analysis on a wide interactive terminal'` (in the same `describe` block as the other mascot/spinner tests) — add `animationFrameDelayMs: 0` to its `run()` call so the new greeting's hold doesn't slow the test down:

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
    stdoutIsTTY: false, // isolate: only exercise the analysis-phase mascot here
    animationFrameDelayMs: 0 // keep the greeting's hold near-instant in tests
  });
  expect(stderrWrites.length).toBeGreaterThan(0);
  // The mascot's orange truecolor escape is a reliable "this is mascot art, not the
  // plain braille spinner" marker — the braille spinner never emits color.
  expect(stderrWrites.join('')).toContain('\x1b[38;2;255;62;0m');
});
```

Then add a new test immediately after it:

```ts
it('shows a one-off greeting speech bubble before the idle loop, on a wide interactive terminal', async () => {
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
    animationFrameDelayMs: 0
  });
  const allWrites = stderrWrites.join('');
  expect(GREETING_MESSAGES.some((m) => allWrites.includes(m))).toBe(true);
});
```

- [x] **Step 2: Run tests to verify the new one fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/run.test.ts`
Expected: FAIL — the new "shows a one-off greeting" test fails (no greeting is played yet); the updated idle-loop test still passes (the added option is inert until Step 3)

- [x] **Step 3: Modify `packages/cli/src/index.ts`**

Add this import after the existing `import { startMascotSpinner, mascotFitsWidth } from './mascot.js';` line:

```ts
import { playMascotGreeting, bubbleFitsWidth } from './speech-bubble.js';
```

Replace:

```ts
const useMascotSpinner = spinnerBaseEnabled && !opts.noAnimation && mascotFitsWidth(stderrStream.columns);
const spinner = useMascotSpinner
  ? startMascotSpinner('Analyzing…', { enabled: true, stream: stderrStream })
  : startSpinner('Analyzing…', { enabled: spinnerBaseEnabled, stream: stderrStream });
```

with:

```ts
const useMascotSpinner = spinnerBaseEnabled && !opts.noAnimation && mascotFitsWidth(stderrStream.columns);
if (useMascotSpinner && bubbleFitsWidth(stderrStream.columns)) {
  // A wordless greeting isn't worth a dedicated hold before the idle loop, so this
  // only plays when there's room for the speech bubble too — not just the fox alone.
  await playMascotGreeting({ enabled: true, stream: stderrStream, holdMs: opts.animationFrameDelayMs });
}
const spinner = useMascotSpinner
  ? startMascotSpinner('Analyzing…', { enabled: true, stream: stderrStream })
  : startSpinner('Analyzing…', { enabled: spinnerBaseEnabled, stream: stderrStream });
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/run.test.ts`
Expected: PASS (all tests in the file)

- [x] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/test/run.test.ts
git commit -m "feat(cli): play a startup greeting speech bubble before analysis"
```

---

### Task 6: Docs, changeset, and full verification

**Files:**

- Modify: `packages/cli/README.md`
- Create: `.changeset/mascot-speech-bubble.md`

**Interfaces:**

- None (docs/metadata only; no code interfaces produced or consumed)

- [x] **Step 1: Update `packages/cli/README.md`**

Find the existing mascot paragraph:

```md
On an interactive terminal, a small pixel-art fox mascot appears alongside both the analysis spinner and the Health-score reveal, reacting to the score (a perfect 100 gets a confetti flourish). `--no-animation` disables it, falling back to the plain spinner and plain score animation.
```

Replace it with:

```md
On an interactive terminal, a small pixel-art fox mascot appears alongside both the analysis spinner and the Health-score reveal, reacting to the score (a perfect 100 gets a confetti flourish). On a wide enough terminal it also greets you with a short line in a speech bubble at startup, and again with a matching reaction line at the score reveal. `--no-animation` disables all of it, falling back to the plain spinner and plain score animation.
```

- [x] **Step 2: Create the changeset**

Create `.changeset/mascot-speech-bubble.md`:

```md
---
'svelte-vitals': minor
---

Give the CLI's pixel-art fox mascot a speech bubble: a random greeting line at startup, and a reaction line matching the Health-score band at the score reveal (on terminals wide enough for both). Falls back to the fox alone on narrower terminals, same as before.
```

- [x] **Step 3: Run full verification**

Run, in order, from the repo root of this worktree:

```bash
pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals build
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Expected: all five commands exit 0. If `pnpm lint`'s `prettier --check` flags `speech-bubble.ts` or any modified file, run `pnpm exec prettier --write <file>` and re-run `pnpm lint`.

If `packages/action/dist/index.js` shows as changed in `git status` after `pnpm build` (it bundles the CLI source), that is expected — stage it in the final commit.

- [x] **Step 4: Commit**

```bash
git add packages/cli/README.md .changeset/mascot-speech-bubble.md packages/action/dist/index.js
git commit -m "docs(cli): document the mascot speech bubble; add changeset"
```

- [x] **Step 5: Final check**

Run: `git status --short`
Expected: clean (nothing uncommitted) except any files intentionally left for the finishing-a-development-branch workflow.
