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

const MIN_MASCOT_COLUMNS = 40;

/** Whether the terminal is wide enough for the mascot art; below this, callers fall back to a plain (mascot-free) animation. */
export function mascotFitsWidth(columns: number | undefined): boolean {
  return (columns ?? 80) >= MIN_MASCOT_COLUMNS;
}

// ---- pixel art ----
//
// Rendered as a fixed-palette half-block pixel-art sprite (a fox), not colorable
// text — unlike the CLI's other color output, these colors are never derived from
// the console reporter's `Palette` (packages/core/src/reporter/palette.ts): a
// pixel-art sprite has no meaningful "no-color" rendering (dropping ANSI would
// leave meaningless block characters, not readable text), so this module doesn't
// try to support one. That's safe because every call site (`startMascotSpinner`,
// and the score-reveal path in pulse-animation.ts) only ever renders the mascot
// once color is already confirmed enabled (`spinnerEnabled`/`scoreAnimationEnabled`
// both require `colorEnabled(...)`) — the mascot itself is never reached otherwise.
type RGB = readonly [number, number, number];
const ORANGE: RGB = [255, 62, 0]; // Svelte's brand accent (#ff3e00) — the fur
const EAR_INNER: RGB = [153, 45, 10]; // darker inner-ear shading
const DARK: RGB = [17, 24, 39]; // eyes, nose, mouth line
const WHITE: RGB = [255, 255, 255]; // muzzle/cheek fur
const BLUSH: RGB = [255, 145, 175]; // happy cheek accent
const BLUSH_BRIGHT: RGB = [255, 105, 150]; // ecstatic cheek accent (bigger + brighter, see withBlush)

/** Pixel-grid character alphabet. '.' is transparent (shows the real terminal background). */
type Pixel = '.' | 'X' | 'I' | 'E' | 'W' | 'N' | 'B' | 'C';
const PIXEL_COLOR: Record<Exclude<Pixel, '.'>, RGB> = {
  X: ORANGE,
  I: EAR_INNER,
  E: DARK,
  W: WHITE,
  N: DARK,
  B: BLUSH,
  C: BLUSH_BRIGHT
};

const fg = (rgb: RGB): string => `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
const bg = (rgb: RGB): string => `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
const BG_DEFAULT = '\x1b[49m';
const RESET = '\x1b[0m';

/**
 * Renders a pixel-art grid (an array of equal-length row strings, alphabet above) to a
 * multi-line ANSI string. Each printed line packs two logical pixel-rows using the
 * upper/lower half-block characters (▀/▄) — the standard terminal half-block pixel-art
 * technique — with independently set 24-bit truecolor foreground/background per cell.
 * `.` cells fall back to the terminal's own default fg/bg per cell (not a fixed fill
 * color), so the sprite's silhouette (ear notches, the gap between the ears, etc.)
 * looks correct on any real terminal background, not just one specific theme.
 */
function renderPixelGrid(grid: readonly string[]): string {
  const lines: string[] = [];
  for (let r = 0; r < grid.length; r += 2) {
    const top = grid[r]!;
    const bottom = grid[r + 1] ?? '.'.repeat(top.length);
    let line = '';
    for (let c = 0; c < top.length; c++) {
      const t = top[c] as Pixel;
      const b = bottom[c] as Pixel;
      if (t === '.' && b === '.') {
        line += RESET + ' ';
      } else if (t === '.') {
        line += fg(PIXEL_COLOR[b as Exclude<Pixel, '.'>]) + BG_DEFAULT + '▄';
      } else if (b === '.') {
        line += fg(PIXEL_COLOR[t]) + BG_DEFAULT + '▀';
      } else {
        line += fg(PIXEL_COLOR[t]) + bg(PIXEL_COLOR[b]) + '▀';
      }
    }
    lines.push(line + RESET);
  }
  return lines.join('\n');
}

const row = (s: string): string => s.replace(/ /g, '');

// Shared head (rows 0-10, 14 pixels wide): pointy ears with inner shading, eyes, and
// the white muzzle starting to flare in. Two variants: eyes open (default) and eyes
// closed (the idle-loop blink — same head, the eye rows become plain fur plus a thin
// lash line).
const HEAD_EYES_OPEN = [
  row('. . X X . . . . . . X X . .'),
  row('. . X I X . . . . X I X . .'),
  row('. X X I I X . . X I I X X .'),
  row('X X X X X X X X X X X X X X'),
  row('X X X X X X X X X X X X X X'),
  row('X X X E E X X X X E E X X X'),
  row('X X X E E X X X X E E X X X'),
  row('W X X W W W X X W W W X X W'),
  row('W W X W W W X X W W W X W W'),
  row('W W W W W W N N W W W W W W'),
  row('. W W W W W N N W W W W W .')
];

