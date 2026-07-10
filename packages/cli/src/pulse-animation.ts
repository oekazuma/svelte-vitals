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
