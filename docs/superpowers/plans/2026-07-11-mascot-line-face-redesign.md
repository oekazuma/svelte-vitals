# Mascot Line-Face Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CLI's pixel-art fox mascot with a minimal, single-color line-art face (rounded box + eyes + mouth, Svelte orange), and colorize the Health-score reveal's pulse waveform to match.

**Architecture:** `mascot.ts` is rewritten to render plain line art (one fixed-color wrap per frame) instead of the half-block pixel-art technique — a strict simplification, several helpers and the whole per-cell color machinery are deleted, nothing is added in their place. `speech-bubble.ts` gets a one-line corner-character change to match the mascot's new rounded box. `pulse-animation.ts` gains two new fixed-color constants for its existing wave-rendering line. No changes to `@svelte-vitals/core`, `index.ts`, or the speech-bubble module's message pools/timing/gating logic.

## Global Constraints

- Every mascot frame (idle-open, idle-blink, content, happy, ecstatic) is exactly 4 lines tall, 12 columns wide: `╭` + 10 interior columns + `╮` for the top border, mirrored on the bottom, with two 12-column interior rows for eyes and mouth in between. Exact strings are given per state below — copy them verbatim (character-for-character, including exact space counts) so both the visual centering and every test's line-length assumption hold.
- Rendered in exactly one fixed color, Svelte orange (`\x1b[38;2;255;62;0m` foreground, `\x1b[0m` reset) — no second accent color anywhere in the mascot art (no blush, no per-state color, matching the project owner's explicit "minimal" request). The confetti bonus keeps its own separate multi-color palette (`CONFETTI_COLORS`), unrelated to and unaffected by this constraint.
- `MIN_MASCOT_COLUMNS = 20` (down from 40) — the box is 12 columns wide; 20 leaves a comfortable margin. `MIN_BUBBLE_COLUMNS` (`speech-bubble.ts`) stays `55`, unchanged — 12 (mascot) + 1 (gap) + 30 (longest bubble) = 43, still comfortably under 55.
- `speech-bubble.ts`'s message pools (`GREETING_MESSAGES`, `REACTION_MESSAGES`), `pickMessage`, `renderMascotWithSpeech`, `playMascotGreeting`, and all width-gating call sites in `pulse-animation.ts`/`index.ts` are functionally unchanged — only `renderSpeechBubble`'s corner characters change, to match the mascot's new rounded box.
- The pulse waveform (`WAVE_FRAMES` in `pulse-animation.ts`) keeps its existing shape and `FRAME_COUNT` — only its color changes: a fixed Svelte orange, dimmed while the score is still counting up, solid once it settles on the final frame — mirroring the dim→solid pattern already used for the `Health: NN/100` text, but with a fixed color (not `Palette`-derived), for the same reason the mascot itself doesn't use `Palette` (a brand-identity color isn't a pass/warn/fail signal).
- Full spec: `docs/superpowers/specs/2026-07-11-mascot-line-face-redesign.md`.

---

### Task 1: Mascot face redesign + speech-bubble corner rounding

**Files:**

- Modify: `packages/cli/src/mascot.ts`
- Modify: `packages/cli/test/mascot.test.ts`
- Modify: `packages/cli/src/speech-bubble.ts`
- Modify: `packages/cli/test/speech-bubble.test.ts`
- Modify: `packages/cli/test/pulse-animation.test.ts` (narrow-terminal column value + a color assertion that no longer applies)
- Modify: `packages/cli/test/run.test.ts` (narrow-terminal column value)

**Interfaces:**

- Produces (unchanged signatures, changed output): `mascotFitsWidth`, `renderMascotReaction`, `renderMascotAnticipating`, `renderMascotIdleFrame`, `renderConfettiFrame`, `startMascotSpinner`, `renderSpeechBubble`
- Unchanged: `MascotState`, `mascotStateFor`, `MascotSpinner`, everything in `speech-bubble.ts` other than `renderSpeechBubble`'s corner characters

