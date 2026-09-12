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
import { fakeStream } from './helpers/fake-stream.js';

describe('mascotStateFor', () => {
  it('is ecstatic at exactly 100, happy from 90 up to (not including) 100, content below 90', () => {
    expect(mascotStateFor(100)).toBe('ecstatic');
    expect(mascotStateFor(99)).toBe('happy');
    expect(mascotStateFor(90)).toBe('happy');
    expect(mascotStateFor(89)).toBe('content');
    expect(mascotStateFor(0)).toBe('content');
  });
});

describe('mascotFitsWidth', () => {
  it('fits at 80 columns (the default) and anything at or above 20', () => {
    expect(mascotFitsWidth(80)).toBe(true);
    expect(mascotFitsWidth(20)).toBe(true);
  });
  it('does not fit below 20 columns', () => {
    expect(mascotFitsWidth(19)).toBe(false);
    expect(mascotFitsWidth(1)).toBe(false);
  });
  it('treats an unknown width (undefined columns) as fitting (defaults to 80)', () => {
    expect(mascotFitsWidth(undefined)).toBe(true);
  });
});

describe('mascot rendering', () => {
  it('renders 4-line frames (a rounded-rectangle face, 12 columns wide) for idle, anticipating, and every reaction state', () => {
    expect(renderMascotIdleFrame(0).split('\n')).toHaveLength(4);
    expect(renderMascotAnticipating().split('\n')).toHaveLength(4);
    for (const state of ['ecstatic', 'happy', 'content'] as const) {
      expect(renderMascotReaction(state).split('\n')).toHaveLength(4);
    }
  });
  it('the idle frame alternates an open-eyed and a blinking face', () => {
    const open = renderMascotIdleFrame(0);
    const blink = renderMascotIdleFrame(4); // index 4 is a blink in the 24-tick cycle
    expect(open).not.toBe(blink);
  });
  it('every frame uses a single fixed color, never a second accent color', () => {
    // Unlike the earlier pixel-art fox design (which had a separate blush accent
    // color for happy/ecstatic), this minimal design has exactly one color: every
    // rendered frame should contain exactly one distinct truecolor foreground code.
    for (const block of [
      renderMascotIdleFrame(0),
      renderMascotIdleFrame(4),
      renderMascotIdleFrame(12),
      renderMascotIdleFrame(23),
      renderMascotAnticipating(),
      renderMascotReaction('content'),
      renderMascotReaction('happy'),
      renderMascotReaction('ecstatic')
    ]) {
      // oxlint-disable-next-line no-control-regex -- \x1b matches the ANSI escape prefix, intentional
      const colorCodes = block.match(/\x1b\[38;2;\d+;\d+;\d+m/g) ?? [];
      expect(new Set(colorCodes)).toEqual(new Set(['\x1b[38;2;255;62;0m']));
    }
  });
  it('confetti wraps the given mascot block with a particle row above and below', () => {
    const mascotBlock = renderMascotReaction('ecstatic');
    const frame = renderConfettiFrame(0, mascotBlock);
    const lines = frame.split('\n');
    expect(lines).toHaveLength(6); // 1 confetti row + 4 mascot lines + 1 confetti row
    expect(lines[0]).not.toBe(''); // top confetti row has content
    expect(lines[lines.length - 1]).not.toBe('');
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
  it('mascot: false renders a plain one-line spinner with the status text', () => {
    const { writes, stream } = fakeStream();
    const spin = startMascotSpinner('Analyzing…', { enabled: true, stream, mascot: false });
    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]).toContain('Analyzing…');
    expect(writes[0]).not.toContain('\n\n'); // no mascot block, single line
    spin.stop();
  });
});
