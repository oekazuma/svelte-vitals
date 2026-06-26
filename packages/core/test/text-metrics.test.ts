import { describe, it, expect } from 'vitest';
import { visibleLength } from '../src/rules/seo/text-metrics.js';

describe('visibleLength', () => {
  it('counts trimmed, whitespace-collapsed code points', () => {
    expect(visibleLength('Hello')).toBe(5);
    expect(visibleLength('  Hello  ')).toBe(5); // trimmed
    expect(visibleLength('a\n\t  b   c')).toBe(5); // "a b c" → 5
    expect(visibleLength('')).toBe(0);
    expect(visibleLength('   ')).toBe(0);
  });
  it('counts an astral emoji as one character', () => {
    expect(visibleLength('hi 😀')).toBe(4); // h i space emoji
  });
});