const HEAD_EYES_CLOSED = [
  row('. . X X . . . . . . X X . .'),
  row('. . X I X . . . . X I X . .'),
  row('. X X I I X . . X I I X X .'),
  row('X X X X X X X X X X X X X X'),
  row('X X X X X X X X X X X X X X'),
  row('X X X X X X X X X X X X X X'),
  row('X X X E E X X X X E E X X X'),
  row('W X X W W W X X W W W X X W'),
  row('W W X W W W X X W W W X W W'),
  row('W W W W W W N N W W W W W W'),
  row('. W W W W W N N W W W W W .')
];

// Mouths (rows 11-13, 14 pixels wide). Mood is conveyed primarily through mouth shape,
// not color — the fixed orange/white/black palette stays constant; blush is the only
// accent color, and only for the two positive states (see withBlush below).
const MOUTH_NEUTRAL = [
  row('. . W W W W W W W W W W . .'),
  row('. . W W W W N N W W W W . .'),
  row('. . . W W W W W W W W . . .')
];

const MOUTH_SMALL_SMILE = [
  // content
  row('. . W W W W W W W W W W . .'),
  row('. . W W W N W W N W W W . .'),
  row('. . . W W W N N W W W . . .')
];

const MOUTH_BIG_SMILE = [
  // happy / ecstatic
  row('. . W W N W W W W N W W . .'),
  row('. . W W W N N N N W W W . .'),
  row('. . . W W W W W W W . . . .')
];

/** Pokes blush accent pixels onto both cheeks. `bright` (ecstatic) is a larger, brighter patch than the plain happy blush. */
function withBlush(head: readonly string[], bright: boolean): string[] {
  const ch: Pixel = bright ? 'C' : 'B';
  const rows = head.map((r) => r.split(''));
  rows[8]![1] = ch;
  rows[9]![1] = ch;
  rows[8]![12] = ch;
  rows[9]![12] = ch;
  if (bright) {
    rows[9]![2] = ch;
    rows[9]![11] = ch;
  }
  return rows.map((r) => r.join(''));
}

const REACTION_GRIDS: Record<MascotState, readonly string[]> = {
  content: [...HEAD_EYES_OPEN, ...MOUTH_SMALL_SMILE],
  happy: [...withBlush(HEAD_EYES_OPEN, false), ...MOUTH_BIG_SMILE],
  ecstatic: [...withBlush(HEAD_EYES_OPEN, true), ...MOUTH_BIG_SMILE]
};

/** The settled pose for the given reaction state — the "payoff" frame of the reveal. */
export function renderMascotReaction(state: MascotState): string {
  return renderPixelGrid(REACTION_GRIDS[state]);
}

/** The neutral "watching the score count up" pose shown before the reveal cut. */
export function renderMascotAnticipating(): string {
  return renderPixelGrid([...HEAD_EYES_OPEN, ...MOUTH_NEUTRAL]);
}

const IDLE_OPEN_GRID = [...HEAD_EYES_OPEN, ...MOUTH_NEUTRAL];
const IDLE_BLINK_GRID = [...HEAD_EYES_CLOSED, ...MOUTH_NEUTRAL];

// Mostly-open with a brief blink, matching a ~1s full cycle at IDLE_TICK_MS (160ms x 5 = 800ms).
const IDLE_FRAME_SEQUENCE = [0, 0, 0, 0, 1];

/** One frame of the analysis-phase idle loop. `frameIndex` is taken mod the sequence length. */
export function renderMascotIdleFrame(frameIndex: number): string {
  const isBlink = IDLE_FRAME_SEQUENCE[frameIndex % IDLE_FRAME_SEQUENCE.length] === 1;
  return renderPixelGrid(isBlink ? IDLE_BLINK_GRID : IDLE_OPEN_GRID);
}

// A small set of festive colors for the 100/100 confetti bonus, distinct from the
// mascot's own fixed identity palette above (confetti is meant to look varied/colorful,
// unlike the fox itself, which is deliberately a constant, recognizable color scheme).
const CONFETTI_COLORS: readonly RGB[] = [
  [255, 62, 0], // orange (identity accent)
  [255, 145, 175], // blush pink
  [255, 214, 0], // gold
  [255, 255, 255] // white
];
const CONFETTI_CHARS = ['*', '.', '·', '+'];
const CONFETTI_WIDTH = 24;

function confettiRow(offset: number): string {
  let out = '';
  for (let col = 0; col < CONFETTI_WIDTH; col++) {
    if ((col + offset) % 5 === 0) {
      const glyph = CONFETTI_CHARS[(col + offset) % CONFETTI_CHARS.length]!;
      out += fg(CONFETTI_COLORS[(col + offset) % CONFETTI_COLORS.length]!) + glyph + RESET;
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
