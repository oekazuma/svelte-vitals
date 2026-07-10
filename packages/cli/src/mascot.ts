import type { Palette } from '@svelte-vitals/core';
import { createLogUpdate } from 'log-update';

export type MascotState = 'ecstatic' | 'happy' | 'alarmed' | 'content' | 'discouraged';

/**
 * Reaction state for the score-reveal pose. `hasCritical` is checked first,
 * defensively: `CRITICAL_CAP` in packages/core/src/scoring/score.ts caps any score
 * with a critical finding at <=79, so 'ecstatic'/'happy' and hasCritical:true never
 * both hold for real (score, hasCritical) pairs derived from the same results — but
 * checking hasCritical first means this function never celebrates a critical finding
 * even if a future caller passes an inconsistent pair (e.g. a stale score computed
 * before hasCritical), rather than relying solely on callers upholding the invariant.
 */
export function mascotStateFor(score: number, hasCritical: boolean): MascotState {
  if (hasCritical) return 'alarmed';
  if (score === 100) return 'ecstatic';
  if (score >= 90) return 'happy';
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
//
// `colorEnabled` is derived from the caller's `faceColor` function (probed below) rather
// than threaded as a separate parameter, so that passing a no-color Palette suppresses
// ALL color in the frame, including the body — not just the face. Without this, the body
// would always emit ANSI truecolor codes even under `noColorPalette`/`NO_COLOR`.
const svelteOrange =
  (colorEnabled: boolean) =>
  (s: string): string =>
    colorEnabled ? `\x1b[38;2;255;62;0m${s}\x1b[39m` : s;

const TOP = ' .---. ';
const TOP_ARMS_UP = '\\.---./';
const BOTTOM = " '---' ";

function renderFace(top: string, eyes: string, mouth: string, faceColor: (s: string) => string): string {
  // Assumes faceColor wraps its input in ANSI codes when color is enabled, even for a
  // whitespace-only string (true for every Palette color fn in this codebase — see
  // packages/core/src/reporter/palette.ts's noColorPalette vs. ansiPalette in color.ts).
  const colorEnabled = faceColor(' ') !== ' ';
  const orange = svelteOrange(colorEnabled);
  return [
    orange(top),
    orange('(') + faceColor(eyes) + orange(')'),
    orange(' \\') + faceColor(mouth) + orange('/ '),
    orange(BOTTOM)
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
