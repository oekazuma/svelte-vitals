import { describe, it, expect, vi, afterEach } from 'vitest';
import { consoleIO } from '../src/cli-io.js';

const oscTitleRewrite = 'a\x1b]0;evil\x07b';

describe('consoleIO', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strips terminal escape sequences from errorLog() before they reach console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleIO.errorLog(oscTitleRewrite);
    expect(spy).toHaveBeenCalledWith('ab');
  });

  it('preserves newlines and tabs in errorLog()', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleIO.errorLog('a\nb\tc');
    expect(spy).toHaveBeenCalledWith('a\nb\tc');
  });

  // log() carries the console reporter's own ANSI-styled report — it must stay unsanitized so
  // deliberate SGR color codes reach the terminal (unit-level pin; the reporter's own tests cover
  // the full styled-report dispatch path).
  it('passes deliberate ANSI color codes through log() unmodified', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const styled = '\x1b[31mred\x1b[39m';
    consoleIO.log(styled);
    expect(spy).toHaveBeenCalledWith(styled);
  });
});
