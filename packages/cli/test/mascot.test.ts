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
  it('fits at 80 columns (the default) and anything at or above 40', () => {
    expect(mascotFitsWidth(80)).toBe(true);
    expect(mascotFitsWidth(40)).toBe(true);
  });
  it('does not fit below 40 columns', () => {
    expect(mascotFitsWidth(39)).toBe(false);
    expect(mascotFitsWidth(1)).toBe(false);
  });
  it('treats an unknown width (undefined columns) as fitting (defaults to 80)', () => {
    expect(mascotFitsWidth(undefined)).toBe(true);
  });
});

describe('mascot rendering', () => {
  it('renders 7-line frames (14-pixel head+mouth grid packed 2-per-line via half-blocks) for idle, anticipating, and every reaction state', () => {
    expect(renderMascotIdleFrame(0).split('\n')).toHaveLength(7);
    expect(renderMascotAnticipating().split('\n')).toHaveLength(7);
    for (const state of ['ecstatic', 'happy', 'content'] as const) {
      expect(renderMascotReaction(state).split('\n')).toHaveLength(7);
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
  it('happy and ecstatic both apply a blush accent that content does not have', () => {
    const content = renderMascotReaction('content');
    const happy = renderMascotReaction('happy');
    const ecstatic = renderMascotReaction('ecstatic');
    // Blush pink (happy) / brighter blush pink (ecstatic) truecolor codes.
    expect(content).not.toContain('\x1b[38;2;255;145;175m');
    expect(content).not.toContain('\x1b[38;2;255;105;150m');
    expect(happy).toContain('\x1b[38;2;255;145;175m');
    expect(ecstatic).toContain('\x1b[38;2;255;105;150m');
  });
  it('confetti wraps the given mascot block with a particle row above and below, deterministically', () => {
    const mascotBlock = renderMascotReaction('ecstatic');
    const frame = renderConfettiFrame(0, mascotBlock);
    const lines = frame.split('\n');
    expect(lines).toHaveLength(9); // 1 confetti row + 7 mascot lines + 1 confetti row
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
