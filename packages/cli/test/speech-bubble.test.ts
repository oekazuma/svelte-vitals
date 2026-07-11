import { describe, it, expect } from 'vitest';
import { renderSpeechBubble, withSpeechBubble, bubbleFitsWidth } from '../src/speech-bubble.js';
import { renderMascotReaction } from '../src/mascot.js';

describe('renderSpeechBubble', () => {
  it('returns exactly 3 lines: top border, text, bottom border', () => {
    const lines = renderSpeechBubble('Hi there!');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.startsWith('┌')).toBe(true);
    expect(lines[0]!.endsWith('┐')).toBe(true);
    expect(lines[2]!.startsWith('└')).toBe(true);
    expect(lines[2]!.endsWith('┘')).toBe(true);
    expect(lines[1]).toBe('│ Hi there! │');
  });

  it('all 3 lines have equal width regardless of text length', () => {
    const lines = renderSpeechBubble('Welcome to Svelte Vitals!');
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });
});

describe('withSpeechBubble', () => {
  it('combines a 7-line mascot block with a 3-line bubble into 7 lines total', () => {
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined).toHaveLength(7);
  });

  it('vertically centers the bubble: blank on the outer rows, bubble content on the middle 3', () => {
    const mascot = renderMascotReaction('content');
    const bubble = renderSpeechBubble('Keep going!');
    const combined = withSpeechBubble(mascot, bubble).split('\n');
    expect(combined[0]).not.toContain('┌');
    expect(combined[1]).not.toContain('┌');
    expect(combined[2]).toContain('┌');
    expect(combined[3]).toContain('Keep going!');
    expect(combined[4]).toContain('└');
    expect(combined[5]).not.toContain('└');
    expect(combined[6]).not.toContain('└');
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
