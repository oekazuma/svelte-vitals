import { describe, it, expect } from 'vitest';
import {
  renderSpeechBubble,
  withSpeechBubble,
  bubbleFitsWidth,
  pickMessage,
  playMascotGreeting,
  GREETING_MESSAGES,
  REACTION_MESSAGES
} from '../src/speech-bubble.js';
import { renderMascotReaction } from '../src/mascot.js';
import { fakeStream } from './helpers/fake-stream.js';

describe('renderSpeechBubble', () => {
  it('returns exactly 3 lines of equal width: top border, text, bottom border', () => {
    const lines = renderSpeechBubble('Hi there!');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('╭')).toBe(true);
    expect(lines[0]!.endsWith('╮')).toBe(true);
    expect(lines[2]!.startsWith('╰')).toBe(true);
    expect(lines[2]!.endsWith('╯')).toBe(true);
    expect(lines[1]).toBe('│ Hi there! │');
    expect(new Set(renderSpeechBubble('Welcome to Svelte Vitals!').map((l) => l.length)).size).toBe(1);
  });
});

describe('withSpeechBubble', () => {
  it('places the 3-line bubble at the top of the 4-line mascot block, with the extra row left blank at the bottom', () => {
    // padTop = floor((4-3)/2) = 0, padBottom = 4-3-0 = 1 — withSpeechBubble's
    // generic centering formula, not a special case for this height combination.
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    const bubbleWidth = bubble[0]!.length;
    expect(combined).toHaveLength(4);
    // combined[0] is the mascot's own top border, which already contains '╭' on its own —
    // a bare `.toContain('╭')` would pass even if the bubble weren't rendered on this row
    // at all, so assert the bubble's exact top-border string appears (not just one char).
    expect(combined[0]).toContain(bubble[0]!);
    expect(combined[1]).toContain('Keep going!');
    expect(combined[2]).toContain('╰');
    // Row 3 is the mascot's own bottom border (which, unlike the old fox art, is
    // itself drawn with ╰/╯) padded with a blank bubble row — so we check the bubble
    // side specifically is blank, rather than asserting the whole row lacks ╰/╭.
    expect(combined[3]).not.toContain('Keep going!');
    expect(combined[3]!.endsWith(' '.repeat(bubbleWidth))).toBe(true);
  });
});

describe('bubbleFitsWidth', () => {
  it('fits at 55 columns and above', () => {
    expect(bubbleFitsWidth(55)).toBe(true);
    expect(bubbleFitsWidth(80)).toBe(true);
  });
  it('does not fit below 55 columns', () => {
    expect(bubbleFitsWidth(54)).toBe(false);
  });
  it('treats an unknown width (undefined columns) as fitting (defaults to 80)', () => {
    expect(bubbleFitsWidth(undefined)).toBe(true);
  });
});

describe('pickMessage', () => {
  it('picks the last item when random() returns just under 1', () => {
    expect(pickMessage(['a', 'b', 'c'], () => 0.999)).toBe('c');
  });
});

describe('message pools', () => {
  it('all greeting messages fit a compact bubble (<=26 chars)', () => {
    for (const m of GREETING_MESSAGES) expect(m.length).toBeLessThanOrEqual(26);
  });
  it('all reaction messages fit a compact bubble (<=26 chars)', () => {
    for (const pool of Object.values(REACTION_MESSAGES)) {
      for (const m of pool) expect(m.length).toBeLessThanOrEqual(26);
    }
  });
});

describe('playMascotGreeting', () => {
  it('writes nothing when disabled', async () => {
    const { writes, stream } = fakeStream();
    await playMascotGreeting({ enabled: false, stream, holdMs: 0 });
    expect(writes).toEqual([]);
  });

  it('writes a frame containing the fox and one of the greeting messages, then clears', async () => {
    const { writes, stream } = fakeStream();
    await playMascotGreeting({ enabled: true, stream, holdMs: 0 });
    expect(writes.length).toBeGreaterThan(0);
    const allWrites = writes.join('');
    expect(allWrites).toContain('\x1b[38;2;255;62;0m'); // the fox
    expect(GREETING_MESSAGES.some((m) => allWrites.includes(m))).toBe(true);
    const last = writes[writes.length - 1]!;
    expect(GREETING_MESSAGES.some((m) => last.includes(m))).toBe(false); // cleared on the last write
  });
});
