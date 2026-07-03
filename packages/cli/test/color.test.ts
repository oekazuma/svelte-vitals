import { describe, it, expect } from 'vitest';
import { colorEnabled, paletteFor, ansiPalette } from '../src/color.js';

const base = { reporter: 'console', isTTY: true, env: {} as NodeJS.ProcessEnv };

describe('colorEnabled', () => {
  it('is on for a console reporter on a TTY', () => {
    expect(colorEnabled(base)).toBe(true);
  });
  it('is off when not a TTY', () => {
    expect(colorEnabled({ ...base, isTTY: false })).toBe(false);
  });
  it('is off for a non-console reporter', () => {
    expect(colorEnabled({ ...base, reporter: 'json' })).toBe(false);
  });
  it('is off when NO_COLOR is set', () => {
    expect(colorEnabled({ ...base, env: { NO_COLOR: '1' } })).toBe(false);
  });
  it('is off with --no-color', () => {
    expect(colorEnabled({ ...base, noColorFlag: true })).toBe(false);
  });
  it('FORCE_COLOR forces on even off-TTY', () => {
    expect(colorEnabled({ ...base, isTTY: false, env: { FORCE_COLOR: '1' } })).toBe(true);
  });
});

describe('paletteFor', () => {
  it('applies ANSI when enabled, identity when not', () => {
    expect(paletteFor(true).red('x')).toBe(ansiPalette.red('x'));
    expect(paletteFor(true).red('x')).toContain('\x1b[31m');
    expect(paletteFor(false).red('x')).toBe('x');
  });
});
