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
import { bubbleFitsWidth, pickMessage, renderMascotWithSpeech, REACTION_MESSAGES } from './speech-bubble.js';

const FRAME_COUNT = 6;
const FRAME_DELAY_MS = 200;

// Pulse waveform, one string per frame — an erratic heartbeat line that settles into a
// single steady beat as the score locks in (svelte-vitals' own animation motif: "vitals"
// as in a pulse monitor). The settled frame deliberately isn't a flat line — a genuinely
// flat vitals monitor means the opposite of healthy — so it keeps one beat, marked with an
// ASCII heart ("<3"), at the same peak position frame 0 used. "<3" — not a Unicode heart
// glyph like ♡/♥ — deliberately: those sit in Unicode's "Ambiguous" East Asian Width
// class, which some terminal locale configurations render as 2 columns instead of 1,
// which would silently widen just the settled frame relative to the other five and
// reintroduce exactly the alignment jump this feature exists to avoid. "<3" is two
// Basic Latin characters (always 1 column, unconditionally), so it's a safe drop-in
// replacement for the "╱╲" peak used elsewhere. All six frames are the same width (24)
// so the line doesn't visibly shift when it settles.
const WAVE_FRAMES = [
  '────────────╱╲──────────',
  '──────────╱╲──╱╲────────',
  '────────╱╲──────╱╲──────',
  '──────╱╲──────────╲─────',
  '────╱──────────────╲────',
  '────────────<3──────────'
];

const WAVE_ORANGE = '\x1b[38;2;255;62;0m'; // Svelte's brand accent (#ff3e00) — solid, once the score has settled
const WAVE_ORANGE_DIM = '\x1b[38;2;153;37;0m'; // ~60% of full orange — while the score is still counting up
const WAVE_RESET = '\x1b[0m';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REACTION_HOLD_MS = 500;
const CONFETTI_FRAME_COUNT = 4;
const CONFETTI_FRAME_DELAY_MS = 220;

export interface ScoreAnimationOptions {
  score: number;
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
    const waveText = isFinalFrame ? `${WAVE_ORANGE}${wave}${WAVE_RESET}` : `${WAVE_ORANGE_DIM}${wave}${WAVE_RESET}`;
    const scoreText = isFinalFrame
      ? scoreColor(opts.palette, opts.score)(`${displayScore}/100`)
      : opts.palette.dim(`${displayScore}/100`);
    const waveBlock = `${waveText}\nHealth: ${scoreText}`;
    const mascotBlock = showMascot ? (isFinalFrame ? finalMascotBlock : renderMascotAnticipating()) + '\n' : '';
    render(`${mascotBlock}${waveBlock}`);
    if (!isFinalFrame) await sleep(frameDelayMs);
  }

  if (holdMs > 0) await sleep(holdMs);

  if (showMascot && state === 'ecstatic') {
    for (let i = 0; i < CONFETTI_FRAME_COUNT; i++) {
      const waveBlock = `${WAVE_ORANGE}${WAVE_FRAMES[FRAME_COUNT - 1]!}${WAVE_RESET}\nHealth: ${scoreColor(opts.palette, opts.score)('100/100')}`;
      render(`${renderConfettiFrame(i, finalMascotBlock)}\n${waveBlock}`);
      if (i < CONFETTI_FRAME_COUNT - 1 && confettiDelayMs > 0) await sleep(confettiDelayMs);
    }
  }

  render.done();
}

/**
 * Mirrors `spinnerEnabled` (packages/cli/src/index.ts) but checks stdout, not stderr —
 * the animation writes the actual report content, unlike the spinner's stderr status
 * line. `--score` mode never reaches the console-reporter call site at all, so it
 * needs no explicit check here.
 *
 * Unlike `spinnerEnabled`, the agent/CI checks here are unconditional (`isAgentEnv`/
 * `isCiEnv`, not "auto-detected only") — a decorative animation that overwrites its own
 * output via ANSI cursor-up escapes has no reasonable use even when a caller explicitly
 * forces `--reporter console` inside a detected agent shell or CI job; only a real
 * interactive human terminal benefits, and both docs and the CLI help promise it "never
 * plays in CI/agent shells" with no such carve-out.
 */
export function scoreAnimationEnabled(opts: {
  reporter: ReporterName;
  stdoutIsTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
  noAnimationFlag?: boolean;
}): boolean {
  return (
    opts.reporter === 'console' &&
    opts.stdoutIsTTY &&
    !opts.noAnimationFlag &&
    !isAgentEnv(opts.env) &&
    !isCiEnv(opts.env) &&
    colorEnabled({ reporter: opts.reporter, isTTY: opts.stdoutIsTTY, env: opts.env, noColorFlag: opts.noColorFlag })
  );
}
