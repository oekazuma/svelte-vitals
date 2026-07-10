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