- [ ] **Step 1: Write the failing test for `mascot.ts`**

Replace the entire contents of `packages/cli/test/mascot.test.ts` with:

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

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('mascotStateFor', () => {
  it('is ecstatic at exactly 100', () => {
    expect(mascotStateFor(100)).toBe('ecstatic');
  });
  it('is happy from 90 up to (not including) 100', () => {
    expect(mascotStateFor(90)).toBe('happy');
    expect(mascotStateFor(99)).toBe('happy');
  });
  it('is content below 90, including 0', () => {
    expect(mascotStateFor(89)).toBe('content');
    expect(mascotStateFor(70)).toBe('content');
    expect(mascotStateFor(69)).toBe('content');
    expect(mascotStateFor(0)).toBe('content');
  });
});

describe('mascotFitsWidth', () => {
  it('fits at 80 columns (the default) and anything at or above 20', () => {
    expect(mascotFitsWidth(80)).toBe(true);
    expect(mascotFitsWidth(20)).toBe(true);
  });
  it('does not fit below 20 columns', () => {
    expect(mascotFitsWidth(19)).toBe(false);
    expect(mascotFitsWidth(1)).toBe(false);
  });
  it('treats an unknown width (undefined columns) as fitting (defaults to 80)', () => {
    expect(mascotFitsWidth(undefined)).toBe(true);
  });
});

describe('mascot rendering', () => {
  it('renders 4-line frames (a rounded-rectangle face, 12 columns wide) for idle, anticipating, and every reaction state', () => {
    expect(renderMascotIdleFrame(0).split('\n')).toHaveLength(4);
    expect(renderMascotAnticipating().split('\n')).toHaveLength(4);
    for (const state of ['ecstatic', 'happy', 'content'] as const) {
      expect(renderMascotReaction(state).split('\n')).toHaveLength(4);
    }
  });
  it('the idle frame alternates an open-eyed and a blinking face', () => {
    const open = renderMascotIdleFrame(0);
    const blink = renderMascotIdleFrame(4); // index 4 is the blink in the 5-tick cycle
    expect(open).not.toBe(blink);
  });
  it('always renders in color (24-bit truecolor escape codes) — the mascot has no no-color fallback, since it is only ever reached once color is already confirmed enabled by its callers', () => {
    expect(renderMascotReaction('happy')).toContain('\x1b[38;2;255;62;0m'); // Svelte-orange foreground
  });
  it('content, happy, and ecstatic are all visually distinct from each other', () => {
    const content = renderMascotReaction('content');
    const happy = renderMascotReaction('happy');
    const ecstatic = renderMascotReaction('ecstatic');
    expect(content).not.toBe(happy);
    expect(happy).not.toBe(ecstatic);
    expect(content).not.toBe(ecstatic);
  });
  it('every frame uses a single fixed color, never a second accent color', () => {
    // Unlike the earlier pixel-art fox design (which had a separate blush accent
    // color for happy/ecstatic), this minimal design has exactly one color: every
    // rendered frame should contain exactly one distinct truecolor foreground code.
    for (const block of [
      renderMascotIdleFrame(0),
      renderMascotIdleFrame(4),
      renderMascotAnticipating(),
      renderMascotReaction('content'),
      renderMascotReaction('happy'),
      renderMascotReaction('ecstatic')
    ]) {
      const colorCodes = block.match(/\x1b\[38;2;\d+;\d+;\d+m/g) ?? [];
      expect(new Set(colorCodes)).toEqual(new Set(['\x1b[38;2;255;62;0m']));
    }
  });
  it('confetti wraps the given mascot block with a particle row above and below, deterministically', () => {
    const mascotBlock = renderMascotReaction('ecstatic');
    const frame = renderConfettiFrame(0, mascotBlock);
    const lines = frame.split('\n');
    expect(lines).toHaveLength(6); // 1 confetti row + 4 mascot lines + 1 confetti row
    expect(lines[0]).not.toBe(''); // top confetti row has content
    expect(lines[lines.length - 1]).not.toBe('');
    // Deterministic: same offset always produces the same row (no RNG).
    expect(renderConfettiFrame(0, mascotBlock)).toBe(frame);
  });
});

describe('startMascotSpinner', () => {
  it('writes nothing when disabled and returns a working stop()', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: false, stream });
    spin.stop();
    expect(writes).toEqual([]);
  });
  it('writes a frame immediately when enabled, containing the status text', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, stream });
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain('Analyzing…');
    spin.stop();
  });
  it('clears the block on stop (no leftover mascot art)', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, stream });
    spin.stop();
    const last = writes[writes.length - 1]!;
    expect(last).not.toContain('Analyzing…');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/mascot.test.ts`
Expected: FAIL — multiple assertions fail against the still-present pixel-art fox (wrong line counts, blush colors present, etc.)

- [ ] **Step 3: Rewrite `packages/cli/src/mascot.ts`**

Replace the entire file with:

```ts
import { createLogUpdate } from 'log-update';

