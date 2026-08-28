import { describe, it, expect } from 'vitest';
import { mdEscape, terminalSafe } from '../src/reporter/sanitize.js';

describe('mdEscape', () => {
  it('wraps a tag in enough backticks to survive a backtick run inside it', () => {
    expect(mdEscape('<meta content="``">')).toBe('```<meta content="``">```');
  });

  it('leaves ordinary route-style bracket text alone (no link syntax present)', () => {
    expect(mdEscape('src/routes/blog/[slug]/+page.svelte')).toBe('src/routes/blog/[slug]/+page.svelte');
  });

  it('leaves clean text without tags/links/newlines untouched', () => {
    expect(mdEscape('Missing robots.txt')).toBe('Missing robots.txt');
  });
});

describe('terminalSafe', () => {
  it('strips a lone, unterminated escape byte', () => {
    expect(terminalSafe('before\x1bafter')).toBe('beforeafter');
  });

  it('keeps newlines and tabs', () => {
    expect(terminalSafe('line one\n\tline two')).toBe('line one\n\tline two');
  });

  it('strips a bare carriage return (line-overwrite spoofing)', () => {
    expect(terminalSafe('looks fine\roverwritten')).toBe('looks fineoverwritten');
  });

  it('leaves clean text untouched', () => {
    expect(terminalSafe('src/routes/blog/+page.svelte')).toBe('src/routes/blog/+page.svelte');
  });

  it('strips a C1 CSI sequence (\\x9b) with its payload', () => {
    expect(terminalSafe('a\x9b31mb')).toBe('ab');
  });

  it('strips a C1 OSC sequence (\\x9d) terminated by BEL', () => {
    expect(terminalSafe('a\x9d0;evil\x07b')).toBe('ab');
  });

  it('strips a C1 OSC sequence (\\x9d) terminated by C1 ST (\\x9c)', () => {
    expect(terminalSafe('a\x9d0;evil\x9cb')).toBe('ab');
  });

  it('strips a lone C1 byte that is not a CSI/OSC opener', () => {
    expect(terminalSafe('a\x80b')).toBe('ab');
  });

  it('leaves ESC-form CSI/OSC sequences stripped as before (non-regression)', () => {
    expect(terminalSafe('a\x1b[31mb')).toBe('ab');
    expect(terminalSafe('a\x1b]0;evil\x07b')).toBe('ab');
  });

  it('leaves ordinary multibyte and Latin-1-range text untouched (non-regression)', () => {
    expect(terminalSafe('こんにちは🎉café')).toBe('こんにちは🎉café');
    expect(terminalSafe(' ¡é')).toBe(' ¡é');
  });
});
