import { setTimeout as sleep } from 'node:timers/promises';
import { createLogUpdate } from 'log-update';
import { renderMascotAnticipating, type MascotState } from './mascot.js';

const MIN_BUBBLE_COLUMNS = 55;

/**
 * Whether the terminal is wide enough for the mascot + speech bubble combination —
 * a stricter gate than `mascotFitsWidth` (mascot.ts), which only covers the mascot
 * face alone. Below this, callers render the mascot without a bubble (or skip a
 * bubble-only moment like the greeting entirely) rather than hiding the mascot itself.
 */
export function bubbleFitsWidth(columns: number | undefined): boolean {
  return (columns ?? 80) >= MIN_BUBBLE_COLUMNS;
}

/**
 * Renders `text` inside a Unicode box-drawing border, sized to the text (1-space
 * padding on each side). Always exactly 3 lines: top border, text line, bottom
 * border. Plain terminal-default colors — unlike the mascot's face, this is readable
 * text, not fixed-identity line art, so it doesn't need a fixed color.
 */
export function renderSpeechBubble(text: string): string[] {
  const border = '─'.repeat(text.length + 2);
  return [`╭${border}╮`, `│ ${text} │`, `╰${border}╯`];
}

/**
 * Places `bubbleLines` to the right of `mascotBlock`, vertically centered against
 * it. `mascotBlock` is a `renderFace` output (mascot.ts) — its lines already end in
 * an ANSI reset, so appending plain text after a space is safe (no color bleed into
 * the bubble).
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

const GREETING_HOLD_MS = 800;

/**
 * Plays a one-shot greeting: the mascot's idle-open pose with a random greeting
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