export type MascotState = 'ecstatic' | 'happy' | 'content';

/**
 * Reaction state for the score-reveal pose. Score bands only — deliberately no
 * critical-finding override and no "discouraged"/"alarmed" states (an earlier design
 * had five states including those; scoped down to three on the project owner's call,
 * to keep the mascot upbeat rather than growing a full sad/worried repertoire).
 */
export function mascotStateFor(score: number): MascotState {
  if (score === 100) return 'ecstatic';
  if (score >= 90) return 'happy';
  return 'content';
}

const MIN_MASCOT_COLUMNS = 20;

/** Whether the terminal is wide enough for the mascot art; below this, callers fall back to a plain (mascot-free) animation. */
export function mascotFitsWidth(columns: number | undefined): boolean {
  return (columns ?? 80) >= MIN_MASCOT_COLUMNS;
}

// ---- line art ----
//
// A minimal, single-color rounded-rectangle face — deliberately not an animal or any
// other representational character (an earlier design was a half-block pixel-art fox;
// scrapped on the project owner's call as unrelated to what this tool actually is).
// Rendered as plain line art (one fixed Svelte-orange foreground color wrapping the
// whole block), not per-cell pixel art: a flat outline + eyes + mouth doesn't need
// the half-block/truecolor-per-cell technique the fox design used, and dropping it
// removes real complexity. Like that earlier design, colors are never derived from
// the console reporter's `Palette` (packages/core/src/reporter/palette.ts) — a fixed
// brand-identity color isn't a pass/warn/fail signal. Safe for the same reason: every
// call site (`startMascotSpinner`, and the score-reveal path in pulse-animation.ts)
// only ever renders the mascot once color is already confirmed enabled.
const ORANGE_FG = '\x1b[38;2;255;62;0m'; // Svelte's brand accent (#ff3e00)
const RESET = '\x1b[0m';

function renderFace(lines: readonly string[]): string {
  return lines.map((line) => `${ORANGE_FG}${line}${RESET}`).join('\n');
}

// Every frame is 4 lines, 12 columns wide (╭ + 10 interior + ╮). Mood is conveyed
// through mouth width (and, at `ecstatic` only, the eyes switching to closed/joyful);
// there is no second accent color — the whole point of this design is to be minimal.
const FACE_OPEN_EYES_NEUTRAL_MOUTH = ['╭──────────╮', '│  ●    ●  │', '│    ─     │', '╰──────────╯'];

const FACE_CLOSED_EYES_NEUTRAL_MOUTH = ['╭──────────╮', '│  ─    ─  │', '│    ─     │', '╰──────────╯'];

const FACE_CONTENT = ['╭──────────╮', '│  ●    ●  │', '│    ◡◡    │', '╰──────────╯'];

const FACE_HAPPY = ['╭──────────╮', '│  ●    ●  │', '│   ◡◡◡◡   │', '╰──────────╯'];

const FACE_ECSTATIC = ['╭──────────╮', '│  ^    ^  │', '│  ◡◡◡◡◡   │', '╰──────────╯'];

