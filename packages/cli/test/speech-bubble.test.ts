import { describe, it, expect } from 'vitest';
import {
  renderSpeechBubble,
  withSpeechBubble,
  bubbleFitsWidth,
  pickMessage,
  renderMascotWithSpeech,
  playMascotGreeting,
  GREETING_MESSAGES,
  REACTION_MESSAGES
} from '../src/speech-bubble.js';
import { renderMascotReaction } from '../src/mascot.js';

describe('renderSpeechBubble', () => {
  it('returns exactly 3 lines: top border, text, bottom border', () => {
    const lines = renderSpeechBubble('Hi there!');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('╭')).toBe(true);
    expect(lines[0]!.endsWith('╮')).toBe(true);
    expect(lines[2]!.startsWith('╰')).toBe(true);
    expect(lines[2]!.endsWith('╯')).toBe(true);
    expect(lines[1]).toBe('│ Hi there! │');
  });

  it('all 3 lines have equal width regardless of text length', () => {
    const lines = renderSpeechBubble('Welcome to Svelte Vitals!');
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });
});

describe('withSpeechBubble', () => {
  it('combines a 4-line mascot block with a 3-line bubble into 4 lines total', () => {
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined).toHaveLength(4);
  });

  it('places the 3-line bubble at the top of the 4-line mascot block, with the extra row left blank at the bottom', () => {
    // padTop = floor((4-3)/2) = 0, padBottom = 4-3-0 = 1 — withSpeechBubble's
    // generic centering formula, not a special case for this height combination.
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    const bubbleWidth = bubble[0]!.length;
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
  it('picks the first item when random() returns 0', () => {
    expect(pickMessage(['a', 'b', 'c'], () => 0)).toBe('a');
  });
  it('picks the last item when random() returns just under 1', () => {
    expect(pickMessage(['a', 'b', 'c'], () => 0.999)).toBe('c');
  });
  it('defaults to Math.random and always returns a pool member', () => {
    const pool = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(pool).toContain(pickMessage(pool));
    }
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
  it('has a reaction pool for every mascot state', () => {
    expect(Object.keys(REACTION_MESSAGES).sort()).toEqual(['content', 'ecstatic', 'happy']);
  });
});

describe('renderMascotWithSpeech', () => {
  it('composes a mascot pose and a message into a single bubbled block', () => {
    const block = renderMascotWithSpeech(renderMascotReaction('happy'), 'Nice work!');
    expect(block.split('\n')).toHaveLength(4);
    expect(block).toContain('Nice work!');
    expect(block).toContain('\x1b[38;2;255;62;0m'); // still the mascot, orange present
  });
});

function fakeStream() {
  const writes: string[] = [];
  return { writes, stream: { write: (s: string) => writes.push(s) } as unknown as NodeJS.WriteStream };
}

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
