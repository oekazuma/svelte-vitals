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
import { noColorPalette, ansiPalette } from '../src/color.js';

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

describe('mascotStateFor', () => {
  it('is ecstatic at exactly 100', () => {
    expect(mascotStateFor(100, false)).toBe('ecstatic');
  });
  it('is happy from 90 up to (not including) 100', () => {
    expect(mascotStateFor(90, false)).toBe('happy');
    expect(mascotStateFor(99, false)).toBe('happy');
  });
  it('is alarmed whenever a critical finding is present, regardless of score, below 90', () => {
    expect(mascotStateFor(79, true)).toBe('alarmed');
    expect(mascotStateFor(0, true)).toBe('alarmed');
  });
  it('is content from 70 to 89 with no critical finding', () => {
    expect(mascotStateFor(70, false)).toBe('content');
    expect(mascotStateFor(89, false)).toBe('content');
  });
  it('is discouraged below 70 with no critical finding', () => {
    expect(mascotStateFor(69, false)).toBe('discouraged');
    expect(mascotStateFor(0, false)).toBe('discouraged');
  });
  it('a critical finding at a boundary still reads as alarmed, not content/discouraged', () => {
    expect(mascotStateFor(80, true)).toBe('alarmed');
    expect(mascotStateFor(69, true)).toBe('alarmed');
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
  it('renders 4-line frames for idle, anticipating, and every reaction state', () => {
    expect(renderMascotIdleFrame(0, noColorPalette).split('\n')).toHaveLength(4);
    expect(renderMascotAnticipating(noColorPalette).split('\n')).toHaveLength(4);
    for (const state of ['ecstatic', 'happy', 'alarmed', 'content', 'discouraged'] as const) {
      expect(renderMascotReaction(state, noColorPalette).split('\n')).toHaveLength(4);
    }
  });
  it('the idle frame alternates an open-eyed and a blinking face', () => {
    const open = renderMascotIdleFrame(0, noColorPalette);
    const blink = renderMascotIdleFrame(4, noColorPalette); // index 4 is the blink in the 5-tick cycle
    expect(open).not.toBe(blink);
  });
  it('colors the reaction face with the palette (ansiPalette produces ANSI codes, noColorPalette does not)', () => {
    const colored = renderMascotReaction('happy', ansiPalette);
    const plain = renderMascotReaction('happy', noColorPalette);
    expect(colored).toContain('\x1b[32m'); // green
    expect(plain).not.toContain('\x1b[');
  });
  it('alarmed and discouraged both render red; content renders yellow; ecstatic/happy render green', () => {
    expect(renderMascotReaction('alarmed', ansiPalette)).toContain('\x1b[31m');
    expect(renderMascotReaction('discouraged', ansiPalette)).toContain('\x1b[31m');
    expect(renderMascotReaction('content', ansiPalette)).toContain('\x1b[33m');
    expect(renderMascotReaction('ecstatic', ansiPalette)).toContain('\x1b[32m');
    expect(renderMascotReaction('happy', ansiPalette)).toContain('\x1b[32m');
  });
  it('confetti wraps the given mascot block with a particle row above and below, deterministically', () => {
    const mascotBlock = renderMascotReaction('ecstatic', noColorPalette);
    const frame = renderConfettiFrame(0, mascotBlock, noColorPalette);
    const lines = frame.split('\n');
    expect(lines).toHaveLength(6); // 1 confetti row + 4 mascot lines + 1 confetti row
    expect(lines[0]).not.toBe(''); // top confetti row has content
    expect(lines[lines.length - 1]).not.toBe('');
    // Deterministic: same offset always produces the same row (no RNG).
    expect(renderConfettiFrame(0, mascotBlock, noColorPalette)).toBe(frame);
  });
});

describe('startMascotSpinner', () => {
  it('writes nothing when disabled and returns a working stop()', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: false, palette: noColorPalette, stream });
    spin.stop();
    expect(writes).toEqual([]);
  });
  it('writes a frame immediately when enabled, containing the status text', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, palette: noColorPalette, stream });
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain('Analyzing…');
    spin.stop();
  });
  it('clears the block on stop (no leftover mascot art)', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, palette: noColorPalette, stream });
    spin.stop();
    const last = writes[writes.length - 1]!;
    expect(last).not.toContain('Analyzing…');
  });
});