const REACTION_FACES: Record<MascotState, readonly string[]> = {
  content: FACE_CONTENT,
  happy: FACE_HAPPY,
  ecstatic: FACE_ECSTATIC
};

/** The settled pose for the given reaction state — the "payoff" frame of the reveal. */
export function renderMascotReaction(state: MascotState): string {
  return renderFace(REACTION_FACES[state]);
}

/** The neutral "watching the score count up" pose shown before the reveal cut. */
export function renderMascotAnticipating(): string {
  return renderFace(FACE_OPEN_EYES_NEUTRAL_MOUTH);
}

// Mostly-open with a brief blink, matching a ~1s full cycle at IDLE_TICK_MS (160ms x 5 = 800ms).
const IDLE_FRAME_SEQUENCE = [0, 0, 0, 0, 1];

/** One frame of the analysis-phase idle loop. `frameIndex` is taken mod the sequence length. */
export function renderMascotIdleFrame(frameIndex: number): string {
  const isBlink = IDLE_FRAME_SEQUENCE[frameIndex % IDLE_FRAME_SEQUENCE.length] === 1;
  return renderFace(isBlink ? FACE_CLOSED_EYES_NEUTRAL_MOUTH : FACE_OPEN_EYES_NEUTRAL_MOUTH);
}

// A small set of festive colors for the 100/100 confetti bonus, distinct from the
// mascot's own fixed identity color above (confetti is meant to look varied/colorful,
// unlike the face itself, which is deliberately a constant, recognizable single color).
type RGB = readonly [number, number, number];
const CONFETTI_COLORS: readonly RGB[] = [
  [255, 62, 0], // orange (identity accent)
  [255, 145, 175], // blush pink
  [255, 214, 0], // gold
  [255, 255, 255] // white
];
const CONFETTI_CHARS = ['*', '.', '·', '+'];
const CONFETTI_WIDTH = 24;

