import { describe, it, expect } from 'vitest';
import { scoreAnimationEnabled, playScoreAnimation } from '../src/pulse-animation.js';
import { noColorPalette, ansiPalette } from '../src/color.js';
import { REACTION_MESSAGES } from '../src/speech-bubble.js';

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
    await playScoreAnimation({ score: 82, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes.length).toBeGreaterThan(1);
    expect(writes[writes.length - 1]).toContain('82/100');
  });

  it('colors the final Health score using scoreColor thresholds', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 });
    expect(writes[writes.length - 1]).toContain('\x1b[32m'); // green, score >= 90
  });

  it('shows the mascot reaction matching the final state on the last frame', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 }); // happy
    const allWrites = writes.join('');
    expect(allWrites).toContain('   ◡◡◡◡   '); // happy's mouth row — distinct from content's/ecstatic's
  });

  it('plays a confetti bonus after a perfect 100, but not for any other score', async () => {
    const perfect = fakeStream();
    await playScoreAnimation({
      score: 100,
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
      palette: ansiPalette,
      stream: high.stream,
      frameDelayMs: 0
    });
    expect(high.writes.some((w) => w.includes('*') || w.includes('·'))).toBe(false);
  });

  it('omits the mascot entirely on a narrow terminal, still completing the wave/score reveal', async () => {
    const { writes, stream } = fakeStream();
    // 19, not 15: below MIN_MASCOT_COLUMNS (20) so the mascot is correctly omitted,
    // but still wide enough that log-update doesn't hard-wrap the plain
    // "  Health: 82/100" score line (16 visible chars) itself, which would otherwise
    // split the "82/100" substring this test asserts on across two physical lines.
    Object.defineProperty(stream, 'columns', { value: 19 });
    await playScoreAnimation({ score: 82, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes[writes.length - 1]).toContain('82/100');
    expect(writes.join('')).not.toContain('╭'); // no mascot face art anywhere (the wave's own color isn't a reliable signal — it's colored too now)
  });

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
    // No columns override: defaults to a width wide enough for mascotFitsWidth to pass
    // (unlike the narrow-terminal tests above), so score: 100 actually reaches the
    // confetti loop — `showMascot && state === 'ecstatic'` — instead of being skipped.
    await playScoreAnimation({ score: 100, palette: ansiPalette, stream, frameDelayMs: 0 });
    const allWrites = writes.join('');
    // The confetti loop builds its own waveBlock every frame, byte-identical to the main
    // loop's settled frame (same color, same wave, same score text). log-update's line
    // diffing can skip re-emitting a line whose content hasn't changed since the previous
    // render, so a naive "does the last/any write contain the orange code" check can pass
    // from the main loop's own (separately tested) coloring alone, without the confetti
    // loop's coloring line ever running. Instead assert the bare/uncolored settled wave —
    // the exact text the confetti loop would emit if its WAVE_ORANGE/WAVE_RESET wrap were
    // reverted — never appears anywhere in the full output.
    expect(allWrites).not.toContain('  ─────────────────────────');
    expect(allWrites).toContain('\x1b[38;2;255;62;0m');
  });

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
});
