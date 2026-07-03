import { describe, it, expect } from 'vitest';
import { colorEnabled, paletteFor, ansiPalette } from '../src/color.js';
import { spinnerEnabled } from '../src/index.js';

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
  it('an empty NO_COLOR does not disable', () => {
    expect(colorEnabled({ ...base, env: { NO_COLOR: '' } })).toBe(true);
  });
  it("FORCE_COLOR='0' does not force on", () => {
    expect(colorEnabled({ ...base, isTTY: false, env: { FORCE_COLOR: '0' } })).toBe(false);
  });
});

describe('paletteFor', () => {
  it('applies ANSI when enabled, identity when not', () => {
    expect(paletteFor(true).red('x')).toBe(ansiPalette.red('x'));
    expect(paletteFor(true).red('x')).toContain('\x1b[31m');
    expect(paletteFor(false).red('x')).toBe('x');
  });
});

describe('spinnerEnabled', () => {
  const sbase = {
    reporter: 'console' as const,
    rawReporter: undefined,
    stderrIsTTY: true,
    env: {} as NodeJS.ProcessEnv
  };
  it('is on for a console reporter on an interactive stderr', () => {
    expect(spinnerEnabled(sbase)).toBe(true);
  });
  it('is off when stderr is not a TTY', () => {
    expect(spinnerEnabled({ ...sbase, stderrIsTTY: false })).toBe(false);
  });
  it('is off for a non-console reporter', () => {
    expect(spinnerEnabled({ ...sbase, reporter: 'json' })).toBe(false);
  });
  it('is off with --no-color / NO_COLOR', () => {
    expect(spinnerEnabled({ ...sbase, noColorFlag: true })).toBe(false);
    expect(spinnerEnabled({ ...sbase, env: { NO_COLOR: '1' } })).toBe(false);
  });
  it('FORCE_COLOR does NOT force the spinner on when stderr is not a TTY', () => {
    // Regression: color may be forced on for a piped log, but the spinner animates
    // with \r/escape codes and must stay off in a non-interactive stderr (e.g. CI).
    expect(spinnerEnabled({ ...sbase, stderrIsTTY: false, env: { FORCE_COLOR: '1' } })).toBe(false);
  });
});