function confettiFg(rgb: RGB): string {
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

function confettiRow(offset: number): string {
  let out = '';
  for (let col = 0; col < CONFETTI_WIDTH; col++) {
    if ((col + offset) % 5 === 0) {
      const glyph = CONFETTI_CHARS[(col + offset) % CONFETTI_CHARS.length]!;
      out += confettiFg(CONFETTI_COLORS[(col + offset) % CONFETTI_COLORS.length]!) + glyph + RESET;
    } else {
      out += ' ';
    }
  }
  return out;
}

/**
 * Wraps `mascotBlock` (a `renderMascotReaction('ecstatic')` output) with a particle row
 * above and below. `offset` shifts the deterministic particle pattern between
 * successive calls for a "twinkling" effect — no RNG, so the same offset always
 * renders the same frame.
 */
export function renderConfettiFrame(offset: number, mascotBlock: string): string {
  return [confettiRow(offset), mascotBlock, confettiRow(offset + 2)].join('\n');
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
  opts: { enabled: boolean; stream?: NodeJS.WriteStream }
): MascotSpinner {
  if (!opts.enabled) return { stop() {} };
  const stream = opts.stream ?? process.stderr;
  const render = createLogUpdate(stream);
  let i = 0;
  const tick = (): void => {
    render(`${renderMascotIdleFrame(i)}\n${text}`);
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

**Character-count sanity check (verify after typing, don't just trust the prose):** every one of `FACE_OPEN_EYES_NEUTRAL_MOUTH`, `FACE_CLOSED_EYES_NEUTRAL_MOUTH`, `FACE_CONTENT`, `FACE_HAPPY`, `FACE_ECSTATIC`'s 4 strings must be exactly 12 characters long (`│`/`╭`/`╰` + 10 + `│`/`╮`/`╯`). If Step 4 fails on a line-length-implied assertion, miscounted spaces in one of these literals is the most likely cause.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/mascot.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Update `packages/cli/src/speech-bubble.ts`'s bubble corners to match**

Replace:

```ts
export function renderSpeechBubble(text: string): string[] {
  const border = '─'.repeat(text.length + 2);
  return [`┌${border}┐`, `│ ${text} │`, `└${border}┘`];
}
```

with:

```ts
export function renderSpeechBubble(text: string): string[] {
  const border = '─'.repeat(text.length + 2);
  return [`╭${border}╮`, `│ ${text} │`, `╰${border}╯`];
}
```

(Only the corner characters change — the JSDoc comment above this function, `border`'s length calculation, and everything else in the file is unchanged.)

- [ ] **Step 6: Update `packages/cli/test/speech-bubble.test.ts` for the new corners and the mascot's new 4-line height**

Replace:

```ts
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
```

with:

```ts
describe('renderSpeechBubble', () => {
  it('returns exactly 3 lines: top border, text, bottom border', () => {
    const lines = renderSpeechBubble('Hi there!');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('╭')).toBe(true);
    expect(lines[0]!.endsWith('╮')).toBe(true);
    expect(lines[2]!.startsWith('╰')).toBe(true);
    expect(lines[2]!.endsWith('╯')).toBe(true);
    expect(lines[1]).toBe('│ Hi there! │');
  });

  it('all 3 lines have equal width regardless of text length', () => {
    const lines = renderSpeechBubble('Welcome to Svelte Vitals!');
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });
});

describe('withSpeechBubble', () => {
  it('combines a 4-line mascot block with a 3-line bubble into 4 lines total', () => {
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined).toHaveLength(4);
  });

  it('places the 3-line bubble at the top of the 4-line mascot block, with the extra row left blank at the bottom', () => {
    // padTop = floor((4-3)/2) = 0, padBottom = 4-3-0 = 1 — withSpeechBubble's
    // generic centering formula, not a special case for this height combination.
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined[0]).toContain('╭');
    expect(combined[1]).toContain('Keep going!');
    expect(combined[2]).toContain('╰');
    expect(combined[3]).not.toContain('╭');
    expect(combined[3]).not.toContain('╰');
  });
});
```

Then replace:

```ts
describe('renderMascotWithSpeech', () => {
  it('composes a mascot pose and a message into a single bubbled block', () => {
    const block = renderMascotWithSpeech(renderMascotReaction('happy'), 'Nice work!');
    expect(block.split('\n')).toHaveLength(7);
    expect(block).toContain('Nice work!');
    expect(block).toContain('\x1b[38;2;255;62;0m'); // still the fox, orange present
  });
});
```

with:

```ts
describe('renderMascotWithSpeech', () => {
  it('composes a mascot pose and a message into a single bubbled block', () => {
    const block = renderMascotWithSpeech(renderMascotReaction('happy'), 'Nice work!');
    expect(block.split('\n')).toHaveLength(4);
    expect(block).toContain('Nice work!');
    expect(block).toContain('\x1b[38;2;255;62;0m'); // still the mascot, orange present
  });
});
```

Every other test in this file (`bubbleFitsWidth`, `pickMessage`, `message pools`, `playMascotGreeting`) is unaffected — leave them exactly as they are.

- [ ] **Step 7: Fix the two tests elsewhere that assumed the old blush color and the old 40-column threshold**

In `packages/cli/test/pulse-animation.test.ts`, replace:

```ts
it('shows the mascot reaction matching the final state on the last frame', async () => {
  // log-update only rewrites lines that actually changed between frames, so the last
  // write's content depends on which rows differ between the anticipating pose and the
  // reaction pose. A happy/ecstatic score reliably touches that diff because blush is
  // only added on the reaction frame (never during anticipating) — a score in the
  // "content" band wouldn't, since its mouth uses the same fixed palette as the
  // anticipating pose's neutral mouth, just a different shape.
  const { writes, stream } = fakeStream();
  await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 }); // happy
  const last = writes[writes.length - 1]!;
  expect(last).toContain('\x1b[38;2;255;145;175m'); // happy's blush accent, added only on the reaction frame
});
```

with:

```ts
it('shows the mascot reaction matching the final state on the last frame', async () => {
  const { writes, stream } = fakeStream();
  await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 }); // happy
  const allWrites = writes.join('');
  expect(allWrites).toContain('   ◡◡◡◡   '); // happy's mouth row — distinct from content's/ecstatic's
});
```

And in the same file, change only the `columns` value (30 → 15, since `MIN_MASCOT_COLUMNS` is now 20) in:

```ts
  it('omits the mascot entirely on a narrow terminal, still completing the wave/score reveal', async () => {
    const { writes, stream } = fakeStream();
    Object.defineProperty(stream, 'columns', { value: 30 });
```

→ `value: 15` (leave the rest of that test body untouched for now — its `not.toContain('\x1b[38;2;255;62;0m')` assertion is revisited in Task 2, once the wave itself can also emit that color).

In `packages/cli/test/run.test.ts`, change only the `columns` value (30 → 15) in:

```ts
  it('falls back to the plain braille spinner on a narrow terminal', async () => {
    const cap = capture();
    const stderrWrites: string[] = [];
    const stderrStream = { write: (s: string) => stderrWrites.push(s) } as unknown as NodeJS.WriteStream;
    Object.defineProperty(stderrStream, 'columns', { value: 30 });
```

→ `value: 15`. Nothing else in that test changes.

- [ ] **Step 8: Run the full CLI test suite to verify everything passes**

Run: `pnpm --filter svelte-vitals test`
Expected: PASS, all files

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter svelte-vitals typecheck`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add packages/cli/src/mascot.ts packages/cli/test/mascot.test.ts packages/cli/src/speech-bubble.ts packages/cli/test/speech-bubble.test.ts packages/cli/test/pulse-animation.test.ts packages/cli/test/run.test.ts
git commit -m "feat(cli): redesign mascot as a minimal line-art face, round the speech bubble's corners to match"
```

---

### Task 2: Pulse-line colorization

**Files:**

- Modify: `packages/cli/src/pulse-animation.ts`
- Modify: `packages/cli/test/pulse-animation.test.ts`

**Interfaces:**

- No new exports. `ScoreAnimationOptions` and `playScoreAnimation`'s signature are unchanged — only what `playScoreAnimation` writes to its stream changes.

- [ ] **Step 1: Write the failing tests**

**Note (updated after Task 1 shipped):** Task 1's implementer found that `columns: 15` makes `log-update` hard-wrap the plain `"  Health: 82/100"` score line (16 visible characters) at that width, splitting text substrings across physical lines for reasons unrelated to mascot logic — so Task 1's own narrow-terminal test in this file already uses `columns: 19` (not the `15` originally planned), still safely below `MIN_MASCOT_COLUMNS = 20`. Use `19` for all narrow-terminal `columns` values below, for the same reason and to stay consistent with what's already in the file.

In `packages/cli/test/pulse-animation.test.ts`, append inside the `describe('playScoreAnimation', ...)` block (after the existing `'omits the speech bubble (but keeps the fox)...'` test, before the closing `});` of the describe block):

```ts
it('colors the pulse wave dim orange while counting, solid orange once the score settles', async () => {
  const { writes, stream } = fakeStream();
  Object.defineProperty(stream, 'columns', { value: 19 }); // below MIN_MASCOT_COLUMNS — isolates the wave's own color from the mascot's
  await playScoreAnimation({ score: 82, palette: ansiPalette, stream, frameDelayMs: 0 });
  const allWrites = writes.join('');
  expect(allWrites).toContain('\x1b[38;2;153;37;0m'); // dim orange, seen during at least one counting frame
  expect(allWrites).toContain('\x1b[38;2;255;62;0m'); // solid orange, seen on the settled frame
});

it('colors the settled wave solid orange during the confetti bonus too', async () => {
  const { writes, stream } = fakeStream();
  Object.defineProperty(stream, 'columns', { value: 19 });
  await playScoreAnimation({ score: 100, palette: ansiPalette, stream, frameDelayMs: 0 });
  const lastWrite = writes[writes.length - 1]!;
  expect(lastWrite).toContain('\x1b[38;2;255;62;0m');
});
```

Then fix the narrow-terminal test's now-ambiguous color assertion (the wave itself will, after this task's Step 2, also emit `\x1b[38;2;255;62;0m` on its settled frame — this assertion needs to check for the mascot's actual box-drawing character instead, not a color both the mascot and the now-colored wave share). The test currently reads (already at `columns: 19`, per Task 1):

```ts
it('omits the mascot entirely on a narrow terminal, still completing the wave/score reveal', async () => {
  const { writes, stream } = fakeStream();
  Object.defineProperty(stream, 'columns', { value: 19 });
  await playScoreAnimation({ score: 82, palette: noColorPalette, stream, frameDelayMs: 0 });
  expect(writes[writes.length - 1]).toContain('82/100');
  expect(writes.join('')).not.toContain('\x1b[38;2;255;62;0m'); // no mascot body art anywhere
});
```

Replace only its last assertion line — leave `columns: 19` and everything else as-is:

```ts
expect(writes.join('')).not.toContain('╭'); // no mascot face art anywhere (the wave's own color isn't a reliable signal — it's colored too now)
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `pnpm --filter svelte-vitals exec vitest run test/pulse-animation.test.ts`
Expected: FAIL — the two new color tests fail (wave isn't colored yet); the just-edited narrow-terminal test still passes (its new assertion is already true before this task's source change)

- [ ] **Step 3: Modify `packages/cli/src/pulse-animation.ts`**

Add these three constants right after the `WAVE_FRAMES` array:

```ts
const WAVE_FRAMES = [
  '────────────╱╲──────────',
  '──────────╱╲──╱╲────────',
  '────────╱╲──────╱╲──────',
  '──────╱╲──────────╲─────',
  '────╱──────────────╲────',
  '─────────────────────────'
];

const WAVE_ORANGE = '\x1b[38;2;255;62;0m'; // Svelte's brand accent (#ff3e00) — solid, once the score has settled
const WAVE_ORANGE_DIM = '\x1b[38;2;153;37;0m'; // ~60% of full orange — while the score is still counting up
const WAVE_RESET = '\x1b[0m';
```

Then, inside `playScoreAnimation`'s frame loop, replace:

```ts
const wave = WAVE_FRAMES[frame]!;
const scoreText = isFinalFrame
  ? scoreColor(opts.palette, opts.score)(`${displayScore}/100`)
  : opts.palette.dim(`${displayScore}/100`);
const waveBlock = `  ${wave}\n  Health: ${scoreText}`;
```

with:

```ts
const wave = WAVE_FRAMES[frame]!;
const waveText = isFinalFrame ? `${WAVE_ORANGE}${wave}${WAVE_RESET}` : `${WAVE_ORANGE_DIM}${wave}${WAVE_RESET}`;
const scoreText = isFinalFrame
  ? scoreColor(opts.palette, opts.score)(`${displayScore}/100`)
  : opts.palette.dim(`${displayScore}/100`);
const waveBlock = `  ${waveText}\n  Health: ${scoreText}`;
```

And in the confetti loop, replace:

```ts
const waveBlock = `  ${WAVE_FRAMES[FRAME_COUNT - 1]!}\n  Health: ${scoreColor(opts.palette, opts.score)('100/100')}`;
```

with:

```ts
const waveBlock = `  ${WAVE_ORANGE}${WAVE_FRAMES[FRAME_COUNT - 1]!}${WAVE_RESET}\n  Health: ${scoreColor(opts.palette, opts.score)('100/100')}`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter svelte-vitals exec vitest run test/pulse-animation.test.ts`
Expected: PASS, all tests in the file

- [ ] **Step 5: Run the full CLI test suite and typecheck**

Run: `pnpm --filter svelte-vitals test && pnpm --filter svelte-vitals typecheck`
Expected: PASS, no errors

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/pulse-animation.ts packages/cli/test/pulse-animation.test.ts
git commit -m "feat(cli): color the Health-score reveal's pulse wave in Svelte orange"
```

---

### Task 3: Docs, changesets, and full verification

**Files:**

- Modify: `packages/cli/README.md`
- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`
- Modify: `.changeset/cli-mascot-animation.md`
- Modify: `.changeset/mascot-speech-bubble.md`

**Interfaces:** none (docs/metadata only)

Both changesets are still unreleased (no "Version Packages" PR has consumed them yet) and currently describe a "pixel-art fox" that no longer exists — update them in place rather than adding a third changeset for a feature that hasn't shipped yet.

- [ ] **Step 1: Update `packages/cli/README.md`**

Find:

```md
On an interactive terminal wide enough for the mascot (40+ columns), a small pixel-art fox appears alongside both the analysis spinner and the Health-score reveal, reacting to the score (a perfect 100 gets a confetti flourish). On a wider terminal still (55+ columns) it also greets you with a short line in a speech bubble at startup, and again with a matching reaction line at the score reveal. `--no-animation` disables all of it, falling back to the plain spinner and plain score animation.
```

Replace with:

```md
On an interactive terminal wide enough for the mascot (20+ columns), a small line-art face appears alongside both the analysis spinner and the Health-score reveal, reacting to the score (a perfect 100 gets a confetti flourish). On a wider terminal still (55+ columns) it also greets you with a short line in a speech bubble at startup, and again with a matching reaction line at the score reveal. `--no-animation` disables all of it, falling back to the plain spinner and plain score animation.
```

- [ ] **Step 2: Update `docs/src/content/docs/guides/cli.md`**

Find the sentence containing `The mascot art additionally needs 40+ columns and is omitted below that width even without this flag`. Change `40+ columns` to `20+ columns`. Nothing else in that paragraph changes (it doesn't mention a fox specifically).

- [ ] **Step 3: Update `docs/src/content/docs/ja/guides/cli.md`**

Find the sentence containing `マスコットの絵はさらに 40 カラム以上の幅を必要とし`. Change `40 カラム以上` to `20 カラム以上`. Nothing else in that paragraph changes.

- [ ] **Step 4: Update `.changeset/cli-mascot-animation.md`**

Replace its content with:

```md
---
'svelte-vitals': minor
---

Add a small mascot to the CLI's interactive terminal output: it replaces the analysis spinner with an idle loop, then reacts to the Health-score reveal (a perfect 100 gets a confetti bonus). A minimal, single-color line-art face in Svelte's brand orange, shown on terminals 20+ columns wide. Disable with `--no-animation`, same as the existing score-reveal animation.
```

- [ ] **Step 5: Update `.changeset/mascot-speech-bubble.md`**

Replace its content with:

```md
---
'svelte-vitals': minor
---

Give the CLI's mascot a speech bubble: a random greeting line at startup, and a reaction line matching the Health-score band at the score reveal (on terminals wide enough for both, 55+ columns). Falls back to the mascot alone on narrower terminals, same as before. The Health-score reveal's pulse waveform is now colored in the same Svelte orange as the mascot — dim while counting, solid once the score settles.
```

- [ ] **Step 6: Run full verification**

From the repo root of this worktree:

```bash
pnpm --filter @svelte-vitals/core build && pnpm --filter svelte-vitals build
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Expected: all five commands exit 0. If `pnpm lint`'s `prettier --check` step flags any file, run `pnpm exec prettier --write <file>` and re-run `pnpm lint`.

If `packages/action/dist/index.js` shows as changed in `git status` after `pnpm build` (it bundles the CLI source), that is expected — stage it in the final commit.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/README.md docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md .changeset/cli-mascot-animation.md .changeset/mascot-speech-bubble.md packages/action/dist/index.js
git commit -m "docs(cli): update mascot docs and changesets for the line-face redesign"
```

- [ ] **Step 8: Final check**

Run: `git status --short`
Expected: clean (nothing uncommitted)
