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
    rawReporter: undefined,
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
  it('is off when the agent reporter was auto-detected from the env', () => {
    expect(scoreAnimationEnabled({ ...base, env: { CLAUDECODE: '1' } })).toBe(false);
  });
});

describe('playScoreAnimation', () => {
  it('writes 6 frames ending on the final score, using frameDelayMs:0 to run instantly', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 82, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes).toHaveLength(6);
    expect(writes[writes.length - 1]).toContain('82/100');
  });

  it('colors the final frame using scoreColor thresholds', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 95, palette: ansiPalette, stream, frameDelayMs: 0 });
    expect(writes[writes.length - 1]).toContain('\x1b[32m'); // green, score >= 90
  });

  it('redraws in place: every frame after the first starts with a cursor-up escape', async () => {
    const { writes, stream } = fakeStream();
    await playScoreAnimation({ score: 50, palette: noColorPalette, stream, frameDelayMs: 0 });
    expect(writes[0]).not.toContain('\x1b[2A');
    for (let i = 1; i < writes.length; i++) expect(writes[i]).toContain('\x1b[2A');
  });
});
