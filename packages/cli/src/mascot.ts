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

/** Wraps each line of a face's literal art in the fixed Svelte-orange color, joined into one multi-line string. */
function renderFace(lines: readonly string[]): string {
  return lines.map((line) => `${ORANGE_FG}${line}${RESET}`).join('\n');
}

// Every frame is 4 lines, 12 columns wide (╭ + 10 interior + ╮). Mood is conveyed
// through mouth width (and, at `ecstatic` only, the eyes switching to closed/joyful);
// there is no second accent color — the whole point of this design is to be minimal.
const FACE_OPEN_EYES_NEUTRAL_MOUTH = ['╭──────────╮', '│  ●    ●  │', '│    ──    │', '╰──────────╯'];

const FACE_CLOSED_EYES_NEUTRAL_MOUTH = ['╭──────────╮', '│  ─    ─  │', '│    ──    │', '╰──────────╯'];

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

/** 24-bit truecolor ANSI foreground escape for `rgb`. */
function confettiFg(rgb: RGB): string {
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

/** One row of confetti particles for the 100/100 bonus; `offset` shifts which columns get a glyph, for a "twinkling" effect across successive frames. */
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
