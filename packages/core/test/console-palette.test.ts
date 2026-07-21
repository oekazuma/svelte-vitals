import { describe, it, expect } from 'vitest';
import { formatConsoleReport, scoreColor, type Palette } from '../src/index.js';
import { defineConfig } from '../src/types.js';
import type { Result } from '../src/types.js';

const config = defineConfig({});
// Marker palette: wraps text so we can assert where color is applied.
const mark: Palette = {
  bold: (s) => `[b]${s}[/b]`,
  dim: (s) => `[d]${s}[/d]`,
  red: (s) => `[r]${s}[/r]`,
  yellow: (s) => `[y]${s}[/y]`,
  green: (s) => `[g]${s}[/g]`,
  cyan: (s) => `[c]${s}[/c]`
};
const fail: Result = {
  id: 'seo/title-presence',
  category: 'seo',
  severity: 'critical',
  detection: { presence: 'none', value: 'absent' },
  route: '/',
  message: 'Missing <title>'
};

describe('console palette', () => {
  it('is identity by default (output unchanged)', () => {
    const out = formatConsoleReport([fail], config);
    expect(out).not.toContain('[');
    expect(out).toContain('✗ seo/title-presence');
  });
  it('applies the palette to markers and severity titles when provided', () => {
    const out = formatConsoleReport([fail], config, { palette: mark });
    expect(out).toContain('[r]✗[/r]'); // failure marker red
    expect(out).toContain('[r]'); // critical title colored
    expect(out).toContain('[b]'); // header/title bold
  });
  it('scoreColor picks green/yellow/red by threshold', () => {
    expect(scoreColor(mark, 90)('9')).toBe('[g]9[/g]');
    expect(scoreColor(mark, 70)('7')).toBe('[y]7[/y]');
    expect(scoreColor(mark, 69)('6')).toBe('[r]6[/r]');
  });
});
